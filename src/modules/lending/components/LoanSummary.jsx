import { formatCurrency } from '../../../utils/formatUtils';

export default function LoanSummary({ loans, summaries }) {
  const totalPrincipal = summaries.reduce((sum, s) => sum + s.principal, 0);
  const totalInterestTillFY = summaries.reduce((sum, s) => sum + s.interestTillFYEnd, 0);
  const totalDue = summaries.reduce((sum, s) => sum + s.totalDue, 0);
  const activeCount = loans.filter(l => l.status === 'active').length;

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div className="label">Active Loans</div>
        <div className="value text-primary">{activeCount}</div>
      </div>
      <div className="summary-card">
        <div className="label">Total Lent</div>
        <div className="value">{formatCurrency(totalPrincipal)}</div>
      </div>
      <div className="summary-card">
        <div className="label">Interest till End Date</div>
        <div className="value" style={{ color: '#28a745' }}>{formatCurrency(totalInterestTillFY)}</div>
      </div>
      <div className="summary-card">
        <div className="label">Total Due (Principal + Interest)</div>
        <div className="value" style={{ color: '#28a745' }}>{formatCurrency(totalDue)}</div>
      </div>
    </div>
  );
}
