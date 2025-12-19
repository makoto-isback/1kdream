import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import LotteryPage from './pages/LotteryPage';
import Deposit from './pages/Deposit';
import './styles/index.css';

function AppContent() {
  const { authError, loading: authLoading, isAuthReady, user } = useAuth();
  const isDev = import.meta.env.DEV;

  // TEMP DEBUG: High-signal logs for UI boot
  useEffect(() => {
    const hasTelegram = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
    console.log('[UI BOOT]', {
      authReady: isAuthReady,
      hasUser: !!user,
      telegram: hasTelegram,
      authError,
      authLoading,
    });
  }, [isAuthReady, user, authError, authLoading]);

  // CRITICAL FIX: Router must ALWAYS render, even with auth errors
  // The early return was preventing /deposit route from ever mounting
  // Individual pages can handle auth errors gracefully
  // This allows the Connect Wallet button to render regardless of auth state
  
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<LotteryPage />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

function App() {
  const [ready, setReady] = useState(false);
  const isDev = import.meta.env.DEV;

  // Isolate ALL Telegram WebView API calls to useEffect (never during render)
  useEffect(() => {
    if (isDev) {
      // In dev mode, skip Telegram SDK initialization
      console.warn('🔧 DEV MODE: Skipping Telegram SDK initialization');
      setReady(true);
      return;
    }

    // CRITICAL: All Telegram API calls must be inside useEffect/onMount
    // Never call Telegram APIs during render - this prevents WebView crashes
    try {
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      if (tg) {
        // Safe to call Telegram APIs here - we're in useEffect (onMount equivalent)
        tg.ready();
        tg.expand();
        
        // Optional: Set header color (fail silently if not supported)
        try {
          tg.setHeaderColor?.('#1a1a1a');
        } catch (e) {
          // Ignore - not all Telegram versions support this
        }
      }
    } catch (error) {
      // Telegram WebView API call failed - log but don't crash
      console.error('[App] Telegram WebView API error (non-fatal):', error);
      // Still mark as ready - app can function without Telegram UI features
    }

    setReady(true);
  }, [isDev]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-ios-bg-primary text-white font-sans flex items-center justify-center">
        <span className="text-ios-label-secondary">Loading...</span>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <WalletProvider>
          {isDev && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-ios-yellow text-black text-center py-1 text-xs font-bold">
              🔧 DEV MODE - Mock Telegram User
            </div>
          )}
          <AppContent />
        </WalletProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
