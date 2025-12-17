import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

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
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

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
          return;
        }

        if (!userId) {
          throw new Error('Token missing userId (sub)');
        }

        client.userId = userId;
        this.connectedClients.set(client.id, client);
        this.logger.log(`Client ${client.id} connected (User: ${userId})`);

        // Send connection confirmation
        client.emit('connected', { userId });
      } catch (authError) {
        // DEV MODE: Allow connection even if token verification fails
        if (isDev) {
          this.logger.warn(`🔧 [DEV] Client ${client.id} authentication failed: ${authError.message} - allowing connection`);
          client.userId = 'DEV';
          this.connectedClients.set(client.id, client);
          client.emit('connected', { userId: 'DEV' });
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
      } else {
        this.logger.warn(`Client ${client.id} connection error: ${error.message}`);
        client.disconnect();
      }
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
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
   * Get count of connected clients
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }
}

