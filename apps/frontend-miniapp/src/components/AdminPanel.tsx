import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './AdminPanel.css';

export default function AdminPanel() {
  const { user } = useAuth();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // DEBUG: Log user admin status
  console.log('[AdminPanel] User check:', { 
    hasUser: !!user, 
    isAdmin: user?.isAdmin,
    userId: user?.id,
    username: user?.username
  });

  // Only show if user is admin
  if (!user?.isAdmin) {
    console.log('[AdminPanel] Not showing - user is not admin');
    return null;
  }
  
  console.log('[AdminPanel] Rendering admin panel for user:', user.username);

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
    </div>
  );
}

