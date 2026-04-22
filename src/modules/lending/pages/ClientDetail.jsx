import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCollection } from '../../../hooks/useFirestore';
import { getLendingSummary, getBorrowingSummary, getClientFinalized } from '../utils/lendingCalcs';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatDate, getCurrentFYLabel, toJSDate } from '../../../utils/dateUtils';
import Tooltip from '../../../components/Tooltip';
import FYAccordion from '../components/FYAccordion';
import { exportMultiSheetExcel } from '../../../services/exportService';
import { useOrg, getOrgCollection } from '../../../context/OrgContext';

export default function ClientDetail() {
  const { name } = useParams();
  const clientName = decodeURIComponent(name);
  const { selectedOrg } = useOrg();

  const { data: allLoans, loading: loadingLoans } = useCollection(getOrgCollection(selectedOrg, 'loans'));
  const { data: allBorrowings, loading: loadingBorrowings } = useCollection(getOrgCollection(selectedOrg, 'borrowings'));

  const clientLoans = useMemo(() => {
    return allLoans.filter(l => l.clientName.trim().toLowerCase() === clientName.trim().toLowerCase());
  }, [allLoans, clientName]);

  const clientBorrowings = useMemo(() => {
    return allBorrowings.filter(b => b.clientName.trim().toLowerCase() === clientName.trim().toLowerCase());
  }, [allBorrowings, clientName]);

  const loanSummaries = useMemo(() => clientLoans.map(getLendingSummary), [clientLoans]);
  const borrowingSummaries = useMemo(() => clientBorrowings.map(getBorrowingSummary), [clientBorrowings]);

  const finalized = useMemo(() => {
    const currentFY = getCurrentFYLabel();
    const activeLoans = clientLoans.filter(l => l.status === 'active' && getCurrentFYLabel(toJSDate(l.loanDate)) === currentFY);
    const activeBorrowings = clientBorrowings.filter(b => (b.status || 'active') === 'active' && getCurrentFYLabel(toJSDate(b.borrowDate)) === currentFY);
    const results = getClientFinalized(activeLoans, activeBorrowings);
    return results.length > 0 ? results[0] : null;
  }, [clientLoans, clientBorrowings]);

  // Group loans by FY
  const loansByFY = useMemo(() => {
    const grouped = {};
    clientLoans.forEach((loan, idx) => {
      const fy = getCurrentFYLabel(toJSDate(loan.loanDate));
      if (!grouped[fy]) grouped[fy] = [];
      grouped[fy].push({ loan, summary: loanSummaries[idx] });
    });
    const sorted = {};
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(k => { sorted[k] = grouped[k]; });
    return sorted;
  }, [clientLoans, loanSummaries]);

  // Group borrowings by FY
  const borrowingsByFY = useMemo(() => {
    const grouped = {};
    clientBorrowings.forEach((b, idx) => {
      const fy = getCurrentFYLabel(toJSDate(b.borrowDate));
      if (!grouped[fy]) grouped[fy] = [];
      grouped[fy].push({ borrowing: b, summary: borrowingSummaries[idx] });
    });
    const sorted = {};
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(k => { sorted[k] = grouped[k]; });
    return sorted;
  }, [clientBorrowings, borrowingSummaries]);

  if (loadingLoans || loadingBorrowings) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  }

  const handleExport = () => {
    const sheets = [];

    if (clientLoans.length > 0) {
      sheets.push({
        sheetName: 'Lendings',
        columns: [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Principal', key: 'principal', width: 15 },
          { header: 'Rate/Mo', key: 'rate', width: 10, noTotal: true },
          { header: 'Interest', key: 'interest', width: 15 },
          { header: 'Total Due', key: 'totalDue', width: 15 },
          { header: 'Status', key: 'status', width: 10 },
        ],
        data: clientLoans.map((loan, idx) => ({
          date: formatDate(loan.loanDate),
          principal: loan.principalAmount,
          rate: loan.monthlyInterestRate,
          interest: loanSummaries[idx].interestTillFYEnd,
          totalDue: loanSummaries[idx].totalDue,
          status: loan.status,
        })),
      });
    }

    if (clientBorrowings.length > 0) {
      sheets.push({
        sheetName: 'Borrowings',
        columns: [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Amount', key: 'amount', width: 15 },
          { header: 'Rate/Mo', key: 'rate', width: 10, noTotal: true },
          { header: 'Interest', key: 'interest', width: 15 },
          { header: 'Total Credit', key: 'totalCredit', width: 15 },
          { header: 'Status', key: 'status', width: 10 },
        ],
        data: clientBorrowings.map((b, idx) => ({
          date: formatDate(b.borrowDate),
          amount: b.amount,
          rate: b.monthlyInterestRate,
          interest: borrowingSummaries[idx].interestTillFYEnd,
          totalCredit: borrowingSummaries[idx].totalCredit,
          status: b.status || 'active',
        })),
      });
    }

    if (sheets.length > 0) {
      exportMultiSheetExcel(sheets, `${selectedOrg}_${clientName.replace(/\s+/g, '_')}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/money-lending/finalized" className="btn btn-sm btn-outline" title="Back">←</Link>
          <h1>{clientName}</h1>
        </div>
        <div className="page-actions">
          {(clientLoans.length > 0 || clientBorrowings.length > 0) && (
            <button className="btn btn-export" onClick={handleExport}>📥 Export Excel</button>
          )}
        </div>
      </div>

      {/* Net Summary — Current FY */}
      {finalized && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="label">Total Lending Due (Current FY)</div>
            <div className="value" style={{ color: '#28a745' }}>{formatCurrency(finalized.totalLendingDue)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Total Borrowing Credit (Current FY)</div>
            <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(finalized.totalBorrowingCredit)}</div>
          </div>
          <div className="summary-card">
            <div className="label">Net Amount (Current FY)</div>
            <div className="value" style={{ color: finalized.netAmount >= 0 ? '#28a745' : '#dc3545', fontWeight: 700 }}>
              {finalized.netAmount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(finalized.netAmount))}
            </div>
          </div>
        </div>
      )}

      {/* Lendings */}
      <h2 style={{ margin: '1.5rem 0 0.75rem' }}>Lendings ({clientLoans.length})</h2>
      {clientLoans.length === 0 ? (
        <p style={{ color: '#999' }}>No lending records for this client.</p>
      ) : (
        <FYAccordion
          groupedData={loansByFY}
          renderSection={(fy, items) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Principal</th>
                    <th className="text-right">Rate/Mo</th>
                    <th className="text-right">Interest</th>
                    <th className="text-right">Total Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ loan, summary: s }) => (
                    <tr key={loan.id} className={loan.isCarryForward ? 'carry-forward-row' : ''}>
                      <td>
                        <Link to={`/money-lending/lending/${loan.id}`} style={{ color: '#4361ee' }}>
                          {formatDate(loan.loanDate)}
                        </Link>
                      </td>
                      <td className="text-right">{formatCurrency(loan.principalAmount)}</td>
                      <td className="text-right">{formatPercent(loan.monthlyInterestRate)}</td>
                      <td className="text-right" style={{ color: '#28a745' }}>
                        {formatCurrency(s.interestTillFYEnd)}
                        <Tooltip text={s.formulaText} />
                      </td>
                      <td className="text-right" style={{ color: '#28a745', fontWeight: 600 }}>
                        {formatCurrency(s.totalDue)}
                      </td>
                      <td>
                        <span className={`badge badge-${loan.status}`}>{loan.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />
      )}

      {/* Borrowings */}
      <h2 style={{ margin: '1.5rem 0 0.75rem' }}>Borrowings ({clientBorrowings.length})</h2>
      {clientBorrowings.length === 0 ? (
        <p style={{ color: '#999' }}>No borrowing records for this client.</p>
      ) : (
        <FYAccordion
          groupedData={borrowingsByFY}
          renderSection={(fy, items) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Rate/Mo</th>
                    <th className="text-right">Interest</th>
                    <th className="text-right">Total Credit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ borrowing: b, summary: s }) => (
                    <tr key={b.id} className={b.isCarryForward ? 'carry-forward-row' : ''}>
                      <td>
                        <Link to={`/money-lending/borrowing/${b.id}`} style={{ color: '#4361ee' }}>
                          {formatDate(b.borrowDate)}
                        </Link>
                      </td>
                      <td className="text-right">{formatCurrency(b.amount)}</td>
                      <td className="text-right">{formatPercent(b.monthlyInterestRate)}</td>
                      <td className="text-right" style={{ color: '#dc3545' }}>
                        {formatCurrency(s.interestTillFYEnd)}
                        <Tooltip text={s.formulaText} />
                      </td>
                      <td className="text-right" style={{ color: '#dc3545', fontWeight: 600 }}>
                        {formatCurrency(s.totalCredit)}
                      </td>
                      <td>
                        <span className={`badge badge-${b.status || 'active'}`}>{b.status || 'active'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />
      )}
    </div>
  );
}
