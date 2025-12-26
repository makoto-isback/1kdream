import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserData } from '../hooks/useUserData';
import api from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import Countdown from '../components/Countdown';
import Wallet from '../components/Wallet';
import AdminPanel from '../components/AdminPanel';
import '../styles/Home.css';

interface LotteryRound {
  id: string;
  roundNumber: number;
  drawTime: string;
  totalPool: number;
  winnerPool: number;
  status: string;
}

export default function Home() {
  const navigate = useNavigate();
  const { user, refreshUser, isAuthReady } = useUserData();
  const { t } = useTranslation();
  const [round, setRound] = useState<LotteryRound | null>(null);

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

  // Loading depends on authReady ONLY, not on user balance
  // User might have balance = 0, which is valid
  if (!isAuthReady) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  return (
    <div className="home">
      <div className="container">
        <h1 className="title">{t('home.title')}</h1>

        {user && <Wallet kyatBalance={user.kyatBalance} points={user.points} />}

        <AdminPanel />

        {round && (
          <div className="round-card">
            <div className="round-header">
              <span>{t('home.activeRound')} #{round.roundNumber}</span>
            </div>
            <div className="round-info">
              <div className="info-item">
                <span>{t('bet.totalPool')}</span>
                <span>{Number(round.totalPool).toLocaleString()} KYAT</span>
              </div>
              <div className="info-item">
                <span>{t('bet.winnerPool')}</span>
                <span>{Number(round.winnerPool).toLocaleString()} KYAT</span>
              </div>
              <div className="info-item">
                <span>{t('home.nextDraw')}</span>
                <Countdown targetTime={round.drawTime} onComplete={loadActiveRound} />
              </div>
            </div>
          </div>
        )}

        <div className="actions">
          <button className="btn btn-primary" onClick={() => navigate('/lottery')}>
            {t('home.placeBet')}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/wallet')}>
            {t('home.deposit')}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/support')}>
            {t('home.history')}
          </button>
        </div>
      </div>
    </div>
  );
}
