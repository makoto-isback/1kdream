import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserData } from '../hooks/useUserData';
import api from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import '../styles/Wallet.css';

interface Deposit {
  id: string;
  usdtAmount: number;
  kyatAmount: number;
  status: string;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  kyatAmount: number;
  usdtAmount: number;
  tonAddress: string;
  status: string;
  createdAt: string;
}

export default function Wallet() {
  console.log('🔥 RENDERING FILE: apps/frontend-miniapp/src/pages/Wallet.tsx (OLD UI)');
  const navigate = useNavigate();
  const { user, refreshUser } = useUserData();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  
  // Deposit state
  const [usdtAmount, setUsdtAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [depositLoading, setDepositLoading] = useState(false);
  
  // Withdrawal state
  const [kyatAmount, setKyatAmount] = useState('');
  const [tonAddress, setTonAddress] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    loadWalletAddress();
    loadDeposits();
    loadWithdrawals();
  }, []);

  const loadWalletAddress = async () => {
    try {
      const response = await api.get('/deposits/address');
      setWalletAddress(response.data.address);
    } catch (error) {
      console.error('Error loading wallet address:', error);
    }
  };

  const loadDeposits = async () => {
    try {
      const response = await api.get('/deposits/my');
      setDeposits(response.data);
    } catch (error) {
      console.error('Error loading deposits:', error);
    }
  };

  const loadWithdrawals = async () => {
    try {
      const response = await api.get('/withdrawals/my');
      // Sort by date descending (most recent first) to ensure we show the latest one
      const sorted = response.data.sort((a: Withdrawal, b: Withdrawal) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setWithdrawals(sorted);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    }
  };

  const handleCreateDeposit = async () => {
    const amount = parseFloat(usdtAmount);
    if (amount < 0.2) {
      alert('အနည်းဆုံး 0.2 USDT လိုအပ်ပါသည်');
      return;
    }

    setDepositLoading(true);
    try {
      await api.post('/deposits', { usdtAmount: amount });
      alert('ငွေသွင်းမှု တောင်းဆိုမှု အောင်မြင်ပါသည်');
      setUsdtAmount('');
      await loadDeposits();
    } catch (error: any) {
      alert(error.response?.data?.message || 'အမှားအယွင်း ဖြစ်ပွားပါသည်');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(kyatAmount);
    if (amount < 5000) {
      alert('အနည်းဆုံး 5,000 KYAT လိုအပ်ပါသည်');
      return;
    }

    if (user && amount > Number(user.kyatBalance)) {
      alert('လက်ကျန်ငွေ မလုံလောက်ပါ');
      return;
    }

    if (!tonAddress) {
      alert('TON လိပ်စာ ထည့်သွင်းရန် လိုအပ်ပါသည်');
      return;
    }

    setWithdrawLoading(true);
    try {
      await api.post('/withdrawals', {
        kyatAmount: amount,
        tonAddress: tonAddress,
      });
      alert('ငွေထုတ်မှု တောင်းဆိုမှု အောင်မြင်ပါသည်');
      setKyatAmount('');
      setTonAddress('');
      await refreshUser();
      await loadWithdrawals();
    } catch (error: any) {
      alert(error.response?.data?.message || 'အမှားအယွင်း ဖြစ်ပွားပါသည်');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="wallet-page">
      <div className="container">
        <div className="header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>ငွေကြေး</h1>
        </div>

        <div className="balance-card">
          <span>{t('home.balance')}</span>
          <span className="balance-value">{user ? Number(user.kyatBalance).toLocaleString() : 0} KYAT</span>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'deposit' ? 'active' : ''}`}
            onClick={() => setActiveTab('deposit')}
          >
            {t('deposit.title')}
          </button>
          <button
            className={`tab ${activeTab === 'withdraw' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdraw')}
          >
            {t('withdraw.title')}
          </button>
        </div>

        {activeTab === 'deposit' && (
          <div className="tab-content">
            <div className="form-card">
              <label>{t('deposit.amount')}</label>
              <input
                type="number"
                className="input"
                value={usdtAmount}
                onChange={(e) => setUsdtAmount(e.target.value)}
                placeholder={t('deposit.minDeposit')}
                min="0.2"
                step="0.1"
              />
              <div className="rate-info">{t('deposit.rate')}</div>
              {usdtAmount && (
                <div className="kyat-amount">
                  = {Number(usdtAmount) * 5000} KYAT
                </div>
              )}
            </div>

            {walletAddress && (
              <div className="wallet-card">
                <label>{t('deposit.walletAddress')}</label>
                <div className="address-container">
                  <code className="address">{walletAddress}</code>
                  <button className="copy-btn" onClick={copyAddress}>
                    {copied ? t('deposit.copied') : t('deposit.copy')}
                  </button>
                </div>
              </div>
            )}

            <div className="instructions-card">
              <h3>{t('deposit.instructions')}</h3>
              <ol>
                <li>{t('deposit.step1')}</li>
                <li>{t('deposit.step2')}</li>
                <li>{t('deposit.step3')}</li>
              </ol>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreateDeposit}
              disabled={depositLoading || !usdtAmount}
            >
              {depositLoading ? t('common.loading') : t('deposit.title')}
            </button>

            <div className="deposits-list">
              <h3>{t('deposit.myDeposits')}</h3>
              {deposits.length === 0 ? (
                <div className="empty">မှတ်တမ်း မရှိပါ</div>
              ) : (
                <div className="deposits">
                  {deposits.map((deposit) => (
                    <div key={deposit.id} className="deposit-item">
                      <div className="deposit-info">
                        <span>{Number(deposit.usdtAmount).toFixed(2)} USDT</span>
                        <span>= {Number(deposit.kyatAmount).toLocaleString()} KYAT</span>
                      </div>
                      <div className="deposit-status">
                        <span className={`status status-${deposit.status}`}>
                          {deposit.status === 'pending' ? t('withdraw.pending') : 
                           deposit.status === 'confirmed' ? t('withdraw.completed') : 
                           t('withdraw.rejected')}
                        </span>
                        <span className="date">
                          {new Date(deposit.createdAt).toLocaleDateString('my-MM')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="tab-content">
            <div className="form-card">
              <label>{t('withdraw.amount')}</label>
              <input
                type="number"
                className="input"
                value={kyatAmount}
                onChange={(e) => setKyatAmount(e.target.value)}
                placeholder={t('withdraw.minWithdraw')}
                min="5000"
              />
              {kyatAmount && (
                <div className="usdt-amount">
                  = {Number(kyatAmount) / 5000} USDT
                </div>
              )}
              <div className="rate-info">{t('withdraw.rate')}</div>
            </div>

            <div className="form-card">
              <label>{t('withdraw.tonAddress')}</label>
              <input
                type="text"
                className="input"
                value={tonAddress}
                onChange={(e) => setTonAddress(e.target.value)}
                placeholder="TON address"
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleWithdraw}
              disabled={withdrawLoading || !kyatAmount || !tonAddress}
            >
              {withdrawLoading ? t('common.loading') : t('withdraw.request')}
            </button>

            <div className="withdrawals-list">
              <h3>{t('withdraw.myWithdrawals')}</h3>
              {withdrawals.length === 0 ? (
                <div className="empty">မှတ်တမ်း မရှိပါ</div>
              ) : (
                <div className="withdrawals">
                  {/* Show only the most recent withdrawal */}
                  {(() => {
                    const mostRecent = withdrawals[0]; // Assuming withdrawals are sorted by date descending
                    return (
                      <div key={mostRecent.id} className="withdrawal-item">
                        <div className="withdrawal-info">
                          <span>{Number(mostRecent.kyatAmount).toLocaleString()} KYAT</span>
                          <span>= {Number(mostRecent.usdtAmount).toFixed(4)} USDT</span>
                        </div>
                        <div className="withdrawal-details">
                          <div className="address">{mostRecent.tonAddress}</div>
                          <div className="withdrawal-status">
                            <span className={`status status-${mostRecent.status}`}>
                              {mostRecent.status === 'pending' ? t('withdraw.pending') :
                               mostRecent.status === 'processing' ? t('withdraw.processing') :
                               mostRecent.status === 'completed' ? t('withdraw.completed') :
                               t('withdraw.rejected')}
                            </span>
                            <span className="date">
                              {new Date(mostRecent.createdAt).toLocaleDateString('my-MM')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

