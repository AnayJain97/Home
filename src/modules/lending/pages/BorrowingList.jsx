import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../../hooks/useFirestore';
import { getBorrowingSummary } from '../utils/lendingCalcs';
import { exportToExcel } from '../../../services/exportService';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatDate, getCurrentFYLabel } from '../../../utils/dateUtils';
import LendingTabs from '../components/LendingTabs';
import Tooltip from '../../../components/Tooltip';

export default function BorrowingList() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const { data: allBorrowings, loading } = useCollection('borrowings');

  const filtered = useMemo(() => {
    let items = allBorrowings;
    if (filter !== 'all') {
      items = items.filter(b => (b.status || 'active') === filter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      items = items.filter(b => b.clientName.toLowerCase().includes(s));
    }
    return items;
  }, [allBorrowings, filter, search]);

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

  const totals = useMemo(() => ({
    count: filtered.length,
    totalBorrowed: filtered.reduce((s, b) => s + b.amount, 0),
    totalInterest: summaries.reduce((s, v) => s + v.interestTillFYEnd, 0),
    totalCredit: summaries.reduce((s, v) => s + v.totalCredit, 0),
  }), [filtered, summaries]);

  const handleExport = () => {
    const rows = sortedData.map(({ borrowing: b, summary: s }) => ({
      date: formatDate(b.borrowDate),
      amount: b.amount,
      clientName: b.clientName,
      interestTillFY: s.interestTillFYEnd,
      totalCredit: s.totalCredit,
    }));

    exportToExcel(rows, [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Amount (₹)', key: 'amount', width: 15 },
      { header: 'Name', key: 'clientName', width: 20 },
      { header: 'Interest till End Date (₹)', key: 'interestTillFY', width: 22 },
      { header: 'Total Credit (₹)', key: 'totalCredit', width: 15 },
    ], `Borrowings FY ${getCurrentFYLabel()}`, 'Borrowings');
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
          <Link to="/lending/borrowings/new" className="btn btn-primary">+ New Borrowing</Link>
          {filtered.length > 0 && (
            <button className="btn btn-export" onClick={handleExport}>📥 Export Excel</button>
          )}
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">Active Entries</div>
          <div className="value text-primary">{totals.count}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Received</div>
          <div className="value">{formatCurrency(totals.totalBorrowed)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Interest till End Date</div>
          <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(totals.totalInterest)}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Credit (Amount + Interest)</div>
          <div className="value" style={{ color: '#dc3545' }}>{formatCurrency(totals.totalCredit)}</div>
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
        <div className="filter-tabs">
          {['active', 'closed', 'all'].map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {sortedData.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔄</div>
          <p>No borrowings found. Record money received back from clients here.</p>
          <Link to="/lending/borrowings/new" className="btn btn-primary">Add Borrowing</Link>
        </div>
      ) : (
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
                {filter === 'all' && <th>Status</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(({ borrowing: b, summary: s }) => (
                <tr key={b.id}>
                  <td>{formatDate(b.borrowDate)}</td>
                  <td className="text-right">{formatCurrency(b.amount)}</td>
                  <td>
                    <Link to={`/lending/borrowings/${b.id}`} style={{ color: '#4361ee', fontWeight: 500 }}>
                      {b.clientName}
                    </Link>
                  </td>
                  <td className="text-right" style={{ color: '#dc3545' }}>
                    {formatCurrency(s.interestTillFYEnd)}
                    <Tooltip text={s.formulaText} />
                  </td>
                  <td className="text-right" style={{ color: '#dc3545', fontWeight: 600 }}>
                    {formatCurrency(s.totalCredit)}
                  </td>
                  <td className="text-right">{formatPercent(b.monthlyInterestRate)}</td>
                  {filter === 'all' && (
                    <td>
                      <span className={`badge badge-${b.status || 'active'}`}>{b.status || 'active'}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
