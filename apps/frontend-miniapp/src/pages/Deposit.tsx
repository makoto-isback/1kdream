import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../contexts/ApiContext';
import { useTranslation } from '../hooks/useTranslation';
import './Deposit.css';

interface Deposit {
  id: string;
  usdtAmount: number;
  kyatAmount: number;
  status: string;
  createdAt: string;
}

export default function Deposit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const api = useApi();
  const { t } = useTranslation();
  const [usdtAmount, setUsdtAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWalletAddress();
    loadDeposits();
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

  const handleCreateDeposit = async () => {
    const amount = parseFloat(usdtAmount);
    if (amount < 0.2) {
      alert('အနည်းဆုံး 0.2 USDT လိုအပ်ပါသည်');
      return;
    }

    setLoading(true);
    try {
      await api.post('/deposits', { usdtAmount: amount });
      alert('ငွေသွင်းမှု တောင်းဆိုမှု အောင်မြင်ပါသည်');
      setUsdtAmount('');
      await loadDeposits();
    } catch (error: any) {
      alert(error.response?.data?.message || 'အမှားအယွင်း ဖြစ်ပွားပါသည်');
    } finally {
      setLoading(false);
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
          disabled={loading || !usdtAmount}
        >
          {loading ? t('common.loading') : t('deposit.title')}
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
    </div>
  );
}

