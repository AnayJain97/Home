import { Link } from 'react-router-dom';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatDate } from '../../../utils/dateUtils';
import Tooltip from '../../../components/Tooltip';

export default function LoanTable({ loans, summaries, filter }) {
  const showStatus = filter === 'all';
  if (loans.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💰</div>
        <p>No loans found. Start by adding your first loan!</p>
        <Link to="/lending/new" className="btn btn-primary">Add New Loan</Link>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="text-right">Principal</th>
            <th>Client</th>
            <th className="text-right">
              Int. till End Date
              <Tooltip text="Hover rows for detailed formula" />
            </th>
            <th className="text-right">Total Due</th>
            <th className="text-right">Rate/Mo</th>
            {showStatus && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {loans.map((loan, idx) => {
            const s = summaries[idx];
            return (
              <tr key={loan.id}>
                <td>{formatDate(loan.loanDate)}</td>
                <td className="text-right">{formatCurrency(loan.principalAmount)}</td>
                <td>
                  <Link to={`/lending/${loan.id}`} style={{ color: '#4361ee', fontWeight: 500 }}>
                    {loan.clientName}
                  </Link>
                </td>
                <td className="text-right">
                  {formatCurrency(s.interestTillFYEnd)}
                  <Tooltip text={s.formulaText} />
                </td>
                <td className="text-right">{formatCurrency(s.totalDue)}</td>
                <td className="text-right">{formatPercent(loan.monthlyInterestRate)}</td>
                {showStatus && (
                  <td>
                    <span className={`badge badge-${loan.status}`}>
                      {loan.status}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
