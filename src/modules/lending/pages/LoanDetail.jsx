import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDocument, updateDocument } from '../../../hooks/useFirestore';
import { getLendingSummary } from '../utils/lendingCalcs';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatDate, getCurrentFYLabel } from '../../../utils/dateUtils';
import Toast from '../../../components/Toast';
import { exportToExcel } from '../../../services/exportService';

export default function LoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  const { data: loan, loading: loadingLoan } = useDocument(`loans/${id}`);

  const summary = useMemo(() => {
    if (!loan) return null;
    return getLendingSummary(loan);
  }, [loan]);

  const handleCloseLoan = async () => {
    if (!window.confirm('Are you sure you want to close this loan?')) return;
    try {
      await updateDocument(`loans/${id}`, { status: 'closed' });
      setToast({ message: 'Loan closed', type: 'success' });
    } catch (err) {
      setToast({ message: 'Error closing loan', type: 'error' });
    }
  };

  const handleReopenLoan = async () => {
    try {
      await updateDocument(`loans/${id}`, { status: 'active' });
      setToast({ message: 'Loan reopened', type: 'success' });
    } catch (err) {
      setToast({ message: 'Error reopening loan', type: 'error' });
    }
  };

  const handleExport = () => {
    if (!loan || !summary) return;
    const rows = [{
      loanDate: formatDate(loan.loanDate),
      principal: loan.principalAmount,
      clientName: loan.clientName,
      interestTillFY: summary.interestTillFYEnd,
      totalDue: summary.totalDue,
    }];

    exportToExcel(rows, [
      { header: 'Date', key: 'loanDate', width: 12 },
      { header: 'Amount (₹)', key: 'principal', width: 15 },
      { header: 'Name', key: 'clientName', width: 20 },
      { header: 'Interest till End Date (₹)', key: 'interestTillFY', width: 22 },
      { header: 'Total Due (₹)', key: 'totalDue', width: 15 },
    ], `Loan_${loan.clientName.replace(/\s+/g, '_')}`, 'Loan');
  };

  if (loadingLoan) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading loan details...</p></div>;
  }

  if (!loan) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <p>Loan not found.</p>
        <Link to="/lending" className="btn btn-primary">Back to Loans</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/lending" className="btn btn-sm btn-outline" title="Back to loans">←</Link>
          <h1>{loan.clientName}</h1>
        </div>
        <div className="page-actions">
          <Link to={`/lending/${id}/edit`} className="btn btn-outline">✏️ Edit</Link>
          {loan.status === 'active' ? (
            <button className="btn btn-danger" onClick={handleCloseLoan}>Close Loan</button>
          ) : (
            <button className="btn btn-success" onClick={handleReopenLoan}>Reopen Loan</button>
          )}
          <button className="btn btn-export" onClick={handleExport}>📥 Export Excel</button>
        </div>
      </div>

      {/* Loan Info */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Principal Amount</div>
            <div className="detail-value">{formatCurrency(loan.principalAmount)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Monthly Interest Rate</div>
            <div className="detail-value">{formatPercent(loan.monthlyInterestRate)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Loan Date</div>
            <div className="detail-value">{formatDate(loan.loanDate)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Phone</div>
            <div className="detail-value">{loan.clientPhone || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Status</div>
            <div className="detail-value">
              <span className={`badge badge-${loan.status}`}>{loan.status}</span>
            </div>
          </div>
          {loan.notes && (
            <div className="detail-item">
              <div className="detail-label">Notes</div>
              <div className="detail-value">{loan.notes}</div>
            </div>
          )}
          <div className="detail-item">
            <div className="detail-label">Added By</div>
            <div className="detail-value">{loan.createdBy || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Added On</div>
            <div className="detail-value">{loan.createdAt ? formatDate(loan.createdAt) : '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Modified By</div>
            <div className="detail-value">{loan.modifiedBy || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Modified On</div>
            <div className="detail-value">{loan.updatedAt ? formatDate(loan.updatedAt) : '—'}</div>
          </div>
        </div>
      </div>

      {/* Calculated Summary */}
      {summary && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="label">Principal Amount</div>
            <div className="value">{formatCurrency(summary.principal)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Monthly Interest</div>
            <div className="value">{formatCurrency(summary.monthlyInterest)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Days to FY End</div>
            <div className="value text-primary">{summary.daysTillFYEnd}</div>
          </div>
          <div className="summary-card">
            <div className="label">Interest till End Date</div>
            <div className="value text-success">{formatCurrency(summary.interestTillFYEnd)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Total Due (Principal + Interest)</div>
            <div className="value text-primary">{formatCurrency(summary.totalDue)}</div>
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
