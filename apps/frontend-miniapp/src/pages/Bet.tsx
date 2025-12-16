import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../contexts/ApiContext';
import { useTranslation } from '../hooks/useTranslation';
import './Bet.css';

interface LotteryRound {
  id: string;
  roundNumber: number;
  drawTime: string;
  totalPool: number;
  winnerPool: number;
}

export default function Bet() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const api = useApi();
  const { t } = useTranslation();
  const [round, setRound] = useState<LotteryRound | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    loadActiveRound();
    refreshUser();
  }, []);

  useEffect(() => {
    if (round) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const draw = new Date(round.drawTime).getTime();
        const diff = draw - now;

        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        } else {
          setTimeLeft('00:00:00');
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [round]);

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

  const blocks = Array.from({ length: 25 }, (_, i) => i + 1);

  return (
    <div className="bet">
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
                <span>{timeLeft}</span>
              </div>
            </div>
          </div>
        )}

        <div className="balance-card">
          <span>{t('bet.myBalance')}</span>
          <span className="balance-value">{user ? Number(user.kyatBalance).toLocaleString() : 0} KYAT</span>
        </div>

        <div className="block-selection">
          <h3>{t('bet.selectBlock')}</h3>
          <div className="blocks-grid">
            {blocks.map((block) => (
              <button
                key={block}
                className={`block-btn ${selectedBlock === block ? 'selected' : ''}`}
                onClick={() => setSelectedBlock(block)}
              >
                {block.toString().padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>

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

