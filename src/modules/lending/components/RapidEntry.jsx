import { useState, useRef, useMemo } from 'react';
import { addDocument, deleteDocument } from '../../../hooks/useFirestore';
import { fromInputDate, toInputDate, getFYEndDate } from '../../../utils/dateUtils';
import { formatCurrency } from '../../../utils/formatUtils';
import Toast from '../../../components/Toast';
import { useOrg, getOrgCollection } from '../../../context/OrgContext';

/**
 * Rapid Entry bar for bulk-adding lending or borrowing records.
 *
 * Props:
 *   type        - 'lending' | 'borrowing'
 *   allLoans    - (borrowing only) loans collection for client auto-fill
 *   onToast     - parent toast setter (optional, falls back to internal)
 */
export default function RapidEntry({ type, allLoans = [], open, onToggle }) {
  const isLending = type === 'lending';
  const { selectedOrg, canWrite } = useOrg();
  const collectionName = getOrgCollection(selectedOrg, isLending ? 'loans' : 'borrowings');

  const [showDefaults, setShowDefaults] = useState(false);

  // Sticky defaults
  const [defaults, setDefaults] = useState({
    monthlyInterestRate: '0.8',
    endDate: toInputDate(getFYEndDate()),
    notes: '',
  });

  // Per-record fields
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (val) {
      setDefaults(prev => ({ ...prev, endDate: toInputDate(getFYEndDate(new Date(val))) }));
    }
  };

  const [saving, setSaving] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastAdded, setLastAdded] = useState(null); // { id, name, amount }
  const [toast, setToast] = useState(null);

  const nameRef = useRef(null);

  // Client name list for autocomplete (both lending and borrowing)
  const clientRates = useMemo(() => {
    const map = {};
    allLoans.filter(l => !l.isCarryForward).forEach(l => {
      const key = l.clientName.trim().toLowerCase();
      if (!map[key]) map[key] = { clientName: l.clientName, rate: l.monthlyInterestRate };
    });
    return map;
  }, [allLoans]);

  const clientNames = useMemo(() => Object.values(clientRates).map(c => c.clientName), [clientRates]);

  const handleNameChange = (val) => {
    setName(val);
    // Borrowing: auto-fill rate from lending client
    if (!isLending) {
      const key = val.trim().toLowerCase();
      if (clientRates[key]) {
        setDefaults(prev => ({ ...prev, monthlyInterestRate: String(clientRates[key].rate) }));
      }
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !amount) {
      setToast({ message: 'Name and amount are required', type: 'error' });
      return;
    }
    const amt = Number(amount);
    const rate = Number(defaults.monthlyInterestRate);
    if (amt <= 0) {
      setToast({ message: 'Amount must be positive', type: 'error' });
      return;
    }
    if (rate < 0 || rate > 100) {
      setToast({ message: 'Invalid interest rate', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const data = {
        clientName: name.trim(),
        monthlyInterestRate: rate,
        endDate: defaults.endDate ? fromInputDate(defaults.endDate) : null,
        notes: defaults.notes.trim(),
      };

      if (isLending) {
        data.principalAmount = amt;
        data.loanDate = fromInputDate(startDate);
        data.totalRepaid = 0;
      } else {
        data.amount = amt;
        data.borrowDate = fromInputDate(startDate);
      }

      const docRef = await addDocument(collectionName, data);
      setLastAdded({ id: docRef.id, name: name.trim(), amount: amt });
      setSessionCount(prev => prev + 1);

      // Clear name + amount, keep startDate sticky
      setName('');
      setAmount('');
      nameRef.current?.focus();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error saving record', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    if (!lastAdded) return;
    if (!window.confirm(`Undo entry for "${lastAdded.name}"?`)) return;
    try {
      await deleteDocument(`${collectionName}/${lastAdded.id}`);
      setSessionCount(prev => Math.max(0, prev - 1));
      setToast({ message: `Undid entry for ${lastAdded.name}`, type: 'success' });
      setLastAdded(null);
    } catch (err) {
      setToast({ message: 'Error undoing entry', type: 'error' });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      const inputs = Array.from(e.currentTarget.querySelectorAll('input:not([type="hidden"])'));
      const idx = inputs.indexOf(e.target);
      // Last of the 3 main fields (startDate) → submit
      if (idx >= 2 || e.target === inputs[inputs.length - 1]) {
        handleAdd();
      } else if (idx >= 0 && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }
    }
  };

  if (!canWrite || !open) {
    return null;
  }

  return (
    <div className="rapid-entry">
      <div className="rapid-entry-header">
        <span className="rapid-entry-title">⚡ Quick Entry</span>
        <div className="rapid-entry-header-right">
          <button
            className="rapid-entry-defaults-toggle"
            onClick={() => setShowDefaults(prev => !prev)}
          >
            {showDefaults ? '▾ Hide Defaults' : '▸ Defaults'}: Rate {defaults.monthlyInterestRate}%
            {defaults.endDate ? ` | End: ${defaults.endDate}` : ''}
          </button>
          <button className="rapid-entry-close" onClick={onToggle} title="Close">✕</button>
        </div>
      </div>

      {showDefaults && (
        <div className="rapid-entry-defaults">
          <div className="rapid-entry-field">
            <label>Rate (%)</label>
            <input
              type="number"
              value={defaults.monthlyInterestRate}
              onChange={e => setDefaults(prev => ({ ...prev, monthlyInterestRate: e.target.value }))}
              min="0" max="100" step="any"
            />
          </div>
          <div className="rapid-entry-field">
            <label>End Date</label>
            <input
              type="date"
              value={defaults.endDate}
              onChange={e => setDefaults(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div className="rapid-entry-field">
            <label>Notes</label>
            <input
              type="text"
              value={defaults.notes}
              onChange={e => setDefaults(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>
      )}

      <div className="rapid-entry-row" onKeyDown={handleKeyDown}>
        <div className="rapid-entry-field rapid-entry-field-name">
          <label>Name *</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Client name"
            list="rapid-client-suggestions"
            autoFocus
          />
          <datalist id="rapid-client-suggestions">
            {clientNames.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div className="rapid-entry-field rapid-entry-field-amount">
          <label>Amount *</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="₹"
            min="1"
            step="any"
          />
        </div>
        <div className="rapid-entry-field rapid-entry-field-date">
          <label>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => handleStartDateChange(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary rapid-entry-add"
          onClick={handleAdd}
          disabled={saving}
        >
          {saving ? '...' : '+ Add'}
        </button>
      </div>

      <div className="rapid-entry-footer">
        {sessionCount > 0 && (
          <span className="rapid-entry-count">✓ {sessionCount} added this session</span>
        )}
        {lastAdded && (
          <span className="rapid-entry-last">
            Last: {lastAdded.name} — {formatCurrency(lastAdded.amount)}
            <button className="rapid-entry-undo" onClick={handleUndo}>Undo</button>
          </span>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
