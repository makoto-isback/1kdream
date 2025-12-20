import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useWallet } from '../contexts/WalletContext';
import { useClientReady } from '../hooks/useClientReady';
import { kyatToUsdt } from '../hooks/useUsdtWallet';
import '../styles/Withdraw.css';

// Contact Support helper
const handleContactSupport = () => {
  const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
  if (tg) {
    // Use Telegram Mini App method
    tg.openTelegramLink('https://t.me/onekadmin');
  } else {
    // Fallback for non-Telegram environments
    window.open('https://t.me/onekadmin', '_blank');
  }
};

export default function Withdraw() {
  console.log('🔥 RENDERING FILE: apps/frontend-miniapp/src/pages/Withdraw.tsx');
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const { t } = useTranslation();
  const isClientReady = useClientReady();
  
  // Wallet context - defensive access
  let walletContext;
  try {
    walletContext = useWallet();
  } catch (error) {
    console.error('[Withdraw] Wallet context error (non-fatal):', error);
    walletContext = {
      isWalletConnected: false,
      walletAddress: null,
      connectWallet: async () => {},
      isLoading: false,
      isTelegramContext: null,
    };
  }

  const { 
    isWalletConnected, 
    walletAddress, 
    connectWallet, 
    isLoading: walletLoading,
    isTelegramContext,
  } = walletContext;

  const [kyatAmount, setKyatAmount] = useState('');
  const [usdtAmount, setUsdtAmount] = useState('');
  const [tonAddress, setTonAddress] = useState('');

  // Debug log when wallet UI renders
  useEffect(() => {
    const shouldRender = isAuthReady && !!user;
    if (shouldRender) {
      console.log('[WALLET UI v2] rendered');
    }
  }, [isAuthReady, user]);

  // Helper to shorten wallet address
  const shortenAddress = (address: string | null): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (err: any) {
      console.error('[Withdraw] Wallet connection error:', err);
    }
  };

  // Sync USDT amount when KYAT changes
  useEffect(() => {
    if (kyatAmount) {
      const amount = parseFloat(kyatAmount);
      if (!isNaN(amount) && amount > 0) {
        setUsdtAmount(kyatToUsdt(amount).toFixed(6));
      } else {
        setUsdtAmount('');
      }
    } else {
      setUsdtAmount('');
    }
  }, [kyatAmount]);

  // Sync KYAT amount when USDT changes
  useEffect(() => {
    if (usdtAmount) {
      const amount = parseFloat(usdtAmount);
      if (!isNaN(amount) && amount > 0) {
        setKyatAmount((amount * 5000).toFixed(0));
      } else {
        setKyatAmount('');
      }
    } else {
      setKyatAmount('');
    }
  }, [usdtAmount]);

  // CRITICAL: Wallet UI must render ONLY when isAuthReady === true && user !== null
  const shouldRenderWalletUI = isAuthReady && !!user;

  // Show loading ONLY before auth is ready or client not ready
  if (!isClientReady) {
    return (
      <div className="withdraw">
        <div className="container">
          <div className="header">
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1>{t('withdraw.title')}</h1>
          </div>
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p>Loading wallet...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If auth not ready yet, show minimal loading
  if (!shouldRenderWalletUI) {
    return (
      <div className="withdraw">
        <div className="container">
          <div className="header">
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h1>{t('withdraw.title')}</h1>
          </div>
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p>Authenticating...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CRITICAL: Once auth is ready and user exists, ALWAYS render wallet UI
  return (
    <div className="withdraw">
      {/* LOCAL DEBUG MARKER - ALWAYS VISIBLE */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        background: 'red',
        color: 'white',
        padding: '6px 10px',
        fontWeight: 'bold',
        fontSize: '14px',
        width: '100%',
        textAlign: 'center',
        boxSizing: 'border-box'
      }}>
        LOCAL UI TEST – WALLET UI v2
      </div>
      <div className="container" style={{ marginTop: '40px' }}>
        <div className="header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>{t('withdraw.title')}</h1>
        </div>

        {/* Debug label */}
        <div style={{ 
          textAlign: 'center', 
          padding: '4px 8px', 
          fontSize: '10px', 
          color: '#666', 
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          marginBottom: '8px'
        }}>
          Wallet UI v2 – Support-assisted
        </div>

        <div className="balance-card">
          <span>{t('home.balance')}</span>
          <span className="balance-value">
            {user ? Number(user.kyatBalance).toLocaleString() : 0} KYAT
          </span>
        </div>

        {/* Telegram WebApp Required Warning - informational only */}
        {isTelegramContext === false && (
          <div className="form-card" style={{ borderColor: '#ff6b6b', background: '#2a1a1a' }}>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
              <h3 style={{ marginBottom: '12px', color: '#ff6b6b' }}>Telegram Mini App Required</h3>
              <p style={{ marginBottom: '16px', color: '#ccc', fontSize: '14px' }}>
                TON Connect wallet features require the Telegram Mini App environment.
              </p>
            </div>
          </div>
        )}

        {/* Wallet Connection Check */}
        {!isWalletConnected && (
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: '16px' }}>Connect your TON wallet to withdraw</p>
              <button
                className="btn btn-primary"
                onClick={handleConnectWallet}
                disabled={walletLoading}
              >
                {walletLoading ? t('common.loading') : 'Connect Wallet'}
              </button>
              <p style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
                Go to Deposit page to connect wallet
              </p>
            </div>
          </div>
        )}

        {/* Withdrawal Form - Simple input fields */}
        {isWalletConnected && (
          <>
            {walletAddress && (
              <div className="form-card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Connected Wallet:</span>
                  <code style={{ fontSize: '12px' }}>{shortenAddress(walletAddress)}</code>
                </div>
              </div>
            )}

            <div className="form-card">
              <label>{t('withdraw.amount')} (KYAT)</label>
              <input
                type="number"
                className="input"
                value={kyatAmount}
                onChange={(e) => setKyatAmount(e.target.value)}
                placeholder="5000"
                min="0"
                step="1000"
              />
              {kyatAmount && (
                <div className="usdt-amount" style={{ marginTop: '8px', color: '#999' }}>
                  = {usdtAmount} USDT
                </div>
              )}
            </div>

            <div className="form-card">
              <label>Amount (USDT)</label>
              <input
                type="number"
                className="input"
                value={usdtAmount}
                onChange={(e) => setUsdtAmount(e.target.value)}
                placeholder="1.0"
                min="0"
                step="0.000001"
              />
              {usdtAmount && (
                <div className="usdt-amount" style={{ marginTop: '8px', color: '#999' }}>
                  = {kyatAmount} KYAT
                </div>
              )}
            </div>

            <div className="form-card">
              <label>{t('withdraw.tonAddress')}</label>
              <input
                type="text"
                className="input"
                value={tonAddress}
                onChange={(e) => setTonAddress(e.target.value)}
                placeholder="Enter TON address"
              />
            </div>

            <div className="form-card" style={{ background: '#fff3cd', border: '1px solid #ffc107', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                ℹ️ Support-Assisted Withdrawal
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Enter the amount and TON address, then contact support to complete the withdrawal.
              </div>
            </div>

            <div className="rate-info" style={{ marginTop: '8px', marginBottom: '16px', textAlign: 'center' }}>
              1 USDT = 5,000 KYAT
            </div>

            {/* Contact Support Button */}
            <button
              className="btn btn-primary"
              onClick={handleContactSupport}
              style={{ width: '100%' }}
            >
              Contact Support
            </button>
          </>
        )}
      </div>
    </div>
  );
}
