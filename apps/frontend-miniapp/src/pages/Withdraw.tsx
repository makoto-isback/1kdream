import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useUsdtWallet, kyatToUsdt, getWithdrawalTimeRemaining, formatCountdown } from '../hooks/useUsdtWallet';
import { useWallet } from '../contexts/WalletContext';
import './Withdraw.css';

export default function Withdraw() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const { isWalletConnected, walletAddress } = useWallet();
  const {
    isActivated,
    withdrawals,
    withdrawalLoading,
    createWithdrawal,
    refreshWithdrawals,
  } = useUsdtWallet();

  const [kyatAmount, setKyatAmount] = useState('');
  const [tonAddress, setTonAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdownTimers, setCountdownTimers] = useState<Record<string, number>>({});

  useEffect(() => {
    // Update countdown timers every second
    const interval = setInterval(() => {
      const timers: Record<string, number> = {};
      withdrawals.forEach((w) => {
        if (w.status === 'signed' || w.status === 'queued') {
          timers[w.id] = getWithdrawalTimeRemaining(w.executeAfter);
        }
      });
      setCountdownTimers(timers);
    }, 1000);

    return () => clearInterval(interval);
  }, [withdrawals]);

  // Helper to shorten wallet address
  const shortenAddress = (address: string | null): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleWithdraw = async () => {
    if (!isWalletConnected) {
      setError('Please connect wallet first');
      return;
    }

    if (!isActivated) {
      setError('Please activate your account first');
      return;
    }

    const amount = parseFloat(kyatAmount);
    if (!amount || amount < 5000) {
      setError('Minimum withdrawal is 5,000 KYAT');
      return;
    }

    if (user && amount > Number(user.kyatBalance)) {
      setError('Insufficient balance');
      return;
    }

    if (!tonAddress || tonAddress.trim() === '') {
      setError('Please enter TON address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createWithdrawal(amount, tonAddress.trim());
      setKyatAmount('');
      setTonAddress('');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'signed':
        return 'Pending (1 hour delay)';
      case 'queued':
        return 'Processing';
      case 'sent':
        return 'Sent';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  return (
    <div className="withdraw">
      <div className="container">
        <div className="header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>{t('withdraw.title')}</h1>
        </div>

        <div className="balance-card">
          <span>{t('home.balance')}</span>
          <span className="balance-value">{user ? Number(user.kyatBalance).toLocaleString() : 0} KYAT</span>
        </div>

        {/* Wallet Connection Check */}
        {!isWalletConnected && (
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: '16px' }}>Connect your TON wallet to withdraw</p>
              <p style={{ fontSize: '12px', color: '#999' }}>
                Go to Deposit page to connect wallet
              </p>
            </div>
          </div>
        )}

        {/* Activation Check */}
        {isWalletConnected && !isActivated && (
          <div className="form-card">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: '16px' }}>Please activate your account first</p>
              <p style={{ fontSize: '12px', color: '#999' }}>
                Go to Deposit page to activate (1 TON one-time fee)
              </p>
            </div>
          </div>
        )}

        {/* Withdrawal Form */}
        {isWalletConnected && isActivated && (
          <>
            <div className="form-card">
              <label>{t('withdraw.amount')} (KYAT)</label>
              <input
                type="number"
                className="input"
                value={kyatAmount}
                onChange={(e) => setKyatAmount(e.target.value)}
                placeholder="5000"
                min="5000"
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

            {/* 1 Hour Delay Notice */}
            <div className="form-card" style={{ background: '#fff3cd', border: '1px solid #ffc107', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                ⏰ Withdrawal Delay
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Withdrawals are processed after a 1-hour delay for security. Your balance will be deducted immediately.
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px', background: '#ff4444', color: 'white', borderRadius: '8px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleWithdraw}
              disabled={loading || withdrawalLoading || !kyatAmount || !tonAddress}
            >
              {loading ? t('common.loading') : t('withdraw.request')}
            </button>
          </>
        )}

        {/* Withdrawals List */}
        <div className="withdrawals-list" style={{ marginTop: '24px' }}>
          <h3>{t('withdraw.myWithdrawals')}</h3>
          {withdrawalLoading ? (
            <div className="empty">Loading...</div>
          ) : withdrawals.length === 0 ? (
            <div className="empty">မှတ်တမ်း မရှိပါ</div>
          ) : (
            <div className="withdrawals">
              {withdrawals.map((withdrawal) => {
                const remaining = countdownTimers[withdrawal.id] || getWithdrawalTimeRemaining(withdrawal.executeAfter);
                const showCountdown = (withdrawal.status === 'signed' || withdrawal.status === 'queued') && remaining > 0;

                return (
                  <div key={withdrawal.id} className="withdrawal-item">
                    <div className="withdrawal-info">
                      <span>{Number(withdrawal.kyatAmount).toLocaleString()} KYAT</span>
                      <span>= {Number(withdrawal.usdtAmount).toFixed(6)} USDT</span>
                    </div>
                    <div className="withdrawal-details">
                      <div className="address">{withdrawal.tonAddress}</div>
                      {showCountdown && (
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ff9800', marginTop: '4px' }}>
                          ⏰ {formatCountdown(remaining)}
                        </div>
                      )}
                      <div className="withdrawal-status">
                        <span className={`status status-${withdrawal.status}`}>
                          {getStatusLabel(withdrawal.status)}
                        </span>
                        <span className="date">
                          {new Date(withdrawal.createdAt).toLocaleDateString('my-MM')}
                        </span>
                      </div>
                      {withdrawal.tonTxHash && (
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                          TX: {withdrawal.tonTxHash.slice(0, 8)}...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
