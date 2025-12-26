import { io, Socket } from 'socket.io-client';

export interface RoundCompletedEvent {
  roundId: string;
  roundNumber: number;
  winningBlock: number;
  status: string;
  totalPool: number;
  winnerPool: number;
  drawnAt: string;
  timestamp: string;
}

export interface BetPlacedEvent {
  roundId: string;
  blockNumber: number;
  amount: number;
  totalPool: number;
  winnerPool: number;
  adminFee: number;
  blockStats: Array<{ blockNumber: number; totalBets: number; totalAmount: number }>;
  timestamp: string;
}

export interface RoundStatsUpdatedEvent {
  roundId: string;
  blockStats: Array<{ blockNumber: number; totalBets: number; totalAmount: number }>;
  timestamp: string;
}

export interface ActiveRoundUpdatedEvent {
  id: string;
  roundNumber: number;
  status: string;
  totalPool: number;
  winnerPool: number;
  adminFee: number;
  totalBets: number;
  drawTime: string;
  winningBlock: number | null;
  drawnAt: string | null;
  timestamp: string;
}

export interface UserBalanceUpdatedEvent {
  kyatBalance: number;
  points: number;
  timestamp: string;
}

export interface UsdtDepositConfirmedEvent {
  depositId: string;
  usdtAmount: number;
  kyatAmount: number;
  txHash: string;
  createdAt: string;
}

export interface UsdtWithdrawalCreatedEvent {
  withdrawalId: string;
  kyatAmount: number;
  usdtAmount: number;
  tonAddress: string;
  executeAfter: string;
  createdAt: string;
}

export interface UsdtWithdrawalSentEvent {
  withdrawalId: string;
  kyatAmount: number;
  usdtAmount: number;
  tonAddress: string;
  tonTxHash: string;
  sentAt: string;
}

type PendingSubscription = {
  event: string;
  handler: (...args: any[]) => void;
  unsubscribe: () => void;
};

class SocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionToken: string | null = null;
  private pendingSubscriptions: Map<string, Set<PendingSubscription>> = new Map();
  private activeSubscriptions: Map<string, Set<(...args: any[]) => void>> = new Map();

  /**
   * Connect Socket.IO - SINGLETON PATTERN
   * Only one connection allowed at any time
   * Must be called with a valid token
   */
  connect(token: string): void {
    // Guard: Already connected with same token
    if (this.socket?.connected && this.connectionToken === token) {
      console.log('🔌 [Socket] ✅ Already connected with same token');
      return;
    }

    // Guard: Currently connecting
    if (this.isConnecting) {
      console.log('🔌 [Socket] ⚠️ Connection already in progress, skipping');
      return;
    }

    // Guard: Socket exists but disconnected - clean it up first
    if (this.socket && !this.socket.connected) {
      console.log('🔌 [Socket] 🧹 Cleaning up disconnected socket');
      this.socket.removeAllListeners();
      this.socket = null;
    }

    // Guard: Socket exists but token changed - disconnect old connection
    if (this.socket?.connected && this.connectionToken !== token) {
      console.log('🔌 [Socket] 🔄 Token changed, disconnecting old connection');
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }

    // Guard: Already connected with different token - skip
    if (this.socket?.connected) {
      console.log('🔌 [Socket] ⚠️ Already connected, skipping');
      return;
    }

    this.isConnecting = true;
    this.connectionToken = token;
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    console.log('🔌 [Socket] 🚀 Connecting to', `${backendUrl}/events`);

    this.socket = io(`${backendUrl}/events`, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      forceNew: false, // Reuse existing connection if available
    });

    // DEBUG: Log ALL socket events
    this.socket.onAny((event, ...args) => {
      console.log(`[SOCKET EVENT] ${event}`, args);
    });

    this.socket.on('connect', () => {
      console.log('🔌 [Socket] ✅ CONNECTED - Socket ID:', this.socket?.id);
      console.log('🔌 [Socket] Connection URL:', `${backendUrl}/events`);
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      // Authentication confirmation comes via 'connected' event
      // Do NOT attach subscriptions here - wait for auth confirmation
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket] ❌ DISCONNECTED - Reason:', reason);
      console.log('🔌 [Socket] Socket ID was:', this.socket?.id);
      this.isConnecting = false;
      this.isAuthenticated = false; // Reset auth state on disconnect
      
      // Clear token if disconnect was intentional
      if (reason === 'io client disconnect') {
        this.connectionToken = null;
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 [Socket] ❌ Connection error:', error.message);
      this.isConnecting = false;
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('🔌 [Socket] ⚠️ Max reconnection attempts reached');
        this.connectionToken = null;
      }
    });

    this.socket.on('connected', (data: { userId: string }) => {
      console.log('🔌 [Socket] ✅ Authenticated as user:', data.userId);
      this.isAuthenticated = true;
      
      // Authentication complete - NOW attach pending subscriptions
      this.attachPendingSubscriptions();
      
      // Emit socket:authenticated event for hydration trigger
      console.log('🔌 [Socket] 🚀 Emitting socket:authenticated event');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('socket:authenticated', { detail: { userId: data.userId } }));
      }
    });
  }

  /**
   * Disconnect Socket.IO - Clean disconnect
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 [Socket] 🔌 Disconnecting...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.connectionToken = null;
      this.isConnecting = false;
      this.isAuthenticated = false;
      this.reconnectAttempts = 0;
      // Clear active subscriptions but keep pending ones (they'll reattach on reconnect)
      this.activeSubscriptions.clear();
      console.log('🔌 [Socket] ✅ Disconnected and cleaned up');
    }
  }

  /**
   * Attach all pending subscriptions to the connected socket
   * Only called after authentication succeeds
   */
  private attachPendingSubscriptions(): void {
    if (!this.socket?.connected || !this.isAuthenticated) {
      console.log('🔌 [Socket] ⚠️ Cannot attach subscriptions: socket not authenticated');
      return;
    }

    console.log('🔌 [Socket] 🔐 Socket authenticated — attaching pending subscriptions');
    let attachedCount = 0;

    this.pendingSubscriptions.forEach((subscriptions, event) => {
      subscriptions.forEach((pending) => {
        // Check if already subscribed (prevent duplicates)
        if (!this.activeSubscriptions.has(event)) {
          this.activeSubscriptions.set(event, new Set());
        }

        const activeHandlers = this.activeSubscriptions.get(event)!;
        
        // Prevent duplicate subscriptions
        if (!activeHandlers.has(pending.handler)) {
          this.socket!.on(event, pending.handler);
          activeHandlers.add(pending.handler);
          attachedCount++;
        }
      });
    });

    // Clear pending subscriptions after attaching
    this.pendingSubscriptions.clear();
    console.log(`🔌 [Socket] ✅ Attached ${attachedCount} pending subscription(s)`);
  }

  /**
   * Subscribe to round:completed events
   * Returns unsubscribe function
   * Works whether called before or after connection
   * Never duplicates subscriptions
   */
  onRoundCompleted(callback: (data: RoundCompletedEvent) => void): () => void {
    const event = 'round:completed';
    
    const eventHandler = (data: RoundCompletedEvent) => {
      console.log('🔌 [Socket] 🎯 RECEIVED round:completed event');
      console.log('🔌 [Socket] Raw payload:', JSON.stringify(data, null, 2));
      callback(data);
    };

    // If socket is connected AND authenticated, subscribe immediately
    if (this.socket?.connected && this.isAuthenticated) {
      // Check for duplicates
      if (this.activeSubscriptions.has(event)) {
        const activeHandlers = this.activeSubscriptions.get(event)!;
        if (activeHandlers.has(eventHandler)) {
          console.log('🔌 [Socket] ⚠️ Subscription already active, skipping duplicate');
          return () => {
            this.unsubscribe(event, eventHandler);
          };
        }
      }

      console.log('🔌 [Socket] 📡 Subscribing to round:completed event (socket connected)');
      
      if (!this.activeSubscriptions.has(event)) {
        this.activeSubscriptions.set(event, new Set());
      }
      this.activeSubscriptions.get(event)!.add(eventHandler);
      this.socket.on(event, eventHandler);

      return () => {
        this.unsubscribe(event, eventHandler);
      };
    }

    // Socket not connected - queue subscription
    console.log('🔌 [Socket] 🕒 Socket not connected yet — subscription queued');
    
    if (!this.pendingSubscriptions.has(event)) {
      this.pendingSubscriptions.set(event, new Set());
    }

    const pendingSub: PendingSubscription = {
      event,
      handler: eventHandler,
      unsubscribe: () => {
        // Remove from pending subscriptions
        const pending = this.pendingSubscriptions.get(event);
        if (pending) {
          pending.delete(pendingSub);
          if (pending.size === 0) {
            this.pendingSubscriptions.delete(event);
          }
        }
        // Remove from active subscriptions if already attached
        this.unsubscribe(event, eventHandler);
      },
    };

    this.pendingSubscriptions.get(event)!.add(pendingSub);

    return pendingSub.unsubscribe;
  }

  /**
   * Unsubscribe from an event
   */
  private unsubscribe(event: string, handler: (...args: any[]) => void): void {
    // Remove from active subscriptions
    const activeHandlers = this.activeSubscriptions.get(event);
    if (activeHandlers) {
      activeHandlers.delete(handler);
      if (activeHandlers.size === 0) {
        this.activeSubscriptions.delete(event);
      }
    }

    // Remove from socket
    if (this.socket) {
      console.log(`🔌 [Socket] 🧹 Unsubscribing from ${event}`);
      this.socket.off(event, handler);
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Check if socket is authenticated
   */
  isSocketAuthenticated(): boolean {
    return this.isAuthenticated && this.socket?.connected || false;
  }

  /**
   * Subscribe to usdt_deposit_confirmed events
   */
  onUsdtDepositConfirmed(callback: (data: UsdtDepositConfirmedEvent) => void): () => void {
    const event = 'usdt_deposit_confirmed';
    return this.subscribeToEvent(event, callback);
  }

  /**
   * Subscribe to usdt_withdrawal_created events
   */
  onUsdtWithdrawalCreated(callback: (data: UsdtWithdrawalCreatedEvent) => void): () => void {
    const event = 'usdt_withdrawal_created';
    return this.subscribeToEvent(event, callback);
  }

  /**
   * Subscribe to usdt_withdrawal_sent events
   */
  onUsdtWithdrawalSent(callback: (data: UsdtWithdrawalSentEvent) => void): () => void {
    const event = 'usdt_withdrawal_sent';
    return this.subscribeToEvent(event, callback);
  }

  /**
   * Subscribe to bet:placed events
   */
  onBetPlaced(callback: (data: BetPlacedEvent) => void): () => void {
    const event = 'bet:placed';
    return this.subscribeToEvent(event, callback);
  }

  /**
   * Subscribe to round:stats:updated events
   */
  onRoundStatsUpdated(callback: (data: RoundStatsUpdatedEvent) => void): () => void {
    const event = 'round:stats:updated';
    return this.subscribeToEvent(event, callback);
  }

  /**
   * Subscribe to round:active:updated events
   */
  onActiveRoundUpdated(callback: (data: ActiveRoundUpdatedEvent) => void): () => void {
    const event = 'round:active:updated';
    return this.subscribeToEvent(event, callback);
  }

  /**
   * Subscribe to user:balance:updated events
   */
  onUserBalanceUpdated(callback: (data: UserBalanceUpdatedEvent) => void): () => void {
    const event = 'user:balance:updated';
    return this.subscribeToEvent(event, callback);
  }

  /**
   * Subscribe to user:bets:updated events
   */
  onUserBetsUpdated(callback: (data: { bets: any[] }) => void): () => void {
    const event = 'user:bets:updated';
    return this.subscribeToEvent(event, callback);
  }

  /**
   * Generic event subscription helper
   */
  private subscribeToEvent(event: string, callback: (...args: any[]) => void): () => void {
    const eventHandler = (data: any) => {
      console.log(`🔌 [Socket] 🎯 RECEIVED ${event} event`, data);
      callback(data);
    };

    if (this.socket?.connected && this.isAuthenticated) {
      if (this.activeSubscriptions.has(event)) {
        const activeHandlers = this.activeSubscriptions.get(event)!;
        if (activeHandlers.has(eventHandler)) {
          return () => this.unsubscribe(event, eventHandler);
        }
      }

      if (!this.activeSubscriptions.has(event)) {
        this.activeSubscriptions.set(event, new Set());
      }
      this.activeSubscriptions.get(event)!.add(eventHandler);
      this.socket.on(event, eventHandler);

      return () => this.unsubscribe(event, eventHandler);
    }

    // Queue subscription
    if (!this.pendingSubscriptions.has(event)) {
      this.pendingSubscriptions.set(event, new Set());
    }

    const pendingSub: PendingSubscription = {
      event,
      handler: eventHandler,
      unsubscribe: () => {
        const pending = this.pendingSubscriptions.get(event);
        if (pending) {
          pending.delete(pendingSub);
          if (pending.size === 0) {
            this.pendingSubscriptions.delete(event);
          }
        }
        this.unsubscribe(event, eventHandler);
      },
    };

    this.pendingSubscriptions.get(event)!.add(pendingSub);
    return pendingSub.unsubscribe;
  }

  /**
   * Get current socket instance (read-only)
   * For debugging purposes
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();

