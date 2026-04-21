import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection, deleteDocument } from '../../../hooks/useFirestore';
import { getBorrowingSummary } from '../utils/lendingCalcs';
import { exportToExcel } from '../../../services/exportService';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatDate, getCurrentFYLabel } from '../../../utils/dateUtils';
import LendingTabs from '../components/LendingTabs';
import Tooltip from '../../../components/Tooltip';
import Toast from '../../../components/Toast';
import RapidEntry from '../components/RapidEntry';
import { useOrg, getOrgCollection } from '../../../context/OrgContext';

export default function BorrowingList() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const { selectedOrg } = useOrg();

  const { data: allBorrowings, loading } = useCollection(getOrgCollection(selectedOrg, 'borrowings'));
  const { data: allLoans } = useCollection(getOrgCollection(selectedOrg, 'loans'));

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
    const rows = sortedData.map(({ borrowing: b, summary: s }) => {
      const row = {
        date: formatDate(b.borrowDate),
        amount: b.amount,
        clientName: b.clientName,
        interestTillFY: s.interestTillFYEnd,
        totalCredit: s.totalCredit,
        rate: b.monthlyInterestRate,
      };
      if (filter === 'all') row.status = b.status || 'active';
      return row;
    });

    const cols = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Int. till End Date', key: 'interestTillFY', width: 20 },
      { header: 'Total Credit', key: 'totalCredit', width: 15 },
      { header: 'Rate/Mo', key: 'rate', width: 10, noTotal: true },
    ];
    if (filter === 'all') cols.push({ header: 'Status', key: 'status', width: 10 });

    exportToExcel(rows, cols, `Borrowings FY ${getCurrentFYLabel()}`, `${selectedOrg}_Borrowings_${getCurrentFYLabel()}`);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete closed borrowing for "${name}"?`)) return;
    setDeleting(id);
    try {
      await deleteDocument(`${getOrgCollection(selectedOrg, 'borrowings')}/${id}`);
      setToast({ message: 'Borrowing deleted', type: 'success' });
    } catch (err) {
      setToast({ message: 'Error deleting borrowing', type: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    const closedItems = allBorrowings.filter(b => (b.status || 'active') === 'closed');
    if (!closedItems.length) return;
    if (!window.confirm(`Delete all ${closedItems.length} closed borrowing(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(closedItems.map(b => deleteDocument(`${getOrgCollection(selectedOrg, 'borrowings')}/${b.id}`)));
      setToast({ message: `${closedItems.length} closed borrowing(s) deleted`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Error deleting some borrowings', type: 'error' });
    }
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
          <button className="btn btn-primary" onClick={() => setQuickEntryOpen(prev => !prev)}>
            {quickEntryOpen ? '✕ Close' : '+ New Borrowing'}
          </button>
          {filtered.length > 0 && (
            <button className="btn btn-export" onClick={handleExport}>📥 Export Excel</button>
          )}
          {filter === 'closed' && filtered.length > 0 && (
            <button className="btn btn-danger" onClick={handleDeleteAll}>🗑️ Delete All Closed</button>
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

      <RapidEntry type="borrowing" allLoans={allLoans} open={quickEntryOpen} onToggle={() => setQuickEntryOpen(prev => !prev)} />

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
          <p>No borrowings found.</p>
        </div>
      ) : (
        <div className={`table-wrap${filter === 'closed' ? ' table-closed' : ''}`}>
          <table>
            <thead>
              <tr>
                {filter === 'closed' && <th style={{ width: '2.5rem' }}></th>}
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
                  {filter === 'closed' && (
                    <td>
                      <button
                        className="btn-icon-delete"
                        title="Delete"
                        onClick={() => handleDelete(b.id, b.clientName)}
                        disabled={deleting === b.id}
                      >
                        {deleting === b.id ? '...' : '🗑️'}
                      </button>
                    </td>
                  )}
                  <td>{formatDate(b.borrowDate)}</td>
                  <td className="text-right">{formatCurrency(b.amount)}</td>
                  <td>
                    <Link to={`/money-lending/borrowing/${b.id}`} style={{ color: '#4361ee', fontWeight: 500 }}>
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
