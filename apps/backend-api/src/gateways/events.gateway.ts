import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef, OnModuleDestroy } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { UsersService } from '../modules/users/users.service';
import { LotteryService } from '../modules/lottery/lottery.service';
import { BetsService } from '../modules/bets/bets.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();
  private redisPubClient: ReturnType<typeof createClient> | null = null;
  private redisSubClient: ReturnType<typeof createClient> | null = null;

  constructor(
    private usersService: UsersService,
    @Inject(forwardRef(() => LotteryService))
    private lotteryService: LotteryService,
    @Inject(forwardRef(() => BetsService))
    private betsService: BetsService,
  ) {}

  /**
   * Initialize Redis adapter for multi-instance Socket.IO scaling
   * This ensures events emitted on one Railway instance propagate to all instances
   */
  async afterInit(server: Server) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      this.logger.warn('⚠️ [EventsGateway] REDIS_URL not set - Redis adapter disabled (single instance only)');
      this.logger.warn('⚠️ [EventsGateway] Multi-instance realtime updates will NOT work without Redis');
      return;
    }

    try {
      this.logger.log('🔌 [EventsGateway] Initializing Redis adapter for multi-instance scaling...');
      this.logger.log(`🔌 [EventsGateway] Redis URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`); // Mask password in logs

      // Create Redis pub/sub clients
      this.redisPubClient = createClient({ url: redisUrl });
      this.redisSubClient = this.redisPubClient.duplicate();

      // Handle connection errors
      this.redisPubClient.on('error', (err) => {
        this.logger.error('❌ [EventsGateway] Redis pub client error:', err);
      });

      this.redisSubClient.on('error', (err) => {
        this.logger.error('❌ [EventsGateway] Redis sub client error:', err);
      });

      // Connect both clients
      await Promise.all([
        this.redisPubClient.connect(),
        this.redisSubClient.connect(),
      ]);

      this.logger.log('✅ [EventsGateway] Redis clients connected');

      // Attach Redis adapter to Socket.IO server
      server.adapter(createAdapter(this.redisPubClient, this.redisSubClient));

      this.logger.log('✅ [EventsGateway] Redis adapter attached to Socket.IO server');
      this.logger.log('✅ [EventsGateway] Multi-instance realtime updates enabled');
      this.logger.log('✅ [EventsGateway] Events will propagate across ALL Railway instances');
    } catch (error) {
      this.logger.error('❌ [EventsGateway] Failed to initialize Redis adapter:', error);
      this.logger.error('❌ [EventsGateway] Multi-instance realtime updates will NOT work');
      this.logger.error('❌ [EventsGateway] Falling back to single-instance mode');
      
      // Clean up on error
      if (this.redisPubClient) {
        try {
          await this.redisPubClient.quit();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (this.redisSubClient) {
        try {
          await this.redisSubClient.quit();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      this.redisPubClient = null;
      this.redisSubClient = null;
    }
  }

  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    const isDev = process.env.NODE_ENV === 'development';
    
    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

        // DEV MODE: Allow connections without token or with invalid token
      if (isDev && !token) {
        this.logger.warn(`🔧 [DEV] Client ${client.id} connected without token - allowing connection`);
        client.userId = 'DEV';
        this.connectedClients.set(client.id, client);
        client.emit('connected', { userId: 'DEV' });
        // Skip initial data for DEV mode (no real user)
        return;
      }

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production') as {
          sub: string;
          telegramId?: string;
        };

        // Extract userId from JWT payload (JWT uses 'sub' field, not 'userId')
        const userId = decoded.sub;
        
        // DEV MODE: Fallback to 'DEV' if userId is missing
        if (isDev && !userId) {
          this.logger.warn(`🔧 [DEV] Client ${client.id} token missing userId (sub) - using DEV`);
          client.userId = 'DEV';
          this.connectedClients.set(client.id, client);
          client.emit('connected', { userId: 'DEV' });
          // Skip initial data for DEV mode (no real user)
          return;
        }

        if (!userId) {
          throw new Error('Token missing userId (sub)');
        }

        client.userId = userId;
        this.connectedClients.set(client.id, client);
        
        // Join user-specific room for cross-instance user targeting
        // With Redis adapter, this allows emitToUser to reach clients on all instances
        client.join(`user:${userId}`);
        
        this.logger.log(`Client ${client.id} connected (User: ${userId})`);

        // Send connection confirmation
        client.emit('connected', { userId });

        // Emit initial data after authentication
        this.emitInitialData(userId, client);
      } catch (authError) {
        // DEV MODE: Allow connection even if token verification fails
        if (isDev) {
          this.logger.warn(`🔧 [DEV] Client ${client.id} authentication failed: ${authError.message} - allowing connection`);
          client.userId = 'DEV';
          this.connectedClients.set(client.id, client);
          client.emit('connected', { userId: 'DEV' });
          // Skip initial data for DEV mode (no real user)
          return;
        } else {
          // PRODUCTION: Strict authentication required
          this.logger.warn(`Client ${client.id} authentication failed: ${authError.message}`);
          client.disconnect();
        }
      }
    } catch (error) {
      // DEV MODE: Allow connection even on unexpected errors
      if (isDev) {
        this.logger.warn(`🔧 [DEV] Client ${client.id} connection error: ${error.message} - allowing connection`);
        client.userId = 'DEV';
        this.connectedClients.set(client.id, client);
        client.emit('connected', { userId: 'DEV' });
        // Skip initial data for DEV mode (no real user)
        return;
      } else {
        this.logger.warn(`Client ${client.id} connection error: ${error.message}`);
        client.disconnect();
      }
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
    // Leave user room on disconnect (automatic, but explicit for clarity)
    if (client.userId) {
      client.leave(`user:${client.userId}`);
    }
    this.connectedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Cleanup Redis connections on module destroy
   */
  async onModuleDestroy() {
    if (this.redisPubClient) {
      try {
        await this.redisPubClient.quit();
        this.logger.log('✅ [EventsGateway] Redis pub client disconnected');
      } catch (error) {
        this.logger.error('❌ [EventsGateway] Error disconnecting Redis pub client:', error);
      }
    }
    if (this.redisSubClient) {
      try {
        await this.redisSubClient.quit();
        this.logger.log('✅ [EventsGateway] Redis sub client disconnected');
      } catch (error) {
        this.logger.error('❌ [EventsGateway] Error disconnecting Redis sub client:', error);
      }
    }
  }

  /**
   * Emit round:completed event to all connected clients
   * Called immediately after round completion transaction commits
   */
  emitRoundCompleted(roundData: {
    roundId: string;
    roundNumber: number;
    winningBlock: number;
    status: string;
    totalPool: number;
    winnerPool: number;
    drawnAt: Date;
  }) {
    const namespace = '/events';
    const connectedCount = this.connectedClients.size;
    const eventPayload = {
      ...roundData,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`📡 [EventsGateway] 🚀 EMITTING round:completed event`);
    this.logger.log(`📡 [EventsGateway] Round ID: ${roundData.roundId}`);
    this.logger.log(`📡 [EventsGateway] Round Number: #${roundData.roundNumber}`);
    this.logger.log(`📡 [EventsGateway] Winning Block: ${roundData.winningBlock}`);
    this.logger.log(`📡 [EventsGateway] Namespace: ${namespace}`);
    this.logger.log(`📡 [EventsGateway] Connected clients: ${connectedCount}`);
    this.logger.log(`📡 [EventsGateway] Event payload: ${JSON.stringify(eventPayload, null, 2)}`);
    
    // Emit to all connected clients (broadcast)
    this.server.emit('round:completed', eventPayload);
    
    this.logger.log(`📡 [EventsGateway] ✅ Event emitted successfully to ${connectedCount} client(s)`);
  }

  /**
   * Emit event to specific user
   * Uses Socket.IO rooms for cross-instance targeting with Redis adapter
   */
  emitToUser(userId: string, event: string, data: any) {
    // Use Socket.IO room to target user across all instances
    // With Redis adapter, this reaches clients on ALL Railway instances
    const room = `user:${userId}`;
    this.server.to(room).emit(event, data);
    this.logger.log(`📡 [EventsGateway] Emitted ${event} to user ${userId} (room: ${room})`);
  }

  /**
   * Get count of connected clients
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Emit bet:placed event to all connected clients (broadcast)
   * Called after bet is successfully placed
   * CONTRACT: Must include userId, roundId, blockNumber, amount, createdAt
   */
  emitBetPlaced(betData: {
    roundId: string;
    blockNumber: number;
    amount: number;
    userId: string;
    createdAt: string;
    totalPool: number;
    winnerPool: number;
    adminFee: number;
    blockStats: Array<{ blockNumber: number; totalBets: number; totalAmount: number }>;
  }) {
    const eventPayload = {
      roundId: betData.roundId,
      blockNumber: betData.blockNumber,
      amount: betData.amount,
      userId: betData.userId,
      createdAt: betData.createdAt,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`📡 [EventsGateway] 🚀 EMITTING bet:placed event`);
    this.logger.log(`📡 [EventsGateway] User ID: ${betData.userId}`);
    this.logger.log(`📡 [EventsGateway] Round ID: ${betData.roundId}`);
    this.logger.log(`📡 [EventsGateway] Block: ${betData.blockNumber}, Amount: ${betData.amount}`);
    
    // Emit to all connected clients (broadcast)
    this.server.emit('bet:placed', eventPayload);
    
    this.logger.log(`📡 [EventsGateway] ✅ bet:placed event emitted to ${this.connectedClients.size} client(s)`);
  }

  /**
   * Emit round:stats:updated event (broadcast)
   * Called when block statistics change
   * CONTRACT: Must include roundId and stats object with blockNumber keys
   */
  emitRoundStatsUpdated(roundId: string, blockStats: Array<{ blockNumber: number; totalBets: number; totalAmount: number }>) {
    // Convert array to object format: { [blockNumber]: { buyers, totalAmount } }
    const statsObj: Record<number, { buyers: number; totalAmount: number }> = {};
    blockStats.forEach(stat => {
      statsObj[stat.blockNumber] = {
        buyers: stat.totalBets,
        totalAmount: stat.totalAmount,
      };
    });

    const eventPayload = {
      roundId,
      stats: statsObj,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`📡 [EventsGateway] 🚀 EMITTING round:stats:updated event`);
    this.logger.log(`📡 [EventsGateway] Round ID: ${roundId}`);
    this.logger.log(`📡 [EventsGateway] Block count: ${Object.keys(statsObj).length}`);
    
    // Emit to all connected clients (broadcast)
    this.server.emit('round:stats:updated', eventPayload);
    
    this.logger.log(`📡 [EventsGateway] ✅ round:stats:updated event emitted to ${this.connectedClients.size} client(s)`);
  }

  /**
   * Emit round:active:updated event (broadcast)
   * Called when active round changes or pool updates
   */
  emitActiveRoundUpdated(roundData: {
    id: string;
    roundNumber: number;
    status: string;
    totalPool: number;
    winnerPool: number;
    adminFee: number;
    totalBets: number;
    drawTime: Date;
    winningBlock: number | null;
    drawnAt: Date | null;
  }) {
    const eventPayload = {
      ...roundData,
      drawTime: roundData.drawTime.toISOString(),
      drawnAt: roundData.drawnAt?.toISOString() || null,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`📡 [EventsGateway] 🚀 EMITTING round:active:updated event`);
    this.logger.log(`📡 [EventsGateway] Round ID: ${roundData.id}, Round #${roundData.roundNumber}`);
    
    // Emit to all connected clients (broadcast)
    this.server.emit('round:active:updated', eventPayload);
    
    this.logger.log(`📡 [EventsGateway] ✅ round:active:updated event emitted to ${this.connectedClients.size} client(s)`);
  }

  /**
   * Emit user:balance:updated event to specific user
   */
  emitUserBalanceUpdated(userId: string, balance: number, points: number) {
    const eventPayload = {
      kyatBalance: balance,
      points,
      timestamp: new Date().toISOString(),
    };

    this.emitToUser(userId, 'user:balance:updated', eventPayload);
  }

  /**
   * Emit user:bets:updated event to specific user
   * Called after bet is successfully placed (manual or autobet)
   */
  emitUserBetsUpdated(userId: string, bets: Array<{
    id: string;
    roundId: string;
    blockNumber: number;
    amount: number;
    createdAt: string;
  }>) {
    const eventPayload = {
      bets,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`📡 [EventsGateway] 🚀 EMITTING user:bets:updated event`);
    this.logger.log(`📡 [EventsGateway] User ID: ${userId}`);
    this.logger.log(`📡 [EventsGateway] Bet count: ${bets.length}`);
    
    this.emitToUser(userId, 'user:bets:updated', eventPayload);
    
    this.logger.log(`📡 [EventsGateway] ✅ user:bets:updated event emitted to user ${userId}`);
  }

  /**
   * Emit initial data after socket authentication
   * This ensures frontend gets user balance, active round, and bets immediately
   */
  private async emitInitialData(userId: string, client: AuthenticatedSocket) {
    try {
      // Emit user balance
      const user = await this.usersService.findOne(userId);
      if (user) {
        this.logger.log(`📡 [EventsGateway] Emitting initial user balance for ${userId}`);
        this.emitUserBalanceUpdated(userId, Number(user.kyatBalance), Number(user.points));
      }

      // Emit active round
      const activeRound = await this.lotteryService.getActiveRound();
      if (activeRound) {
        this.logger.log(`📡 [EventsGateway] Emitting initial active round for ${userId}`);
        this.emitActiveRoundUpdated({
          id: activeRound.id,
          roundNumber: activeRound.roundNumber,
          status: activeRound.status,
          totalPool: Number(activeRound.totalPool),
          winnerPool: Number(activeRound.winnerPool),
          adminFee: Number(activeRound.adminFee),
          totalBets: activeRound.bets?.length || 0,
          drawTime: activeRound.drawTime,
          winningBlock: activeRound.winningBlock,
          drawnAt: activeRound.drawnAt,
        });
      }

      // Emit user bets (user-scoped event)
      const userBets = await this.betsService.getUserBets(userId, 100);
      if (userBets && userBets.length > 0) {
        this.logger.log(`📡 [EventsGateway] Emitting initial user bets for ${userId} (${userBets.length} bets)`);
        const betsPayload = userBets.map(bet => ({
          id: bet.id,
          roundId: bet.lotteryRoundId,
          blockNumber: bet.blockNumber,
          amount: Number(bet.amount),
          createdAt: bet.createdAt.toISOString(),
        }));
        this.emitUserBetsUpdated(userId, betsPayload);
      } else {
        // Emit empty array to signal bets are loaded (even if empty)
        this.logger.log(`📡 [EventsGateway] Emitting initial user bets for ${userId} (0 bets)`);
        this.emitUserBetsUpdated(userId, []);
      }
    } catch (error) {
      this.logger.error(`📡 [EventsGateway] Error emitting initial data for ${userId}:`, error);
      // Don't throw - connection is still valid even if initial data fails
    }
  }
}

