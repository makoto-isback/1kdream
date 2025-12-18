import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import LotteryPage from './pages/LotteryPage';
import './styles/index.css';

function AppContent() {
  const { authError } = useAuth();
  const isDev = import.meta.env.DEV;

  // Show Telegram WebApp required message in production
  if (authError === 'TELEGRAM_WEBAPP_REQUIRED' && !isDev) {
    return (
      <div className="min-h-screen bg-ios-bg-primary text-white font-sans flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">📱</div>
          <h1 className="text-2xl font-bold mb-4">Telegram Mini App Required</h1>
          <p className="text-ios-label-secondary mb-6">
            This application must be opened from within Telegram. Please open this link from a Telegram bot or channel.
          </p>
          <p className="text-sm text-ios-label-secondary">
            If you're already in Telegram, try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LotteryPage />} />
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
