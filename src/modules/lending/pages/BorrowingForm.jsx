import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCollection, useDocument, addDocument, updateDocument } from '../../../hooks/useFirestore';
import { fromInputDate, toInputDate, getFYEndDate } from '../../../utils/dateUtils';
import Toast from '../../../components/Toast';
import { useOrg, getOrgCollection } from '../../../context/OrgContext';

export default function BorrowingForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { selectedOrg, canWrite } = useOrg();

  useEffect(() => { if (!canWrite) navigate('/money-lending/borrowing', { replace: true }); }, [canWrite, navigate]);

  const { data: allLoans } = useCollection(getOrgCollection(selectedOrg, 'loans'));
  const { data: existing, loading: loadingDoc } = useDocument(isEdit ? `${getOrgCollection(selectedOrg, 'borrowings')}/${id}` : null);

  // Redirect away if trying to edit a carry-forward entry
  useEffect(() => {
    if (isEdit && existing && existing.isCarryForward) {
      navigate(`/money-lending/borrowing/${id}`, { replace: true });
    }
  }, [isEdit, existing, id, navigate]);

  // Build client → rate map from existing lendings for auto-fill
  const clientRates = useMemo(() => {
    const map = {};
    allLoans.filter(l => !l.isCarryForward).forEach(l => {
      const key = l.clientName.trim().toLowerCase();
      if (!map[key]) {
        map[key] = { clientName: l.clientName, rate: l.monthlyInterestRate };
      }
    });
    return map;
  }, [allLoans]);

  const clientNames = useMemo(() => Object.values(clientRates).map(c => c.clientName), [clientRates]);

  const [form, setForm] = useState({
    clientName: '',
    amount: '',
    monthlyInterestRate: '0.8',
    borrowDate: new Date().toISOString().slice(0, 10),
    endDate: toInputDate(getFYEndDate()),
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Pre-fill form if editing
  useEffect(() => {
    if (isEdit && existing) {
      setForm({
        clientName: existing.clientName || '',
        amount: String(existing.amount || ''),
        monthlyInterestRate: String(existing.monthlyInterestRate || ''),
        borrowDate: toInputDate(existing.borrowDate),
        endDate: existing.endDate ? toInputDate(existing.endDate) : '',
        notes: existing.notes || '',
      });
    }
  }, [isEdit, existing]);

  // Auto-fill rate when client name matches an existing lending client
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'clientName') {
        const key = value.trim().toLowerCase();
        if (clientRates[key]) {
          next.monthlyInterestRate = String(clientRates[key].rate);
        }
      }
      if (name === 'borrowDate' && value) {
        next.endDate = toInputDate(getFYEndDate(new Date(value)));
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim() || !form.amount || !form.monthlyInterestRate || !form.borrowDate) {
      setToast({ message: 'Please fill all required fields', type: 'error' });
      return;
    }
    const amount = Number(form.amount);
    const rate = Number(form.monthlyInterestRate);
    if (amount <= 0 || rate < 0 || rate > 100) {
      setToast({ message: 'Please enter valid amounts', type: 'error' });
      return;
    }
    if (form.endDate && form.endDate <= form.borrowDate) {
      setToast({ message: 'End date must be after borrowing date', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        clientName: form.clientName.trim(),
        amount,
        monthlyInterestRate: rate,
        borrowDate: fromInputDate(form.borrowDate),
        endDate: form.endDate ? fromInputDate(form.endDate) : null,
        notes: form.notes.trim(),
      };

      if (isEdit) {
        await updateDocument(`${getOrgCollection(selectedOrg, 'borrowings')}/${id}`, data);
        setToast({ message: 'Borrowing updated successfully', type: 'success' });
        setTimeout(() => navigate(`/money-lending/borrowing/${id}`), 500);
      } else {
        const docRef = await addDocument(getOrgCollection(selectedOrg, 'borrowings'), data);
        setToast({ message: 'Borrowing recorded successfully', type: 'success' });
        setTimeout(() => navigate(`/money-lending/borrowing/${docRef.id}`), 500);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error saving. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isEdit && loadingDoc) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading borrowing...</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/money-lending/borrowing" className="btn btn-sm btn-outline" title="Back">←</Link>
          <h1>{isEdit ? 'Edit Borrowing' : 'New Borrowing'}</h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.ctrlKey) {
            const inputs = Array.from(e.currentTarget.querySelectorAll('input, select, textarea'));
            const idx = inputs.indexOf(e.target);
            if (idx >= 0 && idx < inputs.length - 1) {
              e.preventDefault();
              inputs[idx + 1].focus();
            } else if (idx === inputs.length - 1) {
              e.preventDefault();
              e.currentTarget.querySelector('button[type="submit"]')?.focus();
            }
          } else if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Client Name *</label>
              <input
                type="text"
                name="clientName"
                value={form.clientName}
                onChange={handleChange}
                placeholder="Enter client name"
                list="client-suggestions"
                required
              />
              <datalist id="client-suggestions">
                {clientNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label>Amount (₹) *</label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="e.g. 100000"
                min="1"
                step="any"
                required
              />
            </div>
            <div className="form-group">
              <label>Borrowing Start Date *</label>
              <input
                type="date"
                name="borrowDate"
                value={form.borrowDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Borrowing End Date</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                min={form.borrowDate}
              />
            </div>
            <div className="form-group">
              <label>Monthly Interest Rate (%) *</label>
              <input
                type="number"
                name="monthlyInterestRate"
                value={form.monthlyInterestRate}
                onChange={handleChange}
                placeholder="e.g. 0.8"
                min="0"
                max="100"
                step="any"
                required
              />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input
                type="text"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : (isEdit ? 'Update Borrowing' : 'Record Borrowing')}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <span style={{ fontSize: '0.75rem', color: '#999', alignSelf: 'center' }}>Ctrl+Enter to save</span>
          </div>
        </form>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
