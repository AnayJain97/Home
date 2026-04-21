import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../../hooks/useFirestore';
import { getClientFinalized } from '../utils/lendingCalcs';
import { exportToExcel } from '../../../services/exportService';
import { formatCurrency } from '../../../utils/formatUtils';
import { getCurrentFYLabel } from '../../../utils/dateUtils';
import LendingTabs from '../components/LendingTabs';

export default function FinalizedView() {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const { data: loans, loading: loadingLoans } = useCollection('loans');
  const { data: borrowings, loading: loadingBorrowings } = useCollection('borrowings');

  const clientSummaries = useMemo(() => {
    if (!loans.length && !borrowings.length) return [];
    return getClientFinalized(
      loans.filter(l => l.status === 'active'),
      borrowings.filter(b => (b.status || 'active') === 'active')
    );
  }, [loans, borrowings]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clientSummaries;
    const s = search.toLowerCase();
    return clientSummaries.filter(c => c.clientName.toLowerCase().includes(s));
  }, [clientSummaries, search]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    if (!sortCol) return items;
    items.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'client': va = a.clientName.toLowerCase(); vb = b.clientName.toLowerCase(); break;
        case 'lent': va = a.totalLent; vb = b.totalLent; break;
        case 'lendInt': va = a.totalLendingInterest; vb = b.totalLendingInterest; break;
        case 'lendDue': va = a.totalLendingDue; vb = b.totalLendingDue; break;
        case 'borrowed': va = a.totalBorrowed; vb = b.totalBorrowed; break;
        case 'borInt': va = a.totalBorrowingInterest; vb = b.totalBorrowingInterest; break;
        case 'credit': va = a.totalBorrowingCredit; vb = b.totalBorrowingCredit; break;
        case 'net': va = a.netAmount; vb = b.netAmount; break;
        default: return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortTh = ({ col, children, className }) => (
    <th className={`sortable ${className || ''}`} onClick={() => handleSort(col)}>
      {children}
      {sortCol === col && <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
    </th>
  );

  const grandTotals = useMemo(() => ({
    totalLent: filtered.reduce((s, c) => s + c.totalLent, 0),
    totalLendingInterest: filtered.reduce((s, c) => s + c.totalLendingInterest, 0),
    totalLendingDue: filtered.reduce((s, c) => s + c.totalLendingDue, 0),
    totalBorrowed: filtered.reduce((s, c) => s + c.totalBorrowed, 0),
    totalBorrowingInterest: filtered.reduce((s, c) => s + c.totalBorrowingInterest, 0),
    totalBorrowingCredit: filtered.reduce((s, c) => s + c.totalBorrowingCredit, 0),
    netAmount: filtered.reduce((s, c) => s + c.netAmount, 0),
  }), [filtered]);

  const handleExport = () => {
    const rows = sorted.map(c => ({
      clientName: c.clientName,
      totalLent: c.totalLent,
      lendingInterest: c.totalLendingInterest,
      totalLendingDue: c.totalLendingDue,
      totalBorrowed: c.totalBorrowed,
      borrowingInterest: c.totalBorrowingInterest,
      totalBorrowingCredit: c.totalBorrowingCredit,
      netAmount: c.netAmount,
    }));

    // Add grand total row
    rows.push({
      clientName: 'GRAND TOTAL',
      totalLent: grandTotals.totalLent,
      lendingInterest: grandTotals.totalLendingInterest,
      totalLendingDue: grandTotals.totalLendingDue,
      totalBorrowed: grandTotals.totalBorrowed,
      borrowingInterest: grandTotals.totalBorrowingInterest,
      totalBorrowingCredit: grandTotals.totalBorrowingCredit,
      netAmount: grandTotals.netAmount,
    });

    exportToExcel(rows, [
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Lent', key: 'totalLent', width: 15 },
      { header: 'Lending Int.', key: 'lendingInterest', width: 15 },
      { header: 'Lending Due', key: 'totalLendingDue', width: 15 },
      { header: 'Borrowed', key: 'totalBorrowed', width: 15 },
      { header: 'Borrowing Int.', key: 'borrowingInterest', width: 15 },
      { header: 'Credit', key: 'totalBorrowingCredit', width: 15 },
      { header: 'Net', key: 'netAmount', width: 15 },
    ], `Finalized FY ${getCurrentFYLabel()}`, `Finalized_${getCurrentFYLabel()}`);
  };

  if (loadingLoans || loadingBorrowings) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  }

  return (
    <div>
      <LendingTabs />

      <div className="page-header">
        <h1>Finalized View</h1>
        <div className="page-actions">
          {filtered.length > 0 && (
            <button className="btn btn-export" onClick={handleExport}>📥 Export Excel</button>
          )}
        </div>
      </div>

      {/* Grand totals */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">Total Lent + Interest</div>
          <div className="value" style={{ color: '#28a745' }}>{formatCurrency(grandTotals.totalLendingDue)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Borrowed + Interest</div>
          <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(grandTotals.totalBorrowingCredit)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Net Receivable</div>
          <div className="value" style={{ color: grandTotals.netAmount >= 0 ? '#28a745' : '#dc3545' }}>
            {formatCurrency(Math.abs(grandTotals.netAmount))}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by client name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p>No data yet. Add lendings and borrowings to see the finalized view.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh col="client">Client</SortTh>
                <SortTh col="lent" className="text-right">Lent</SortTh>
                <SortTh col="lendInt" className="text-right">Lending Int.</SortTh>
                <SortTh col="lendDue" className="text-right">Lending Due</SortTh>
                <SortTh col="borrowed" className="text-right">Borrowed</SortTh>
                <SortTh col="borInt" className="text-right">Borrowing Int.</SortTh>
                <SortTh col="credit" className="text-right">Credit</SortTh>
                <SortTh col="net" className="text-right">Net</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.clientName}>
                  <td style={{ fontWeight: 500 }}>
                    <Link to={`/money-lending/client/${encodeURIComponent(c.clientName)}`} style={{ color: '#4361ee', fontWeight: 500 }}>
                      {c.clientName}
                    </Link>
                  </td>
                  <td className="text-right">{formatCurrency(c.totalLent)}</td>
                  <td className="text-right">{formatCurrency(c.totalLendingInterest)}</td>
                  <td className="text-right">{formatCurrency(c.totalLendingDue)}</td>
                  <td className="text-right">{formatCurrency(c.totalBorrowed)}</td>
                  <td className="text-right">{formatCurrency(c.totalBorrowingInterest)}</td>
                  <td className="text-right">{formatCurrency(c.totalBorrowingCredit)}</td>
                  <td className="text-right" style={{ fontWeight: 600, color: c.netAmount >= 0 ? '#28a745' : '#dc3545' }}>
                    {c.netAmount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(c.netAmount))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid #333' }}>
                <td>TOTAL</td>
                <td className="text-right" style={{ color: '#28a745' }}>{formatCurrency(grandTotals.totalLent)}</td>
                <td className="text-right" style={{ color: '#28a745' }}>{formatCurrency(grandTotals.totalLendingInterest)}</td>
                <td className="text-right" style={{ color: '#28a745' }}>{formatCurrency(grandTotals.totalLendingDue)}</td>
                <td className="text-right" style={{ color: '#dc3545' }}>{formatCurrency(grandTotals.totalBorrowed)}</td>
                <td className="text-right" style={{ color: '#dc3545' }}>{formatCurrency(grandTotals.totalBorrowingInterest)}</td>
                <td className="text-right" style={{ color: '#dc3545' }}>{formatCurrency(grandTotals.totalBorrowingCredit)}</td>
                <td className="text-right" style={{ color: grandTotals.netAmount >= 0 ? '#28a745' : '#dc3545' }}>
                  {grandTotals.netAmount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(grandTotals.netAmount))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
