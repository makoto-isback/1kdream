import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './AdminPanel.css';

interface Withdrawal {
  id: string;
  userId: string;
  kyatAmount: number;
  usdtAmount: number;
  tonAddress: string;
  tonTxHash: string | null;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestTime: string;
  processedAt: string | null;
  createdAt: string;
  user?: {
    username?: string;
    firstName?: string;
    lastName?: string;
    telegramId?: string;
  };
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Withdrawals management state
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [manualTxHash, setManualTxHash] = useState<{ [key: string]: string }>({});

  // Define loadWithdrawals BEFORE any conditional returns (React hooks rule)
  const loadWithdrawals = React.useCallback(async () => {
    // Only load if user is admin
    if (!user?.isAdmin) return;
    
    try {
      setWithdrawalsLoading(true);
      const response = await api.get('/admin/withdrawals');
      setWithdrawals(response.data || []);
    } catch (err: any) {
      console.error('Error loading withdrawals:', err);
      // Don't throw - just log the error
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [user?.isAdmin]);

  // Load withdrawals on mount and refresh every 30 seconds
  useEffect(() => {
    if (user?.isAdmin) {
      loadWithdrawals();
      const interval = setInterval(loadWithdrawals, 30000);
      return () => clearInterval(interval);
    }
  }, [loadWithdrawals, user?.isAdmin]);

  // DEBUG: Log user admin status
  console.log('[AdminPanel] User check:', { 
    hasUser: !!user, 
    isAdmin: user?.isAdmin,
    userId: user?.id,
    username: user?.username
  });

  // Only show if user is admin (AFTER all hooks)
  if (!user?.isAdmin) {
    console.log('[AdminPanel] Not showing - user is not admin');
    return null;
  }
  
  console.log('[AdminPanel] Rendering admin panel for user:', user.username);

  const formatTimeRemaining = (requestTime: string): string => {
    const request = new Date(requestTime);
    const now = new Date();
    const elapsed = now.getTime() - request.getTime();
    const oneHour = 60 * 60 * 1000;
    const remaining = oneHour - elapsed;

    if (remaining <= 0) {
      return 'Ready to process';
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isReadyToProcess = (requestTime: string): boolean => {
    const request = new Date(requestTime);
    const now = new Date();
    const elapsed = now.getTime() - request.getTime();
    return elapsed >= 60 * 60 * 1000; // 1 hour
  };

  const handleProcessWithdrawal = async (withdrawalId: string, txHash?: string) => {
    try {
      setProcessingId(withdrawalId);
      setError(null);

      if (txHash) {
        // Manual processing with txHash
        await api.post(`/admin/withdrawals/${withdrawalId}/process`, { tonTxHash: txHash });
      } else {
        // Automatic processing
        await api.post(`/admin/withdrawals/${withdrawalId}/complete`, {});
      }

      // Refresh withdrawals list
      await loadWithdrawals();
      setManualTxHash({ ...manualTxHash, [withdrawalId]: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to process withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectWithdrawal = async (withdrawalId: string) => {
    if (!confirm('Are you sure you want to reject this withdrawal? Balance will be refunded to user.')) {
      return;
    }

    try {
      setProcessingId(withdrawalId);
      setError(null);
      await api.post(`/admin/withdrawals/${withdrawalId}/reject`, {});
      await loadWithdrawals();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to reject withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/admin/manual-adjust', {
        userId: userId.trim(),
        amount: parseFloat(amount),
        type,
        reason: reason.trim() || 'Manual adjustment',
      });

      setResult(response.data);
      // Reset form on success
      if (response.data.success) {
        setUserId('');
        setAmount('');
        setReason('');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to adjust balance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <h2>🔧 Admin Panel - Manual Balance Adjustment</h2>
      
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label>User ID:</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="187b27d0-7c02-4270-bc80-48b2e8029b71"
            required
          />
        </div>

        <div className="form-group">
          <label>Amount (KYAT):</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100"
            required
          />
        </div>

        <div className="form-group">
          <label>Type:</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'credit' | 'debit')}>
            <option value="credit">Credit (Add)</option>
            <option value="debit">Debit (Subtract)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Reason:</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Manual test deposit"
          />
        </div>

        <button type="submit" disabled={loading} className="admin-submit-btn">
          {loading ? 'Processing...' : 'Adjust Balance'}
        </button>
      </form>

      {error && (
        <div className="admin-error">
          ❌ Error: {error}
        </div>
      )}

      {result && (
        <div className="admin-success">
          ✅ Success!<br />
          User: {result.userId}<br />
          Amount: {result.amount} KYAT ({result.type})<br />
          New Balance: {result.newBalance} KYAT<br />
          Reason: {result.reason}
        </div>
      )}

      {/* Withdrawals Management Section */}
      <div className="admin-section" style={{ marginTop: '30px', borderTop: '2px solid #333', paddingTop: '20px' }}>
        <h2>💰 Withdrawals Management</h2>
        
        {withdrawalsLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading withdrawals...</div>
        ) : (
          <div className="withdrawals-list">
            {withdrawals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                No withdrawals found
              </div>
            ) : (
              withdrawals.map((withdrawal) => {
                const timeRemaining = formatTimeRemaining(withdrawal.requestTime);
                const ready = isReadyToProcess(withdrawal.requestTime);
                const userDisplay = withdrawal.user?.username 
                  ? `@${withdrawal.user.username}` 
                  : withdrawal.user?.firstName || withdrawal.userId.slice(0, 8);

                return (
                  <div 
                    key={withdrawal.id} 
                    className="withdrawal-item"
                    style={{
                      border: '1px solid #333',
                      borderRadius: '8px',
                      padding: '15px',
                      marginBottom: '15px',
                      backgroundColor: withdrawal.status === 'pending' ? '#1a1a1a' : '#0f0f0f'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '5px' }}>
                          {Number(withdrawal.kyatAmount).toLocaleString()} KYAT ({Number(withdrawal.usdtAmount).toFixed(6)} USDT)
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          User: {userDisplay}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace', marginTop: '5px' }}>
                          {withdrawal.tonAddress.slice(0, 10)}...{withdrawal.tonAddress.slice(-8)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '11px',
                          backgroundColor: withdrawal.status === 'pending' ? '#ffa50033' : 
                                         withdrawal.status === 'completed' ? '#00ff0033' :
                                         withdrawal.status === 'rejected' ? '#ff000033' : '#0000ff33',
                          color: withdrawal.status === 'pending' ? '#ffa500' : 
                                 withdrawal.status === 'completed' ? '#00ff00' :
                                 withdrawal.status === 'rejected' ? '#ff0000' : '#0000ff',
                          marginBottom: '5px'
                        }}>
                          {withdrawal.status.toUpperCase()}
                        </div>
                        {withdrawal.status === 'pending' && (
                          <div style={{ fontSize: '11px', color: ready ? '#00ff00' : '#ffa500', marginTop: '5px' }}>
                            {ready ? '✅ Ready' : `⏱️ ${timeRemaining}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {withdrawal.status === 'pending' && (
                      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #333' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <input
                            type="text"
                            placeholder="Manual TX Hash (optional)"
                            value={manualTxHash[withdrawal.id] || ''}
                            onChange={(e) => setManualTxHash({ ...manualTxHash, [withdrawal.id]: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '8px',
                              backgroundColor: '#1a1a1a',
                              border: '1px solid #333',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '12px',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
                            Leave empty for automatic processing
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => handleProcessWithdrawal(withdrawal.id, manualTxHash[withdrawal.id] || undefined)}
                            disabled={!ready || processingId === withdrawal.id}
                            style={{
                              flex: 1,
                              padding: '10px',
                              backgroundColor: ready ? '#00ff00' : '#666',
                              color: '#000',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: ready ? 'pointer' : 'not-allowed',
                              fontWeight: 'bold',
                              fontSize: '12px'
                            }}
                          >
                            {processingId === withdrawal.id ? 'Processing...' : 'Process'}
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(withdrawal.id)}
                            disabled={processingId === withdrawal.id}
                            style={{
                              flex: 1,
                              padding: '10px',
                              backgroundColor: '#ff0000',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px'
                            }}
                          >
                            {processingId === withdrawal.id ? 'Processing...' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    )}

                    {withdrawal.tonTxHash && (
                      <div style={{ marginTop: '10px', fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>
                        TX: {withdrawal.tonTxHash.slice(0, 20)}...
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

