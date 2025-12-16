import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import Grid from '../components/Grid';
import Countdown from '../components/Countdown';
import '../styles/Lottery.css';

interface LotteryRound {
  id: string;
  roundNumber: number;
  drawTime: string;
  totalPool: number;
  winnerPool: number;
}

export default function Lottery() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [round, setRound] = useState<LotteryRound | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActiveRound();
    refreshUser();
  }, []);

  const loadActiveRound = async () => {
    try {
      const response = await api.get('/lottery/active');
      setRound(response.data);
    } catch (error) {
      console.error('Error loading round:', error);
    }
  };

  const handlePlaceBet = async () => {
    if (!selectedBlock || !betAmount) {
      alert('ဘလောက်နှင့် ငွေပမာဏ ရွေးချယ်ရန် လိုအပ်ပါသည်');
      return;
    }

    const amount = parseFloat(betAmount);
    if (amount < 1000) {
      alert('အနည်းဆုံး 1,000 KYAT လိုအပ်ပါသည်');
      return;
    }

    if (user && amount > Number(user.kyatBalance)) {
      alert('လက်ကျန်ငွေ မလုံလောက်ပါ');
      return;
    }

    setLoading(true);
    try {
      await api.post('/bets', {
        blockNumber: selectedBlock,
        amount: amount,
      });
      alert('အနိုင်ယူမှု အောင်မြင်ပါသည်');
      setBetAmount('');
      setSelectedBlock(null);
      await refreshUser();
      await loadActiveRound();
    } catch (error: any) {
      alert(error.response?.data?.message || 'အမှားအယွင်း ဖြစ်ပွားပါသည်');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lottery">
      <div className="container">
        <div className="header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>{t('bet.title')}</h1>
        </div>

        {round && (
          <div className="round-info-card">
            <div className="round-number">ပွဲ #{round.roundNumber}</div>
            <div className="round-details">
              <div className="detail-item">
                <span>{t('bet.totalPool')}</span>
                <span>{Number(round.totalPool).toLocaleString()} KYAT</span>
              </div>
              <div className="detail-item">
                <span>{t('bet.winnerPool')}</span>
                <span>{Number(round.winnerPool).toLocaleString()} KYAT</span>
              </div>
              <div className="detail-item">
                <span>{t('bet.timeLeft')}</span>
                <Countdown targetTime={round.drawTime} />
              </div>
            </div>
          </div>
        )}

        <div className="balance-card">
          <span>{t('bet.myBalance')}</span>
          <span className="balance-value">{user ? Number(user.kyatBalance).toLocaleString() : 0} KYAT</span>
        </div>

        <Grid selectedBlock={selectedBlock} onSelectBlock={setSelectedBlock} />

        <div className="bet-amount">
          <label>{t('bet.betAmount')} (KYAT)</label>
          <input
            type="number"
            className="input"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder={t('bet.minBet')}
            min="1000"
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handlePlaceBet}
          disabled={loading || !selectedBlock || !betAmount}
        >
          {loading ? t('common.loading') : t('bet.placeBet')}
        </button>
      </div>
    </div>
  );
}

