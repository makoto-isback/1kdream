import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../contexts/ApiContext';
import { useTranslation } from '../hooks/useTranslation';
import './Withdraw.css';

interface Withdrawal {
  id: string;
  kyatAmount: number;
  usdtAmount: number;
  tonAddress: string;
  status: string;
  createdAt: string;
}

export default function Withdraw() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const api = useApi();
  const { t } = useTranslation();
  const [kyatAmount, setKyatAmount] = useState('');
  const [tonAddress, setTonAddress] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    try {
      const response = await api.get('/withdrawals/my');
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
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

    setLoading(true);
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
      setLoading(false);
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
          disabled={loading || !kyatAmount || !tonAddress}
        >
          {loading ? t('common.loading') : t('withdraw.request')}
        </button>

        <div className="withdrawals-list">
          <h3>{t('withdraw.myWithdrawals')}</h3>
          {withdrawals.length === 0 ? (
            <div className="empty">မှတ်တမ်း မရှိပါ</div>
          ) : (
            <div className="withdrawals">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="withdrawal-item">
                  <div className="withdrawal-info">
                    <span>{Number(withdrawal.kyatAmount).toLocaleString()} KYAT</span>
                    <span>= {Number(withdrawal.usdtAmount).toFixed(4)} USDT</span>
                  </div>
                  <div className="withdrawal-details">
                    <div className="address">{withdrawal.tonAddress}</div>
                    <div className="withdrawal-status">
                      <span className={`status status-${withdrawal.status}`}>
                        {withdrawal.status === 'pending' ? t('withdraw.pending') :
                         withdrawal.status === 'processing' ? t('withdraw.processing') :
                         withdrawal.status === 'completed' ? t('withdraw.completed') :
                         t('withdraw.rejected')}
                      </span>
                      <span className="date">
                        {new Date(withdrawal.createdAt).toLocaleDateString('my-MM')}
                      </span>
                    </div>
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

