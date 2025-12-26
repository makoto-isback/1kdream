import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import WebApp from '@twa-dev/sdk'; // Imported for SDK initialization side effects
import api from '../services/api';
import { usersService, User } from '../services/users';
import { socketService } from '../services/socket';
import { userDataSync } from '../services/userDataSync';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
  authError: string | null;
  login: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const login = async () => {
    try {
      const isDev = import.meta.env.DEV;

      // Detect Telegram Mini App
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      const hasTelegram = !!tg;
      const initData = tg?.initData || '';
      const initDataUnsafe = (tg as any)?.initDataUnsafe || {};

      // TEMP DEBUG: Always log auth bootstrap state
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('[AUTH BOOTSTRAP]', {
          hasTelegram,
          initDataLength: initData.length,
          initDataUnsafe,
        });
      }

      // If there is no Telegram context at all
      if (!hasTelegram) {
        if (isDev) {
          // LOCAL DEV MODE: Bypass Telegram and API, use mock user directly
          console.warn('🔧 LOCAL DEV MODE: Telegram WebApp not available, using mock user (NO API CALL)');
          const mockUser: User = {
            id: 'local-dev-user-id',
            telegramId: '123456789',
            firstName: 'Local',
            lastName: 'Dev',
            username: 'localdev',
            kyatBalance: 100000,
            points: 0,
            tonAddress: null,
            isAdmin: false,
            isActivated: false,
            activatedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          // Set mock user directly without API call
          setUser(mockUser);
          setAuthError(null);
          setIsAuthReady(true);
          // Don't connect socket in dev mode
          console.log('✅ LOCAL DEV: Mock user set, isAuthReady = true');
          return;
        } else {
          // Production: Telegram WebApp required
          console.error('[TG AUTH] ❌ Telegram WebApp context not detected');
          setAuthError('TELEGRAM_WEBAPP_REQUIRED');
          return;
        }
      }

      // Use Telegram initData string directly (may be empty in some environments)
      const response = await api.post('/auth/telegram', { initData });
      
      // Backend returns { access_token, user }
      const token = response.data?.access_token || response.data?.accessToken;
      
      if (token) {
        localStorage.setItem('token', token);
        const userData = response.data?.user;
        if (userData) {
          console.log('[AUTH] User data from backend:', { id: userData.id, isAdmin: userData.isAdmin, username: userData.username });
          setUser(userData);
        }
        setAuthError(null);
        setIsAuthReady(true);
        
        // Connect Socket.IO after successful login (singleton - only connects if not already connected)
        socketService.connect(token);
      } else {
        setAuthError('Authentication failed: No token received');
        setIsAuthReady(false);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle network/API errors - don't throw, just set error state
      if (error?.response?.status === 401) {
        setAuthError('TELEGRAM_WEBAPP_REQUIRED');
      } else {
        setAuthError(error?.message || 'Authentication failed');
      }
      
      // Don't throw - let the app continue and show error state
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    // Disconnect Socket.IO on logout
    socketService.disconnect();
  };

  // Immediate refresh (ONLY for critical initial auth - bypasses socket check)
  // BUT: Only allowed if socket is authenticated OR UserDataSync is empty
  const refreshUserImmediate = async () => {
    // Check if socket is authenticated OR UserDataSync has no user data
    const socketAuth = socketService.isSocketAuthenticated();
    const cachedUser = userDataSync.getData('user');
    
    // Only allow HTTP fetch if:
    // 1. Socket is authenticated (safe to fetch), OR
    // 2. UserDataSync is empty (need initial data)
    if (!socketAuth && cachedUser) {
      console.log('[AUTH] Skipping HTTP fetch - socket not authenticated and UserDataSync has cached user');
      // Use cached user from UserDataSync
      setUser(cachedUser);
      setAuthError(null);
      setIsAuthReady(true);
      return;
    }

    try {
      // Direct API call for initial auth only (bypasses UserDataSync socket check)
      const userData = await usersService.getMe();
      setUser(userData);
      setAuthError(null);
      setIsAuthReady(true);
      // Update UserDataSync
      userDataSync.updateUserFromSocket(userData);
    } catch (error: any) {
      console.error('[AUTH] Refresh user error:', error);
      // Don't logout immediately - let the interceptor handle 401
      // Only logout if it's not a 401 (might be network error)
      if (error?.response?.status !== 401) {
        logout();
      } else {
        // 401 - token invalid, but don't logout yet (will be handled by init)
        setAuthError('Session expired');
        setIsAuthReady(false);
      }
    }
  };

  // Refresh user (uses UserDataSync - socket-first, HTTP fallback only)
  const refreshUser = async () => {
    // Use UserDataSync which enforces socket-first rule
    await userDataSync.manualRefresh('user');
    // UserDataSync will update via subscription
  };

  // Subscribe to UserDataSync for user updates
  useEffect(() => {
    const unsubscribe = userDataSync.subscribe('user', (userData: User | null) => {
      if (userData) {
        console.log('[AUTH] User updated from UserDataSync');
        setUser(userData);
        setAuthError(null);
        setIsAuthReady(true);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 1; // Only retry once to prevent infinite loops

    const init = async () => {
      try {
        const existingToken = localStorage.getItem('token');

        if (existingToken) {
          try {
            // Use immediate refresh for initial auth (critical)
            await refreshUserImmediate();
            // Connect Socket.IO if we have a valid token (singleton - only connects once)
            socketService.connect(existingToken);
            if (isMounted) {
              setIsAuthReady(true);
              setAuthError(null);
            }
          } catch (error: any) {
            // Token invalid - try to login once
            if (isMounted && retryCount < MAX_RETRIES) {
              retryCount++;
              await login();
            } else {
              // Max retries reached - set error and stop
              if (isMounted) {
                setAuthError('Authentication failed. Please refresh the page.');
                setIsAuthReady(false);
              }
            }
          }
        } else {
          // No token - attempt login once
          await login();
          if (isMounted) {
            const finalToken = localStorage.getItem('token');
            setIsAuthReady(!!finalToken);
          }
        }
      } catch (err: any) {
        console.error('[AUTH] Auth init error:', err);
        if (isMounted) {
          // Set error but don't block app rendering
          setAuthError(err?.message || 'Authentication failed');
          setIsAuthReady(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthReady, authError, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
