import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../../hooks/useFirestore';
import { getClientFinalized } from '../utils/lendingCalcs';
import { exportToExcel } from '../../../services/exportService';
import { formatCurrency } from '../../../utils/formatUtils';
import { getCurrentFYLabel, toJSDate } from '../../../utils/dateUtils';
import LendingTabs from '../components/LendingTabs';
import FYAccordion from '../components/FYAccordion';
import { useOrg, getOrgCollection } from '../../../context/OrgContext';

export default function FinalizedView() {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('client');
  const [sortDir, setSortDir] = useState('asc');
  const { selectedOrg } = useOrg();

  const { data: loans, loading: loadingLoans } = useCollection(getOrgCollection(selectedOrg, 'loans'));
  const { data: borrowings, loading: loadingBorrowings } = useCollection(getOrgCollection(selectedOrg, 'borrowings'));

  // Group active loans & borrowings by FY, compute per-FY finalized summaries
  const fyGroupedFinalized = useMemo(() => {
    const activeLoans = loans.filter(l => l.status === 'active');
    const activeBorrowings = borrowings.filter(b => (b.status || 'active') === 'active');

    // Collect all FYs from both loans and borrowings
    const fySet = new Set();
    activeLoans.forEach(l => fySet.add(getCurrentFYLabel(toJSDate(l.loanDate))));
    activeBorrowings.forEach(b => fySet.add(getCurrentFYLabel(toJSDate(b.borrowDate))));

    const fyLabels = [...fySet].sort((a, b) => b.localeCompare(a));

    const grouped = {};
    fyLabels.forEach(fy => {
      const fyLoans = activeLoans.filter(l => getCurrentFYLabel(toJSDate(l.loanDate)) === fy);
      const fyBorrowings = activeBorrowings.filter(b => getCurrentFYLabel(toJSDate(b.borrowDate)) === fy);
      const summaries = getClientFinalized(fyLoans, fyBorrowings);
      if (summaries.length > 0) grouped[fy] = summaries;
    });

    return grouped;
  }, [loans, borrowings]);

  // Current FY summaries for the summary cards
  const currentFYSummaries = useMemo(() => {
    const currentFY = getCurrentFYLabel();
    return fyGroupedFinalized[currentFY] || [];
  }, [fyGroupedFinalized]);

  // Apply search filter per FY group
  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return fyGroupedFinalized;
    const s = search.toLowerCase();
    const result = {};
    Object.entries(fyGroupedFinalized).forEach(([fy, summaries]) => {
      const filtered = summaries.filter(c => c.clientName.toLowerCase().includes(s));
      if (filtered.length > 0) result[fy] = filtered;
    });
    return result;
  }, [fyGroupedFinalized, search]);

  // Sort within each FY group
  const sortedGrouped = useMemo(() => {
    const result = {};
    Object.entries(filteredGrouped).forEach(([fy, items]) => {
      const sorted = [...items];
      if (sortCol) {
        sorted.sort((a, b) => {
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
      }
      result[fy] = sorted;
    });
    return result;
  }, [filteredGrouped, sortCol, sortDir]);

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

  // Grand totals from current FY for summary cards
  const grandTotals = useMemo(() => {
    const src = currentFYSummaries;
    return {
      totalLendingDue: src.reduce((s, c) => s + c.totalLendingDue, 0),
      totalBorrowingCredit: src.reduce((s, c) => s + c.totalBorrowingCredit, 0),
      netAmount: src.reduce((s, c) => s + c.netAmount, 0),
    };
  }, [currentFYSummaries]);

  const handleExport = () => {
    // Export current FY data
    const currentFY = getCurrentFYLabel();
    const data = sortedGrouped[currentFY] || [];
    const rows = data.map(c => ({
      clientName: c.clientName,
      totalLent: c.totalLent,
      lendingInterest: c.totalLendingInterest,
      totalLendingDue: c.totalLendingDue,
      totalBorrowed: c.totalBorrowed,
      borrowingInterest: c.totalBorrowingInterest,
      totalBorrowingCredit: c.totalBorrowingCredit,
      netAmount: c.netAmount,
    }));

    exportToExcel(rows, [
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Lent', key: 'totalLent', width: 15 },
      { header: 'Lending Int.', key: 'lendingInterest', width: 15 },
      { header: 'Lending Due', key: 'totalLendingDue', width: 15 },
      { header: 'Borrowed', key: 'totalBorrowed', width: 15 },
      { header: 'Borrowing Int.', key: 'borrowingInterest', width: 15 },
      { header: 'Credit', key: 'totalBorrowingCredit', width: 15 },
      { header: 'Net', key: 'netAmount', width: 15 },
    ], `Finalized FY ${currentFY}`, `${selectedOrg}_Finalized_${currentFY}`);
  };

  if (loadingLoans || loadingBorrowings) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  }

  const computeFYTotals = (items) => ({
    totalLent: items.reduce((s, c) => s + c.totalLent, 0),
    totalLendingInterest: items.reduce((s, c) => s + c.totalLendingInterest, 0),
    totalLendingDue: items.reduce((s, c) => s + c.totalLendingDue, 0),
    totalBorrowed: items.reduce((s, c) => s + c.totalBorrowed, 0),
    totalBorrowingInterest: items.reduce((s, c) => s + c.totalBorrowingInterest, 0),
    totalBorrowingCredit: items.reduce((s, c) => s + c.totalBorrowingCredit, 0),
    netAmount: items.reduce((s, c) => s + c.netAmount, 0),
  });

  return (
    <div>
      <LendingTabs />

      <div className="page-header">
        <h1>Finalized View</h1>
        <div className="page-actions">
          {currentFYSummaries.length > 0 && (
            <button className="btn btn-export" onClick={handleExport}>📥 Export Excel</button>
          )}
        </div>
      </div>

      {/* Grand totals — current FY */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">Total Lent + Interest (Current FY)</div>
          <div className="value" style={{ color: '#28a745' }}>{formatCurrency(grandTotals.totalLendingDue)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Borrowed + Interest (Current FY)</div>
          <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(grandTotals.totalBorrowingCredit)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Net Receivable (Current FY)</div>
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

      <FYAccordion
        groupedData={sortedGrouped}
        emptyMessage="No data yet. Add lendings and borrowings to see the finalized view."
        renderSection={(fy, items) => {
          const totals = computeFYTotals(items);
          return (
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
                  {items.map(c => (
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
                    <td className="text-right" style={{ color: '#28a745' }}>{formatCurrency(totals.totalLent)}</td>
                    <td className="text-right" style={{ color: '#28a745' }}>{formatCurrency(totals.totalLendingInterest)}</td>
                    <td className="text-right" style={{ color: '#28a745' }}>{formatCurrency(totals.totalLendingDue)}</td>
                    <td className="text-right" style={{ color: '#dc3545' }}>{formatCurrency(totals.totalBorrowed)}</td>
                    <td className="text-right" style={{ color: '#dc3545' }}>{formatCurrency(totals.totalBorrowingInterest)}</td>
                    <td className="text-right" style={{ color: '#dc3545' }}>{formatCurrency(totals.totalBorrowingCredit)}</td>
                    <td className="text-right" style={{ color: totals.netAmount >= 0 ? '#28a745' : '#dc3545' }}>
                      {totals.netAmount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(totals.netAmount))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        }}
      />
    </div>
  );
}
