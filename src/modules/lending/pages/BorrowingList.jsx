import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../../hooks/useFirestore';
import { useCarryForward } from '../../../hooks/useCarryForward';
import { getBorrowingSummary } from '../utils/lendingCalcs';
import { exportToExcel } from '../../../services/exportService';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatDate, getCurrentFYLabel, toJSDate } from '../../../utils/dateUtils';
import LendingTabs from '../components/LendingTabs';
import FYAccordion from '../components/FYAccordion';
import Tooltip from '../../../components/Tooltip';
import Toast from '../../../components/Toast';
import RapidEntry from '../components/RapidEntry';
import { useOrg, getOrgCollection } from '../../../context/OrgContext';

export default function BorrowingList() {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [toast, setToast] = useState(null);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const { selectedOrg, canWrite } = useOrg();

  const { data: allBorrowings, loading } = useCollection(getOrgCollection(selectedOrg, 'borrowings'));
  const { data: allLoans, loading: loadingLoans } = useCollection(getOrgCollection(selectedOrg, 'loans'));

  // Auto-create/update carry-forward entries (ensures they exist even if Loans page hasn't been visited)
  useCarryForward(selectedOrg, allLoans, allBorrowings, canWrite && !loading && !loadingLoans);

  const filtered = useMemo(() => {
    let items = allBorrowings;
    if (search.trim()) {
      const s = search.toLowerCase();
      items = items.filter(b => b.clientName.toLowerCase().includes(s));
    }
    return items;
  }, [allBorrowings, search]);

  const summaries = useMemo(() => filtered.map(getBorrowingSummary), [filtered]);

  const sortedData = useMemo(() => {
    const combined = filtered.map((b, idx) => ({ borrowing: b, summary: summaries[idx] }));
    if (!sortCol) return combined;
    combined.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'date': va = new Date(a.borrowing.borrowDate?.toDate?.() || a.borrowing.borrowDate); vb = new Date(b.borrowing.borrowDate?.toDate?.() || b.borrowing.borrowDate); break;
        case 'amount': va = a.borrowing.amount; vb = b.borrowing.amount; break;
        case 'client': va = a.borrowing.clientName.toLowerCase(); vb = b.borrowing.clientName.toLowerCase(); break;
        case 'interest': va = a.summary.interestTillFYEnd; vb = b.summary.interestTillFYEnd; break;
        case 'total': va = a.summary.totalCredit; vb = b.summary.totalCredit; break;
        case 'rate': va = a.borrowing.monthlyInterestRate; vb = b.borrowing.monthlyInterestRate; break;
        default: return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return combined;
  }, [filtered, summaries, sortCol, sortDir]);

  // Group sorted data by FY for accordion display
  const fyGroupedData = useMemo(() => {
    const grouped = {};
    sortedData.forEach(item => {
      const fy = getCurrentFYLabel(toJSDate(item.borrowing.borrowDate));
      if (!grouped[fy]) grouped[fy] = [];
      grouped[fy].push(item);
    });
    const sorted = {};
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(k => { sorted[k] = grouped[k]; });
    return sorted;
  }, [sortedData]);

  // Totals for current FY (includes carry-forward entries which have borrowDate in current FY)
  const currentFYTotals = useMemo(() => {
    const currentFY = getCurrentFYLabel();
    const fyItems = sortedData.filter(item =>
      getCurrentFYLabel(toJSDate(item.borrowing.borrowDate)) === currentFY
    );
    const fyBorrowings = fyItems.map(d => d.borrowing);
    const fySummaries = fyItems.map(d => d.summary);
    return {
      count: fyBorrowings.length,
      totalBorrowed: fyBorrowings.reduce((s, b) => s + b.amount, 0),
      totalInterest: fySummaries.reduce((s, v) => s + v.interestTillFYEnd, 0),
      totalCredit: fySummaries.reduce((s, v) => s + v.totalCredit, 0),
    };
  }, [sortedData]);

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

  const handleExport = () => {
    const rows = sortedData.map(({ borrowing: b, summary: s }) => ({
      date: formatDate(b.borrowDate),
      amount: b.amount,
      clientName: b.clientName,
      interestTillFY: s.interestTillFYEnd,
      totalCredit: s.totalCredit,
      rate: b.monthlyInterestRate,
    }));

    const cols = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Int. till End Date', key: 'interestTillFY', width: 20 },
      { header: 'Total Credit', key: 'totalCredit', width: 15 },
      { header: 'Rate/Mo', key: 'rate', width: 10, noTotal: true },
    ];

    exportToExcel(rows, cols, `Borrowings FY ${getCurrentFYLabel()}`, `${selectedOrg}_Borrowings_${getCurrentFYLabel()}`);
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  }

  return (
    <div>
      <LendingTabs />

      <div className="page-header">
        <h1>Borrowings (Money Received Back)</h1>
        <div className="page-actions">
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setQuickEntryOpen(prev => !prev)}>
              {quickEntryOpen ? '✕ Close' : '+ New Borrowing'}
            </button>
          )}
          {filtered.length > 0 && (
            <button className="btn btn-export" onClick={handleExport}>📥 Export Excel</button>
          )}
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">Entries (Current FY)</div>
          <div className="value text-primary">{currentFYTotals.count}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Received (Current FY)</div>
          <div className="value">{formatCurrency(currentFYTotals.totalBorrowed)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Interest till End Date (Current FY)</div>
          <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(currentFYTotals.totalInterest)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Credit (Current FY)</div>
          <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(currentFYTotals.totalCredit)}</div>
        </div>
      </div>

      <RapidEntry type="borrowing" allLoans={allLoans} open={quickEntryOpen} onToggle={() => setQuickEntryOpen(prev => !prev)} />

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by client name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {sortedData.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔄</div>
          <p>No borrowings found.</p>
        </div>
      ) : (
        <FYAccordion
          groupedData={fyGroupedData}
          emptyMessage="No borrowings found."
          renderSection={(fy, items) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortTh col="date">Date</SortTh>
                    <SortTh col="amount" className="text-right">Amount</SortTh>
                    <SortTh col="client">Client</SortTh>
                    <SortTh col="interest" className="text-right">Int. till End Date</SortTh>
                    <SortTh col="total" className="text-right">Total Credit</SortTh>
                    <SortTh col="rate" className="text-right">Rate/Mo</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ borrowing: b, summary: s }) => (
                    <tr key={b.id} className={b.isCarryForward ? 'carry-forward-row' : ''}>
                      <td>{formatDate(b.borrowDate)}</td>
                      <td className="text-right">{formatCurrency(b.amount)}</td>
                      <td>
                        <Link to={`/money-lending/borrowing/${b.id}`} style={{ color: '#4361ee', fontWeight: 500 }}>
                          {b.clientName}
                        </Link>
                        {b.isCarryForward && <span className="carry-forward-badge">↪ Carry Forward</span>}
                      </td>
                      <td className="text-right" style={{ color: '#dc3545' }}>
                        {formatCurrency(s.interestTillFYEnd)}
                        <Tooltip text={s.formulaText} />
                      </td>
                      <td className="text-right" style={{ color: '#dc3545', fontWeight: 600 }}>
                        {formatCurrency(s.totalCredit)}
                      </td>
                      <td className="text-right">{formatPercent(b.monthlyInterestRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
