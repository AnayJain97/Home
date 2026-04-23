import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDocument, deleteDocument } from '../../../hooks/useFirestore';
import { getBorrowingSummary } from '../utils/lendingCalcs';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatDate } from '../../../utils/dateUtils';
import Toast from '../../../components/Toast';
import { useOrg, getOrgCollection } from '../../../context/OrgContext';

export default function BorrowingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const { selectedOrg, canWrite } = useOrg();

  const { data: borrowing, loading } = useDocument(`${getOrgCollection(selectedOrg, 'borrowings')}/${id}`);

  const summary = useMemo(() => {
    if (!borrowing) return null;
    return getBorrowingSummary(borrowing);
  }, [borrowing]);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete this borrowing for "${borrowing?.clientName}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(`${getOrgCollection(selectedOrg, 'borrowings')}/${id}`);
      setToast({ message: 'Borrowing deleted', type: 'success' });
      setTimeout(() => navigate('/money-lending/borrowing'), 500);
    } catch (err) {
      setToast({ message: 'Error deleting borrowing', type: 'error' });
    }
  };



  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  }

  if (!borrowing) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <p>Borrowing not found.</p>
        <Link to="/money-lending/borrowing" className="btn btn-primary">Back to Borrowings</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/money-lending/borrowing" className="btn btn-sm btn-outline" title="Back">←</Link>
          <h1>{borrowing.clientName}</h1>
        </div>
        <div className="page-actions">
          {canWrite && !borrowing.isCarryForward && <Link to={`/money-lending/borrowing/${id}/edit`} className="btn btn-outline">✏️ Edit</Link>}
          {canWrite && !borrowing.isCarryForward && (
            <button className="btn btn-danger" onClick={handleDelete}>🗑️ Delete</button>
          )}
          {borrowing.isCarryForward && <span className="carry-forward-badge" style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>↪ Carry Forward — Auto-managed</span>}
        </div>
      </div>

      {/* Borrowing Info */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Amount</div>
            <div className="detail-value">{formatCurrency(borrowing.amount)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Monthly Interest Rate</div>
            <div className="detail-value">{formatPercent(borrowing.monthlyInterestRate)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Borrowing Start Date</div>
            <div className="detail-value">{formatDate(borrowing.borrowDate)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Borrowing End Date</div>
            <div className="detail-value">{borrowing.endDate ? formatDate(borrowing.endDate) : '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Notes</div>
            <div className="detail-value">{borrowing.notes || '—'}</div>
          </div>
        </div>
      </div>

      {/* Calculated Summary */}
      {summary && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="label">Amount</div>
            <div className="value">{formatCurrency(summary.amount)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Monthly Interest</div>
            <div className="value">{formatCurrency(summary.monthlyInterest)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Days to End</div>
            <div className="value text-primary">{summary.daysTillFYEnd}</div>
          </div>
          <div className="summary-card">
            <div className="label">Interest till End</div>
            <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(summary.interestTillFYEnd)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Total Credit (Amount + Interest)</div>
            <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(summary.totalCredit)}</div>
          </div>
        </div>
      )}

      {/* Formula Breakdown */}
      {summary && summary.formulaText && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Interest Calculation</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#555', margin: 0 }}>
            {summary.formulaText}
          </pre>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
