/**
 * UserDataSync Controller
 * 
 * SINGLE SOURCE OF TRUTH for all user data fetching
 * 
 * RULES:
 * 1. If socket is connected → HTTP fetches are DISABLED (socket is source of truth)
 * 2. HTTP is only a fallback when socket is disconnected
 * 3. All fetches go through global rate limiter (1 req per endpoint per 10s)
 * 4. Components/hooks may NOT call HTTP directly
 */

import { socketService } from './socket';
import { betsService, Bet } from './bets';
import { autobetService, AutoBetPlan } from './autobet';
import { usersService, User } from './users';
import { lotteryService, LotteryRound } from './lottery';
import { canMakeRequest, recordRequest, getTimeUntilNextRequest, normalizeEndpoint } from '../utils/globalRateLimiter';

interface UserDataState {
  user: User | null;
  bets: Bet[];
  autobetPlans: AutoBetPlan[];
  activeRound: LotteryRound | null;
  roundStats: any;
  lastSync: {
    user: number | null;
    bets: number | null;
    autobetPlans: number | null;
    activeRound: number | null;
    roundStats: number | null;
  };
}

type DataUpdateCallback = (data: any) => void;

class UserDataSyncController {
  private state: UserDataState = {
    user: null,
    bets: [],
    autobetPlans: [],
    activeRound: null,
    roundStats: null,
    lastSync: {
      user: null,
      bets: null,
      autobetPlans: null,
      activeRound: null,
      roundStats: null,
    },
  };

  private subscribers: Map<string, Set<DataUpdateCallback>> = new Map();
  private socketConnected = false;
  private hydratedOnce = false;
  private isHydratingFlag = false;
  private authReady = false;

  constructor() {
    // Monitor socket connection status
    this.setupSocketMonitoring();
    // Listen for socket authentication event
    this.setupSocketAuthListener();
    // Setup socket event listeners for user data updates
    this.setupSocketEventListeners();
  }

  /**
   * Monitor socket connection status
   */
  private setupSocketMonitoring(): void {
    // Check initial connection
    this.socketConnected = socketService.isConnected();
    
    // Note: We can't directly subscribe to socket connection events here
    // Components should call checkSocketStatus() before making requests
  }

  /**
   * Setup listener for socket authentication event
   */
  private setupSocketAuthListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('socket:authenticated', (event: any) => {
        const { userId } = event.detail || {};
        console.log('📡 [UserDataSync] Received socket:authenticated event, userId:', userId);
        this.hydrateAfterSocketAuth(userId);
      });
    }
  }

  /**
   * Setup socket event listeners for user data updates
   */
  private setupSocketEventListeners(): void {
    // Listen for user balance updates from socket
    socketService.onUserBalanceUpdated((data: { kyatBalance: number; points: number }) => {
      console.log('📡 [UserDataSync] Received user:balance:updated socket event', data);
      this.updateUserBalanceFromSocket(data.kyatBalance, data.points);
    });
  }

  /**
   * Check if currently hydrating
   */
  isHydrating(): boolean {
    return this.isHydratingFlag;
  }

  /**
   * Check if auth is ready
   */
  isAuthReady(): boolean {
    return this.authReady;
  }

  /**
   * Check if socket is connected
   */
  checkSocketStatus(): boolean {
    const wasConnected = this.socketConnected;
    this.socketConnected = socketService.isConnected();
    
    if (wasConnected !== this.socketConnected) {
      console.log(`🔌 [UserDataSync] Socket status changed: ${this.socketConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    }
    
    return this.socketConnected;
  }

  /**
   * Enforce socket-first rule: block HTTP if socket is connected
   * EXCEPT during controlled hydration after socket auth
   */
  private shouldBlockHttp(endpoint: string): boolean {
    // Allow HTTP during controlled hydration (one-time after socket auth)
    if (this.isHydratingFlag) {
      console.log(`✅ [UserDataSync] HTTP ALLOWED for ${endpoint} - Controlled hydration in progress`);
      return false;
    }
    
    const isConnected = this.checkSocketStatus();
    
    if (isConnected) {
      console.log(`🚫 [UserDataSync] HTTP BLOCKED for ${endpoint} - Socket is connected (socket-first rule)`);
      return true;
    }
    
    return false;
  }

  /**
   * Enforce global rate limiting
   */
  private shouldRateLimit(endpoint: string): boolean {
    const normalized = normalizeEndpoint(endpoint);
    
    if (!canMakeRequest(normalized)) {
      const waitTime = getTimeUntilNextRequest(normalized);
      console.log(`⏸️ [UserDataSync] RATE LIMITED for ${endpoint} - Wait ${waitTime}ms (global rate limiter)`);
      return true;
    }
    
    return false;
  }

  /**
   * Make HTTP request with all guards
   */
  private async makeHttpRequest<T>(
    endpoint: string,
    requestFn: () => Promise<T>,
    dataType: string
  ): Promise<T | null> {
    // Guard 1: Socket-first rule
    if (this.shouldBlockHttp(endpoint)) {
      console.log(`📡 [UserDataSync] Using socket data for ${dataType} (HTTP disabled)`);
      return null;
    }

    // Guard 2: Global rate limiter
    if (this.shouldRateLimit(endpoint)) {
      console.log(`⏸️ [UserDataSync] Rate limited for ${dataType}, using cached data`);
      return null;
    }

    // Make request
    try {
      console.log(`🌐 [UserDataSync] Making HTTP request for ${dataType} (socket disconnected, fallback mode)`);
      const normalized = normalizeEndpoint(endpoint);
      recordRequest(normalized);
      const result = await requestFn();
      console.log(`✅ [UserDataSync] HTTP request succeeded for ${dataType}`);
      return result;
    } catch (error: any) {
      console.error(`❌ [UserDataSync] HTTP request failed for ${dataType}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to data updates
   */
  subscribe(dataType: string, callback: DataUpdateCallback): () => void {
    if (!this.subscribers.has(dataType)) {
      this.subscribers.set(dataType, new Set());
    }
    this.subscribers.get(dataType)!.add(callback);

    // Immediately call with current state
    const currentData = this.getData(dataType);
    if (currentData !== null) {
      callback(currentData);
    }

    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(dataType);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscribers.delete(dataType);
        }
      }
    };
  }

  /**
   * Notify subscribers of data updates
   */
  private notifySubscribers(dataType: string, data: any): void {
    const subscribers = this.subscribers.get(dataType);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[UserDataSync] Error in subscriber callback for ${dataType}:`, error);
        }
      });
    }
  }

  /**
   * Update state and notify subscribers
   */
  private updateState(dataType: keyof UserDataState, data: any): void {
    (this.state as any)[dataType] = data;
    this.state.lastSync[dataType as keyof typeof this.state.lastSync] = Date.now();
    this.notifySubscribers(dataType, data);
  }

  /**
   * Get current data
   */
  getData(dataType: string): any {
    return (this.state as any)[dataType] ?? null;
  }

  /**
   * Get user data (convenience method)
   */
  getUser(): User | null {
    return this.state.user;
  }

  /**
   * Hydrate user data ONCE after socket authentication succeeds
   * Socket-only: NO HTTP calls to /users/me
   * User data comes from socket auth payload and socket events
   */
  async hydrateAfterSocketAuth(userId: string): Promise<void> {
    // Check if already hydrated
    if (this.hydratedOnce) {
      console.log('[UserDataSync] Already hydrated, skipping');
      return;
    }

    // Check if socket is authenticated
    if (!socketService.isSocketAuthenticated()) {
      console.warn('[UserDataSync] Socket not authenticated, cannot hydrate');
      return;
    }

    if (!userId) {
      console.warn('[UserDataSync] No userId provided, cannot hydrate');
      return;
    }

    console.log('📡 [UserDataSync] Hydrating after socket auth (socket-only, no HTTP)');

    try {
      // Create minimal user object from socket auth payload
      // Balance will be populated via socket events (user:balance:updated)
      const initialUser: User = {
        id: userId,
        telegramId: '', // Will be populated by socket events if needed
        username: null,
        firstName: null,
        lastName: null,
        kyatBalance: 0, // Will be updated via user:balance:updated socket event
        points: 0, // Will be updated via user:balance:updated socket event
        tonAddress: null,
        isAdmin: false, // Will be updated via socket events if needed
        isActivated: false,
        activatedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.updateState('user', initialUser);
      console.log('✅ [UserDataSync] Initial user state seeded from socket auth (userId:', userId, ')');

      // Mark as hydrated
      this.hydratedOnce = true;
      this.authReady = true;
      console.log('✅ [UserDataSync] Hydration complete, authReady = true (socket-only)');

      // Notify subscribers that auth is ready
      this.notifySubscribers('authReady', true);
    } catch (error: any) {
      console.error('[UserDataSync] Hydration failed:', error);
      // Don't mark as hydrated on error - allow retry on next socket auth
    }
  }

  /**
   * Sync user data (HTTP fallback only)
   * NOTE: /users/me is permanently blocked - socket is the single source of truth
   */
  async syncUser(): Promise<User | null> {
    console.warn('[UserDataSync] syncUser() called but /users/me is permanently blocked (socket-only auth)');
    return null;
  }

  /**
   * Sync user bets (HTTP fallback only)
   */
  async syncBets(limit: number = 100): Promise<Bet[] | null> {
    return this.makeHttpRequest(
      `/bets/my?limit=${limit}`,
      () => betsService.getUserBets(limit),
      'bets'
    );
  }

  /**
   * Sync autobet plans (HTTP fallback only)
   */
  async syncAutobetPlans(): Promise<AutoBetPlan[] | null> {
    return this.makeHttpRequest(
      '/autobet/my',
      () => autobetService.getUserPlans(),
      'autobetPlans'
    );
  }

  /**
   * Sync active round (HTTP fallback only)
   */
  async syncActiveRound(): Promise<LotteryRound | null> {
    return this.makeHttpRequest(
      '/lottery/active',
      () => lotteryService.getActiveRound(),
      'activeRound'
    );
  }

  /**
   * Sync round stats (HTTP fallback only)
   */
  async syncRoundStats(roundId: string): Promise<any | null> {
    return this.makeHttpRequest(
      `/lottery/round/${roundId}/stats`,
      () => lotteryService.getRoundStats(roundId),
      'roundStats'
    );
  }

  /**
   * Update user from socket event
   */
  updateUserFromSocket(user: User): void {
    console.log('📡 [UserDataSync] Updating user from socket (socket-first)');
    this.updateState('user', user);
  }

  /**
   * Update user balance from socket event (partial update)
   */
  updateUserBalanceFromSocket(kyatBalance: number, points: number): void {
    console.log('📡 [UserDataSync] Updating user balance from socket (socket-first)');
    const currentUser = this.state.user;
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        kyatBalance,
        points,
      };
      this.updateState('user', updatedUser);
    }
  }

  /**
   * Update bets from socket event
   */
  updateBetsFromSocket(bets: Bet[]): void {
    console.log('📡 [UserDataSync] Updating bets from socket (socket-first)');
    this.updateState('bets', bets);
  }

  /**
   * Update autobet plans from socket event
   */
  updateAutobetPlansFromSocket(plans: AutoBetPlan[]): void {
    console.log('📡 [UserDataSync] Updating autobet plans from socket (socket-first)');
    this.updateState('autobetPlans', plans);
  }

  /**
   * Update active round from socket event
   */
  updateActiveRoundFromSocket(round: LotteryRound): void {
    console.log('📡 [UserDataSync] Updating active round from socket (socket-first)');
    this.updateState('activeRound', round);
  }

  /**
   * Update round stats from socket event
   */
  updateRoundStatsFromSocket(roundId: string, stats: any): void {
    console.log(`📡 [UserDataSync] Updating round stats from socket (socket-first) for round ${roundId}`);
    this.updateState('roundStats', { roundId, stats });
  }

  /**
   * Manual refresh (bypasses socket check, for user-initiated actions)
   */
  async manualRefresh(dataType: 'user' | 'bets' | 'autobetPlans' | 'activeRound'): Promise<void> {
    console.log(`🔄 [UserDataSync] Manual refresh requested for ${dataType}`);
    
    // Temporarily allow HTTP even if socket is connected (user-initiated)
    const wasBlocked = this.socketConnected;
    this.socketConnected = false; // Temporarily disable socket check
    
    try {
      switch (dataType) {
        case 'user':
          const user = await this.syncUser();
          if (user) this.updateState('user', user);
          break;
        case 'bets':
          const bets = await this.syncBets();
          if (bets) this.updateState('bets', bets);
          break;
        case 'autobetPlans':
          const plans = await this.syncAutobetPlans();
          if (plans) this.updateState('autobetPlans', plans);
          break;
        case 'activeRound':
          const round = await this.syncActiveRound();
          if (round) this.updateState('activeRound', round);
          break;
      }
    } finally {
      // Restore socket check
      this.socketConnected = wasBlocked;
    }
  }
}

// Singleton instance
export const userDataSync = new UserDataSyncController();

