import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { AuthProvider } from './contexts/AuthContext';
import LotteryPage from './pages/LotteryPage';
import './styles/index.css';

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
      {isDev && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-ios-yellow text-black text-center py-1 text-xs font-bold">
          🔧 DEV MODE - Mock Telegram User
        </div>
      )}
      <Router>
        <Routes>
          <Route path="/" element={<LotteryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
