import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection, deleteDocument } from '../../../hooks/useFirestore';
import { useCarryForward } from '../../../hooks/useCarryForward';
import { getLendingSummary } from '../utils/lendingCalcs';
import LoanSummary from '../components/LoanSummary';
import LendingTabs from '../components/LendingTabs';
import FYAccordion from '../components/FYAccordion';
import { exportToExcel } from '../../../services/exportService';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatDate, getCurrentFYLabel, toJSDate } from '../../../utils/dateUtils';
import Tooltip from '../../../components/Tooltip';
import Toast from '../../../components/Toast';
import RapidEntry from '../components/RapidEntry';
import { useOrg, getOrgCollection } from '../../../context/OrgContext';

export default function LoanList() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const { selectedOrg, canWrite } = useOrg();

  const { data: allLoans, loading } = useCollection(getOrgCollection(selectedOrg, 'loans'));
  const { data: allBorrowings } = useCollection(getOrgCollection(selectedOrg, 'borrowings'));

  // Auto-create/update carry-forward entries
  useCarryForward(selectedOrg, allLoans, allBorrowings, canWrite);

  const filteredLoans = useMemo(() => {
    let loans = allLoans;
    if (filter !== 'all') {
      loans = loans.filter(l => l.status === filter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      loans = loans.filter(l => l.clientName.toLowerCase().includes(s));
    }
    return loans;
  }, [allLoans, filter, search]);

  const summaries = useMemo(() => {
    return filteredLoans.map(getLendingSummary);
  }, [filteredLoans]);

  const sortedData = useMemo(() => {
    const combined = filteredLoans.map((loan, idx) => ({ loan, summary: summaries[idx] }));
    if (!sortCol) return combined;
    combined.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'date': va = new Date(a.loan.loanDate?.toDate?.() || a.loan.loanDate); vb = new Date(b.loan.loanDate?.toDate?.() || b.loan.loanDate); break;
        case 'principal': va = a.loan.principalAmount; vb = b.loan.principalAmount; break;
        case 'client': va = a.loan.clientName.toLowerCase(); vb = b.loan.clientName.toLowerCase(); break;
        case 'interest': va = a.summary.interestTillFYEnd; vb = b.summary.interestTillFYEnd; break;
        case 'total': va = a.summary.totalDue; vb = b.summary.totalDue; break;
        case 'rate': va = a.loan.monthlyInterestRate; vb = b.loan.monthlyInterestRate; break;
        default: return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return combined;
  }, [filteredLoans, summaries, sortCol, sortDir]);

  // Group sorted data by FY for accordion display
  const fyGroupedData = useMemo(() => {
    const grouped = {};
    sortedData.forEach(item => {
      const fy = getCurrentFYLabel(toJSDate(item.loan.loanDate));
      if (!grouped[fy]) grouped[fy] = [];
      grouped[fy].push(item);
    });
    // Sort keys descending
    const sorted = {};
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(k => { sorted[k] = grouped[k]; });
    return sorted;
  }, [sortedData]);

  // Summary for current FY only
  const currentFYData = useMemo(() => {
    const currentFY = getCurrentFYLabel();
    return sortedData.filter(item => getCurrentFYLabel(toJSDate(item.loan.loanDate)) === currentFY);
  }, [sortedData]);

  const currentFYLoans = useMemo(() => currentFYData.map(d => d.loan), [currentFYData]);
  const currentFYSummaries = useMemo(() => currentFYData.map(d => d.summary), [currentFYData]);

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
    const rows = sortedData.map(({ loan, summary: s }) => {
      const row = {
        loanDate: formatDate(loan.loanDate),
        principal: loan.principalAmount,
        clientName: loan.clientName,
        interestTillFY: s.interestTillFYEnd,
        totalDue: s.totalDue,
        rate: loan.monthlyInterestRate,
      };
      if (filter === 'all') row.status = loan.status;
      return row;
    });

    const cols = [
      { header: 'Date', key: 'loanDate', width: 12 },
      { header: 'Principal', key: 'principal', width: 15 },
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Int. till End Date', key: 'interestTillFY', width: 20 },
      { header: 'Total Due', key: 'totalDue', width: 15 },
      { header: 'Rate/Mo', key: 'rate', width: 10, noTotal: true },
    ];
    if (filter === 'all') cols.push({ header: 'Status', key: 'status', width: 10 });

    exportToExcel(rows, cols, `Loans FY ${getCurrentFYLabel()}`, `${selectedOrg}_Loans_${getCurrentFYLabel()}`);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete closed loan for "${name}"?`)) return;
    setDeleting(id);
    try {
      await deleteDocument(`${getOrgCollection(selectedOrg, 'loans')}/${id}`);
      setToast({ message: 'Loan deleted', type: 'success' });
    } catch (err) {
      setToast({ message: 'Error deleting loan', type: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    const closedLoans = allLoans.filter(l => l.status === 'closed');
    if (!closedLoans.length) return;
    if (!window.confirm(`Delete all ${closedLoans.length} closed loan(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(closedLoans.map(l => deleteDocument(`${getOrgCollection(selectedOrg, 'loans')}/${l.id}`)));
      setToast({ message: `${closedLoans.length} closed loan(s) deleted`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Error deleting some loans', type: 'error' });
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading loans...</p></div>;
  }

  return (
    <div>
      <LendingTabs />

      <div className="page-header">
        <h1>Lendings (Money Given Out)</h1>
        <div className="page-actions">
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setQuickEntryOpen(prev => !prev)}>
              {quickEntryOpen ? '✕ Close' : '+ New Loan'}
            </button>
          )}
          {filteredLoans.length > 0 && (
            <button className="btn btn-export" onClick={handleExport}>📥 Export Excel</button>
          )}
          {canWrite && filter === 'closed' && filteredLoans.length > 0 && (
            <button className="btn btn-danger" onClick={handleDeleteAll}>🗑️ Delete All Closed</button>
          )}
        </div>
      </div>

      <LoanSummary loans={currentFYLoans} summaries={currentFYSummaries} />

      <RapidEntry type="lending" allLoans={allLoans} open={quickEntryOpen} onToggle={() => setQuickEntryOpen(prev => !prev)} />

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
          <div className="empty-state-icon">💰</div>
          <p>No loans found.</p>
        </div>
      ) : (
        <FYAccordion
          groupedData={fyGroupedData}
          emptyMessage="No loans found."
          renderSection={(fy, items) => (
            <div className={`table-wrap${filter === 'closed' ? ' table-closed' : ''}`}>
              <table>
                <thead>
                  <tr>
                    {filter === 'closed' && <th style={{ width: '2.5rem' }}></th>}
                    <SortTh col="date">Date</SortTh>
                    <SortTh col="principal" className="text-right">Principal</SortTh>
                    <SortTh col="client">Client</SortTh>
                    <SortTh col="interest" className="text-right">
                      Int. till End Date
                    </SortTh>
                    <SortTh col="total" className="text-right">Total Due</SortTh>
                    <SortTh col="rate" className="text-right">Rate/Mo</SortTh>
                    {filter === 'all' && <th>Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ loan, summary: s }) => (
                    <tr key={loan.id} className={loan.isCarryForward ? 'carry-forward-row' : ''}>
                      {filter === 'closed' && (
                        <td>
                          {canWrite && !loan.isCarryForward && (
                            <button
                              className="btn-icon-delete"
                              title="Delete"
                              onClick={() => handleDelete(loan.id, loan.clientName)}
                              disabled={deleting === loan.id}
                            >
                              {deleting === loan.id ? '...' : '🗑️'}
                            </button>
                          )}
                        </td>
                      )}
                      <td>{formatDate(loan.loanDate)}</td>
                      <td className="text-right">{formatCurrency(loan.principalAmount)}</td>
                      <td>
                        <Link to={`/money-lending/lending/${loan.id}`} style={{ color: '#4361ee', fontWeight: 500 }}>
                          {loan.clientName}
                        </Link>
                        {loan.isCarryForward && <span className="carry-forward-badge">↪ Carry Forward</span>}
                      </td>
                      <td className="text-right" style={{ color: '#28a745' }}>
                        {formatCurrency(s.interestTillFYEnd)}
                        <Tooltip text={s.formulaText} />
                      </td>
                      <td className="text-right" style={{ color: '#28a745', fontWeight: 600 }}>
                        {formatCurrency(s.totalDue)}
                      </td>
                      <td className="text-right">{formatPercent(loan.monthlyInterestRate)}</td>
                      {filter === 'all' && (
                        <td>
                          <span className={`badge badge-${loan.status}`}>{loan.status}</span>
                        </td>
                      )}
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
