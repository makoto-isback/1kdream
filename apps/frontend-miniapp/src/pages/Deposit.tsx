import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useUsdtWallet, kyatToUsdt } from '../hooks/useUsdtWallet';
import { useWallet } from '../contexts/WalletContext';
import { activationService } from '../services/activation';
import { useClientReady } from '../hooks/useClientReady';
import api from '../services/api';
import './Deposit.css';

export default function Deposit() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const isClientReady = useClientReady();
  const { 
    isWalletConnected, 
    walletAddress, 
    connectWallet, 
    isLoading: walletLoading,
    isClientReady: walletClientReady,
    signTransaction,
    createUsdtTransferTransaction,
    createTonTransferTransaction,
  } = useWallet();
  const {
    isActivated,
    activationLoading,
    deposits,
    depositLoading,
    createDeposit,
    refreshDeposits,
    checkActivation,
  } = useUsdtWallet();

  const [kyatAmount, setKyatAmount] = useState('');
  const [signing, setSigning] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationTxHash, setActivationTxHash] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !isActivated) {
      checkActivation();
    }
  }, [user, isActivated, checkActivation]);

  // Helper to shorten wallet address
  const shortenAddress = (address: string | null): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    try {
      setError(null);
      await connectWallet();
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
  };

  // Handle activation
  const handleActivate = async () => {
    if (!isWalletConnected || !walletAddress) {
      setError('Please connect wallet first');
      return;
    }

    try {
      setActivating(true);
      setError(null);

      // Get platform wallet address
      const walletInfo = await activationService.getWalletAddress();

      // Create 1 TON transfer transaction
      const transaction = createTonTransferTransaction(walletInfo.address, walletInfo.amount);

      // Sign transaction via TON Connect
      // Note: TON Connect returns BOC, but we need txHash
      // The backend will verify the transaction on-chain using the signed transaction
      // For now, we'll use the BOC as identifier - backend can extract hash from it
      const boc = await signTransaction(transaction);
      
      // Use BOC as txHash identifier (backend will verify on-chain)
      // In production, you might want to wait for transaction confirmation and get actual hash
      const txHash = boc || `activation-${Date.now()}`;

      setActivationTxHash(txHash);

      // Verify activation with backend
      await activationService.verifyActivation({
        txHash,
        walletAddress,
      });

      // Refresh activation status
      await checkActivation();
      await refreshUser();
      
      setActivationTxHash('');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  // Handle deposit
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

      // Get platform wallet address from activation endpoint (same wallet)
      const platformWallet = await activationService.getWalletAddress();
      const usdtAmount = kyatToUsdt(amount);

      // Create USDT transfer transaction
      // Note: createUsdtTransferTransaction needs proper jetton wallet address
      // For now, we'll create a simple transfer structure
      // The actual jetton transfer will be handled by the wallet app
      const transaction = createUsdtTransferTransaction(platformWallet.address, usdtAmount.toString());

      // Sign transaction via TON Connect
      // User will sign in their wallet app
      const boc = await signTransaction(transaction);
      
      // Use BOC as txHash identifier (backend will verify on-chain)
      // In production, extract actual txHash from confirmed transaction
      const txHash = boc || `deposit-${Date.now()}`;

      // Send to backend for verification and processing
      await createDeposit(amount, txHash);

      setKyatAmount('');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Deposit failed');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="deposit">
      <div className="container">
        <div className="header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>{t('deposit.title')}</h1>
        </div>

        <div className="balance-card">
          <span>{t('home.balance')}</span>
          <span className="balance-value">{user ? Number(user.kyatBalance).toLocaleString() : 0} KYAT</span>
        </div>

        {/* Wallet Connection */}
        {!isWalletConnected && isClientReady && walletClientReady && (
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
            </div>
          </div>
        )}

        {/* Loading state during SSR */}
        {!isClientReady && (
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: '16px' }}>Loading wallet...</p>
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
  );
}
