import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { useTranslation } from '../hooks/useTranslation';
import './History.css';

interface Bet {
  id: string;
  blockNumber: number;
  amount: number;
  payout: number | null;
  isWinner: boolean;
  createdAt: string;
  lotteryRound?: {
    roundNumber: number;
    winningBlock: number | null;
    status: string;
  };
}

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
  status: string;
  createdAt: string;
}

export default function History() {
  const navigate = useNavigate();
  const api = useApi();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'bets' | 'deposits' | 'withdrawals'>('bets');
  const [bets, setBets] = useState<Bet[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'bets') {
        const response = await api.get('/bets/my?limit=100');
        setBets(response.data);
      } else if (activeTab === 'deposits') {
        const response = await api.get('/deposits/my');
        setDeposits(response.data);
      } else {
        const response = await api.get('/withdrawals/my');
        setWithdrawals(response.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="history">
      <div className="container">
        <div className="header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>{t('history.title')}</h1>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'bets' ? 'active' : ''}`}
            onClick={() => setActiveTab('bets')}
          >
            {t('history.bets')}
          </button>
          <button
            className={`tab ${activeTab === 'deposits' ? 'active' : ''}`}
            onClick={() => setActiveTab('deposits')}
          >
            {t('history.deposits')}
          </button>
          <button
            className={`tab ${activeTab === 'withdrawals' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdrawals')}
          >
            {t('history.withdrawals')}
          </button>
        </div>

        {loading ? (
          <div className="loading">{t('common.loading')}</div>
        ) : (
          <div className="content">
            {activeTab === 'bets' && (
              <div className="bets-list">
                {bets.length === 0 ? (
                  <div className="empty">မှတ်တမ်း မရှိပါ</div>
                ) : (
                  bets.map((bet) => (
                    <div key={bet.id} className="bet-item">
                      <div className="bet-header">
                        <span className="block">ဘလောက် {bet.blockNumber.toString().padStart(2, '0')}</span>
                        <span className={`status ${bet.isWinner ? 'won' : bet.lotteryRound?.status === 'completed' ? 'lost' : 'pending'}`}>
                          {bet.isWinner ? t('history.won') :
                           bet.lotteryRound?.status === 'completed' ? t('history.lost') :
                           t('history.pending')}
                        </span>
                      </div>
                      <div className="bet-details">
                        <div className="detail">
                          <span>{t('history.amount')}</span>
                          <span>{Number(bet.amount).toLocaleString()} KYAT</span>
                        </div>
                        {bet.payout && (
                          <div className="detail">
                            <span>{t('history.payout')}</span>
                            <span className="payout">{Number(bet.payout).toLocaleString()} KYAT</span>
                          </div>
                        )}
                        <div className="detail">
                          <span>{t('history.date')}</span>
                          <span>{new Date(bet.createdAt).toLocaleDateString('my-MM')}</span>
                        </div>
                        {bet.lotteryRound && (
                          <div className="detail">
                            <span>ပွဲ</span>
                            <span>#{bet.lotteryRound.roundNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'deposits' && (
              <div className="deposits-list">
                {deposits.length === 0 ? (
                  <div className="empty">မှတ်တမ်း မရှိပါ</div>
                ) : (
                  deposits.map((deposit) => (
                    <div key={deposit.id} className="deposit-item">
                      <div className="deposit-header">
                        <span>{Number(deposit.usdtAmount).toFixed(2)} USDT</span>
                        <span className={`status status-${deposit.status}`}>
                          {deposit.status === 'pending' ? t('withdraw.pending') :
                           deposit.status === 'confirmed' ? t('withdraw.completed') :
                           t('withdraw.rejected')}
                        </span>
                      </div>
                      <div className="deposit-details">
                        <div className="detail">
                          <span>{t('history.amount')}</span>
                          <span>{Number(deposit.kyatAmount).toLocaleString()} KYAT</span>
                        </div>
                        <div className="detail">
                          <span>{t('history.date')}</span>
                          <span>{new Date(deposit.createdAt).toLocaleDateString('my-MM')}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'withdrawals' && (
              <div className="withdrawals-list">
                {withdrawals.length === 0 ? (
                  <div className="empty">မှတ်တမ်း မရှိပါ</div>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="withdrawal-item">
                      <div className="withdrawal-header">
                        <span>{Number(withdrawal.kyatAmount).toLocaleString()} KYAT</span>
                        <span className={`status status-${withdrawal.status}`}>
                          {withdrawal.status === 'pending' ? t('withdraw.pending') :
                           withdrawal.status === 'processing' ? t('withdraw.processing') :
                           withdrawal.status === 'completed' ? t('withdraw.completed') :
                           t('withdraw.rejected')}
                        </span>
                      </div>
                      <div className="withdrawal-details">
                        <div className="detail">
                          <span>{t('history.amount')}</span>
                          <span>{Number(withdrawal.usdtAmount).toFixed(4)} USDT</span>
                        </div>
                        <div className="detail">
                          <span>{t('history.date')}</span>
                          <span>{new Date(withdrawal.createdAt).toLocaleDateString('my-MM')}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

