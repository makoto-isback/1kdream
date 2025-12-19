import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import LotteryPage from './pages/LotteryPage';
import Deposit from './pages/Deposit';
import './styles/index.css';

function AppContent() {
  const { authError, loading: authLoading } = useAuth();
  const isDev = import.meta.env.DEV;

  // DEBUG: Log auth state
  useEffect(() => {
    console.log('[AppContent] Auth state:', { authError, authLoading, isDev });
  }, [authError, authLoading, isDev]);

  // CRITICAL FIX: Router must ALWAYS render, even with auth errors
  // The early return was preventing /deposit route from ever mounting
  // Individual pages can handle auth errors gracefully
  // This allows the Connect Wallet button to render regardless of auth state
  
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LotteryPage />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  const [ready, setReady] = useState(false);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (isDev) {
      // In dev mode, skip Telegram SDK initialization
      console.warn('🔧 DEV MODE: Skipping Telegram SDK initialization');
      setReady(true);
    } else {
      WebApp.ready();
      WebApp.expand();
      setReady(true);
    }
  }, [isDev]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-ios-bg-primary text-white font-sans flex items-center justify-center">
        <span className="text-ios-label-secondary">Loading...</span>
      </div>
    );
  }

  return (
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
  );
}

export default App;
