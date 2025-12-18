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
      
      // TEMP DEBUG: Log Telegram availability
      console.log('[TG AUTH] window.Telegram =', typeof window !== 'undefined' ? (window as any).Telegram : 'undefined');
      console.log('[TG AUTH] window.Telegram.WebApp =', typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : 'undefined');
      console.log('[TG AUTH] initData exists =', Boolean(typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData));
      
      // Detect Telegram Mini App
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      const initData = tg?.initData;
      
      if (!tg || !initData) {
        if (isDev) {
          // Mock Telegram user for local development
          console.warn('🔧 DEV MODE: Telegram WebApp not available, using mock user');
          const mockInitData = 'user=%7B%22id%22%3A123456789%7D&auth_date=' + Math.floor(Date.now() / 1000) + '&hash=mock-hash-dev';
          
          console.log('[TG AUTH] 🚀 Sending initData to backend /auth/telegram');
          const response = await api.post('/auth/telegram', { initData: mockInitData });
          console.log('[TG AUTH] ✅ Backend responded, JWT received');
          
          const token = response.data.accessToken || response.data.access_token;
          if (token) {
            localStorage.setItem('token', token);
            console.log('[TG AUTH] 🔐 JWT saved to localStorage');
            const userData = response.data.user;
            if (userData) {
              setUser(userData);
            }
            setAuthError(null);
            socketService.connect(token);
          }
          return;
        } else {
          // Production: Telegram WebApp required
          console.error('[TG AUTH] ❌ initData missing — app NOT running inside Telegram WebApp');
          setAuthError('TELEGRAM_WEBAPP_REQUIRED');
          return;
        }
      }

      // Use Telegram initData directly
      console.log('[TG AUTH] 🚀 Sending initData to backend /auth/telegram');
      
      const response = await api.post('/auth/telegram', { initData });
      console.log('[TG AUTH] ✅ Backend responded, JWT received');
      
      const token = response.data.accessToken || response.data.access_token;
      
      if (token) {
        localStorage.setItem('token', token);
        console.log('[TG AUTH] 🔐 JWT saved to localStorage');
        const userData = response.data.user;
        if (userData) {
          setUser(userData);
        }
        setAuthError(null);
        
        // Connect Socket.IO after successful login (singleton - only connects if not already connected)
        socketService.connect(token);
      } else {
        console.error('[TG AUTH] Auth failed: No access token in response');
        setAuthError('Authentication failed: No token received');
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
        console.log('JWT present:', Boolean(existingToken));

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
