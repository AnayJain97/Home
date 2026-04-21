import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDocument, addDocument, updateDocument } from '../../../hooks/useFirestore';
import { toInputDate, fromInputDate, getFYEndDate } from '../../../utils/dateUtils';
import Toast from '../../../components/Toast';

export default function LoanForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { data: existing, loading: loadingDoc } = useDocument(isEdit ? `loans/${id}` : null);

  const [form, setForm] = useState({
    clientName: '',
    principalAmount: '',
    monthlyInterestRate: '0.8',
    loanDate: new Date().toISOString().slice(0, 10),
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
        principalAmount: String(existing.principalAmount || ''),
        monthlyInterestRate: String(existing.monthlyInterestRate || ''),
        loanDate: toInputDate(existing.loanDate),
        endDate: existing.endDate ? toInputDate(existing.endDate) : '',
        notes: existing.notes || '',
      });
    }
  }, [isEdit, existing]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim() || !form.principalAmount || !form.monthlyInterestRate || !form.loanDate) {
      setToast({ message: 'Please fill all required fields', type: 'error' });
      return;
    }
    const principal = Number(form.principalAmount);
    const rate = Number(form.monthlyInterestRate);
    if (principal <= 0 || rate < 0 || rate > 100) {
      setToast({ message: 'Please enter valid amounts', type: 'error' });
      return;
    }
    if (form.endDate && form.endDate <= form.loanDate) {
      setToast({ message: 'End date must be after loan date', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        clientName: form.clientName.trim(),
        principalAmount: principal,
        monthlyInterestRate: rate,
        loanDate: fromInputDate(form.loanDate),
        endDate: form.endDate ? fromInputDate(form.endDate) : null,
        notes: form.notes.trim(),
        status: 'active',
      };

      if (isEdit) {
        await updateDocument(`loans/${id}`, data);
        setToast({ message: 'Loan updated successfully', type: 'success' });
        setTimeout(() => navigate(`/money-lending/lending/${id}`), 500);
      } else {
        data.totalRepaid = 0;
        const docRef = await addDocument('loans', data);
        setToast({ message: 'Loan created successfully', type: 'success' });
        setTimeout(() => navigate(`/money-lending/lending/${docRef.id}`), 500);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error saving loan. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isEdit && loadingDoc) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading loan...</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/money-lending/lending" className="btn btn-sm btn-outline" title="Back to loans">←</Link>
          <h1>{isEdit ? 'Edit Loan' : 'New Loan'}</h1>
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
                required
              />
            </div>
            <div className="form-group">
              <label>Principal Amount (₹) *</label>
              <input
                type="number"
                name="principalAmount"
                value={form.principalAmount}
                onChange={handleChange}
                placeholder="e.g. 100000"
                min="1"
                step="any"
                required
              />
            </div>
            <div className="form-group">
              <label>Loan End Date</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                min={form.loanDate}
              />
            </div>
            <div className="form-group">
              <label>Loan Start Date *</label>
              <input
                type="date"
                name="loanDate"
                value={form.loanDate}
                onChange={handleChange}
                required
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
              {submitting ? 'Saving...' : (isEdit ? 'Update Loan' : 'Create Loan')}
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
