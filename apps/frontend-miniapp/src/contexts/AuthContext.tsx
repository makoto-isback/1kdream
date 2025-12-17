import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import WebApp from '@twa-dev/sdk';
import api from '../services/api';
import { usersService, User } from '../services/users';
import { socketService } from '../services/socket';

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
      
      // Safe Telegram WebApp detection - tolerant and non-throwing
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      
      if (!tg) {
        if (isDev) {
          // Mock Telegram user for local development
          console.warn('🔧 DEV MODE: Telegram WebApp not available, using mock user');
          const telegramData = {
            id: '123456789',
            first_name: 'Dev',
            last_name: 'User',
            username: 'devuser',
            auth_date: Math.floor(Date.now() / 1000),
            hash: 'mock-hash-dev',
          };
          
          const response = await api.post('/auth/telegram', telegramData);
          const { access_token, user: userData } = response.data;
          localStorage.setItem('token', access_token);
          setUser(userData);
          setAuthError(null);
          socketService.connect(access_token);
          return;
        } else {
          // Production: Telegram WebApp not available yet, wait
          console.warn('Telegram WebApp not available yet');
          setAuthError('TELEGRAM_WEBAPP_REQUIRED');
          return; // Do NOT throw - just wait
        }
      }

      const user = tg.initDataUnsafe?.user;
      
      if (!user) {
        if (isDev) {
          // Mock Telegram user for local development
          console.warn('🔧 DEV MODE: Telegram user data not ready, using mock user');
          const telegramData = {
            id: '123456789',
            first_name: 'Dev',
            last_name: 'User',
            username: 'devuser',
            auth_date: Math.floor(Date.now() / 1000),
            hash: 'mock-hash-dev',
          };
          
          const response = await api.post('/auth/telegram', telegramData);
          const { access_token, user: userData } = response.data;
          localStorage.setItem('token', access_token);
          setUser(userData);
          setAuthError(null);
          socketService.connect(access_token);
          return;
        } else {
          // Production: User data not ready yet, wait
          console.warn('Telegram user data not ready yet');
          setAuthError('TELEGRAM_WEBAPP_REQUIRED');
          return; // Do NOT throw - just wait
        }
      }

      // Normal auth flow with Telegram user data
      const telegramData = {
        id: user.id.toString(),
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        auth_date: tg.initDataUnsafe.auth_date,
        hash: tg.initDataUnsafe.hash || '',
      };

      const response = await api.post('/auth/telegram', {
        id: telegramData.id,
        first_name: telegramData.first_name,
        last_name: telegramData.last_name,
        username: telegramData.username,
        auth_date: telegramData.auth_date,
        hash: telegramData.hash,
      });

      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      setUser(userData);
      setAuthError(null);
      
      // Connect Socket.IO after successful login (singleton - only connects if not already connected)
      socketService.connect(access_token);
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

  const refreshUser = async () => {
    try {
      const userData = await usersService.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Refresh user error:', error);
      logout();
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const existingToken = localStorage.getItem('token');

        if (existingToken) {
          try {
            await refreshUser();
            // Connect Socket.IO if we have a valid token (singleton - only connects once)
            socketService.connect(existingToken);
          } catch {
            // Token invalid, try to login again
            await login();
          }
        } else {
          await login();
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
        // Auth is considered "ready" only once we've attempted login/refresh
        // and we have a token stored (successful auth).
        const finalToken = localStorage.getItem('token');
        setIsAuthReady(!!finalToken);
        
        // Socket.IO connection is handled in login() or refreshUser() above
        // No need to connect again here - singleton pattern prevents duplicates
      }
    };

    init();
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
