import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useUsdtWallet, kyatToUsdt } from '../hooks/useUsdtWallet';
import { useWallet } from '../contexts/WalletContext';
import { activationService } from '../services/activation';
import { useClientReady } from '../hooks/useClientReady';
import { ErrorBoundary } from '../components/ErrorBoundary';
import api from '../services/api';
import '../styles/Deposit.css';

export default function Deposit() {
  const navigate = useNavigate();
  const { user, refreshUser, isAuthReady } = useAuth();
  const { t } = useTranslation();
  const isClientReady = useClientReady();
  
  // Defensive: Wrap wallet context access in try/catch
  let walletContext;
  try {
    walletContext = useWallet();
  } catch (error) {
    console.error('[Deposit] Wallet context error (non-fatal):', error);
    // Provide fallback values
    walletContext = {
      isWalletConnected: false,
      walletAddress: null,
      connectWallet: async () => {},
      isLoading: false,
      isClientReady: false,
      isTelegramContext: null,
      signTransaction: async () => '',
      createUsdtTransferTransaction: () => ({}),
      createTonTransferTransaction: () => ({}),
    };
  }

  const { 
    isWalletConnected, 
    walletAddress, 
    connectWallet, 
    isLoading: walletLoading,
    isClientReady: walletClientReady,
    isTelegramContext,
    signTransaction,
    createUsdtTransferTransaction,
    createTonTransferTransaction,
  } = walletContext;

  // Defensive: Wrap USDT wallet hook in try/catch
  let usdtWallet;
  try {
    usdtWallet = useUsdtWallet();
  } catch (error) {
    console.error('[Deposit] USDT wallet hook error (non-fatal):', error);
    // Provide fallback values
    usdtWallet = {
      isActivated: false,
      activationLoading: false,
      deposits: [],
      depositLoading: false,
      createDeposit: async () => {},
      refreshDeposits: async () => {},
      checkActivation: async () => {},
    };
  }

  const {
    isActivated,
    activationLoading,
    deposits,
    depositLoading,
    createDeposit,
    refreshDeposits,
    checkActivation,
  } = usdtWallet;

  const [kyatAmount, setKyatAmount] = useState('');
  const [signing, setSigning] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationTxHash, setActivationTxHash] = useState('');
  const [error, setError] = useState<string | null>(null);

  // TEMP DEBUG: Log wallet render conditions
  useEffect(() => {
    const shouldRender = isAuthReady && !!user;
    console.log('[WALLET RENDER]', {
      shouldRender,
      isAuthReady,
      hasUser: !!user,
      isWalletConnected,
      isTelegramContext,
    });
  }, [isAuthReady, user, isWalletConnected, isTelegramContext]);

  // Check activation - ONLY when user is authenticated
  // Don't block rendering if auth fails
  // Make API call async and non-blocking
  useEffect(() => {
    if (!user || !isAuthReady) {
      return;
    }

    // Async, non-blocking activation check
    const checkActivationAsync = async () => {
      try {
        if (!isActivated) {
          await checkActivation();
        }
      } catch (error) {
        // Log but don't block UI
        console.error('[Deposit] Activation check failed (non-fatal):', error);
      }
    };

    checkActivationAsync();
  }, [user, isActivated, isAuthReady, checkActivation]);

  // Helper to shorten wallet address
  const shortenAddress = (address: string | null): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle wallet connection - defensive with try/catch
  const handleConnectWallet = async () => {
    try {
      setError(null);
      await connectWallet();
    } catch (err: any) {
      console.error('[Deposit] Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
      // Don't throw - show error in UI instead
    }
  };

  // Handle activation - defensive with try/catch and null guards
  const handleActivate = async () => {
    if (!isWalletConnected || !walletAddress) {
      setError('Please connect wallet first');
      return;
    }

    try {
      setActivating(true);
      setError(null);

      // Get platform wallet address - async, fail silently if backend fails
      let walletInfo;
      try {
        walletInfo = await activationService.getWalletAddress();
      } catch (err) {
        console.error('[Deposit] Failed to get wallet address (non-fatal):', err);
        setError('Failed to load activation wallet address. Please try again.');
        return;
      }

      if (!walletInfo?.address) {
        setError('Invalid wallet address received from server');
        return;
      }

      // Create 1 TON transfer transaction - defensive
      let transaction;
      try {
        transaction = createTonTransferTransaction(walletInfo.address, walletInfo.amount);
      } catch (err) {
        console.error('[Deposit] Failed to create transaction:', err);
        setError('Failed to create transaction. Please try again.');
        return;
      }

      // Sign transaction via TON Connect - defensive
      let boc;
      try {
        boc = await signTransaction(transaction);
      } catch (err) {
        console.error('[Deposit] Transaction signing failed:', err);
        setError('Transaction signing failed. Please try again.');
        return;
      }
      
      // Use BOC as txHash identifier (backend will verify on-chain)
      const txHash = boc || `activation-${Date.now()}`;

      setActivationTxHash(txHash);

      // Verify activation with backend - defensive
      try {
        await activationService.verifyActivation({
          txHash,
          walletAddress,
        });
      } catch (err: any) {
        console.error('[Deposit] Activation verification failed:', err);
        setError(err.response?.data?.message || err.message || 'Activation verification failed');
        return;
      }

      // Refresh activation status - async, non-blocking
      try {
        await Promise.all([
          checkActivation(),
          refreshUser(),
        ]);
      } catch (err) {
        console.error('[Deposit] Failed to refresh status (non-fatal):', err);
        // Don't show error - activation succeeded, refresh will happen on next load
      }
      
      setActivationTxHash('');
    } catch (err: any) {
      console.error('[Deposit] Unexpected activation error:', err);
      setError(err.response?.data?.message || err.message || 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  // Handle deposit - defensive with try/catch and null guards
  const handleCreateDeposit = async () => {
    if (!isWalletConnected || !walletAddress) {
      setError('Please connect wallet first');
      return;
    }

    if (!isActivated) {
      setError('Please activate your account first (1 TON one-time fee)');
      return;
    }

    const amount = parseFloat(kyatAmount);
    if (!amount || amount < 1000) {
      setError('Minimum deposit is 1,000 KYAT');
      return;
    }

    try {
      setSigning(true);
      setError(null);

      // Get platform wallet address - async, fail silently if backend fails
      let platformWallet;
      try {
        platformWallet = await activationService.getWalletAddress();
      } catch (err) {
        console.error('[Deposit] Failed to get platform wallet (non-fatal):', err);
        setError('Failed to load deposit wallet address. Please try again.');
        return;
      }

      if (!platformWallet?.address) {
        setError('Invalid deposit wallet address received from server');
        return;
      }

      const usdtAmount = kyatToUsdt(amount);

      // Create USDT transfer transaction - defensive
      let transaction;
      try {
        transaction = createUsdtTransferTransaction(platformWallet.address, usdtAmount.toString());
      } catch (err) {
        console.error('[Deposit] Failed to create USDT transaction:', err);
        setError('Failed to create transaction. Please try again.');
        return;
      }

      // Sign transaction via TON Connect - defensive
      let boc;
      try {
        boc = await signTransaction(transaction);
      } catch (err) {
        console.error('[Deposit] Transaction signing failed:', err);
        setError('Transaction signing failed. Please try again.');
        return;
      }
      
      // Use BOC as txHash identifier (backend will verify on-chain)
      const txHash = boc || `deposit-${Date.now()}`;

      // Send to backend for verification and processing - defensive
      try {
        await createDeposit(amount, txHash);
        setKyatAmount('');
      } catch (err: any) {
        console.error('[Deposit] Deposit creation failed:', err);
        setError(err.response?.data?.message || err.message || 'Deposit failed');
      }
    } catch (err: any) {
      console.error('[Deposit] Unexpected deposit error:', err);
      setError(err.response?.data?.message || err.message || 'Deposit failed');
    } finally {
      setSigning(false);
    }
  };

  // CRITICAL: Wallet UI must render based ONLY on isAuthReady and user
  // Remove dependencies on socket, deposit address fetch, Telegram theme, etc.
  const shouldRenderWalletUI = isAuthReady && !!user;

  return (
    <ErrorBoundary>
      <div className="deposit">
      <div className="container">
        <div className="header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>{t('deposit.title')}</h1>
        </div>

        {/* Balance card - defensive null guard */}
        <div className="balance-card">
          <span>{t('home.balance')}</span>
          <span className="balance-value">
            {user?.kyatBalance ? Number(user.kyatBalance).toLocaleString() : 0} KYAT
          </span>
        </div>

        {/* Telegram WebApp Required Warning */}
        {isTelegramContext === false && (
          <div className="form-card" style={{ borderColor: '#ff6b6b', background: '#2a1a1a' }}>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
              <h3 style={{ marginBottom: '12px', color: '#ff6b6b' }}>Telegram Mini App Required</h3>
              <p style={{ marginBottom: '16px', color: '#ccc', fontSize: '14px' }}>
                TON Connect wallet features require the Telegram Mini App environment.
              </p>
              <p style={{ marginBottom: '16px', color: '#999', fontSize: '12px' }}>
                Please open this app from within Telegram to connect your wallet and make deposits.
              </p>
              <p style={{ color: '#666', fontSize: '11px' }}>
                If you're already in Telegram, try refreshing the page.
              </p>
            </div>
          </div>
        )}

        {/* Wallet Connection - Show when auth ready, user exists, and wallet not connected */}
        {/* Remove dependency on Telegram context check - render based on auth state only */}
        {shouldRenderWalletUI && !isWalletConnected && isClientReady && (
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: '16px' }}>Connect your TON wallet to deposit</p>
              <button
                className="btn btn-primary"
                onClick={handleConnectWallet}
                disabled={walletLoading}
              >
                {walletLoading ? t('common.loading') : 'Connect Wallet'}
              </button>
              {isTelegramContext === false && (
                <p style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
                  TON Connect requires Telegram Mini App
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loading state during SSR or initial load */}
        {(!isClientReady || !shouldRenderWalletUI) && (
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: '16px' }}>
                {!isClientReady ? 'Loading wallet...' : 'Authenticating...'}
              </p>
            </div>
          </div>
        )}

        {/* Activation Gate */}
        {isWalletConnected && !isActivated && (
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <h3 style={{ marginBottom: '12px' }}>Activate Account</h3>
              <p style={{ marginBottom: '16px', color: '#999' }}>
                Pay a one-time 1 TON activation fee to enable deposits and withdrawals
              </p>
              {walletAddress && (
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                  Wallet: {shortenAddress(walletAddress)}
                </p>
              )}
              <button
                className="btn btn-primary"
                onClick={handleActivate}
                disabled={activating || activationLoading}
              >
                {activating ? 'Signing...' : 'Activate (1 TON)'}
              </button>
              {activationTxHash && (
                <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                  Verifying transaction...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Deposit Form */}
        {isWalletConnected && isActivated && (
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
              <label>{t('deposit.amount')} (KYAT)</label>
              <input
                type="number"
                className="input"
                value={kyatAmount}
                onChange={(e) => setKyatAmount(e.target.value)}
                placeholder="1000"
                min="1000"
                step="1000"
              />
              {kyatAmount && (
                <div className="usdt-amount" style={{ marginTop: '8px', color: '#999' }}>
                  = {kyatToUsdt(parseFloat(kyatAmount)).toFixed(6)} USDT
                </div>
              )}
              <div className="rate-info" style={{ marginTop: '8px' }}>
                1 USDT = 5,000 KYAT
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px', background: '#ff4444', color: 'white', borderRadius: '8px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleCreateDeposit}
              disabled={signing || depositLoading || !kyatAmount}
            >
              {signing ? 'Signing Transaction...' : depositLoading ? t('common.loading') : 'Deposit USDT'}
            </button>
          </>
        )}

        {/* Deposits List */}
        <div className="deposits-list" style={{ marginTop: '24px' }}>
          <h3>{t('deposit.myDeposits')}</h3>
          {depositLoading ? (
            <div className="empty">Loading...</div>
          ) : deposits.length === 0 ? (
            <div className="empty">မှတ်တမ်း မရှိပါ</div>
          ) : (
            <div className="deposits">
              {deposits.map((deposit) => (
                <div key={deposit.id} className="deposit-item">
                  <div className="deposit-info">
                    <span>{Number(deposit.usdtAmount).toFixed(6)} USDT</span>
                    <span>= {Number(deposit.kyatAmount).toLocaleString()} KYAT</span>
                  </div>
                  <div className="deposit-status">
                    <span className={`status status-${deposit.status}`}>
                      {deposit.status === 'pending' ? 'Pending' : 
                       deposit.status === 'confirmed' ? 'Confirmed' : 
                       deposit.status}
                    </span>
                    <span className="date">
                      {new Date(deposit.createdAt).toLocaleDateString('my-MM')}
                    </span>
                  </div>
                  {deposit.txHash && (
                    <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                      TX: {deposit.txHash.slice(0, 8)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
