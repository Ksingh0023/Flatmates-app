import { useState } from 'react';
import api from '../api/client';
import { X, ArrowLeftRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettlementModal({ groupId, members, onClose, onSave }) {
  const [form, setForm] = useState({
    paid_by: members[0]?.id || '',
    paid_to: members[1]?.id || '',
    amount: '', currency: 'INR', exchange_rate: 1,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handle(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (+form.paid_by === +form.paid_to) {
      setError('Payer and recipient cannot be the same person');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await api.post('/settlements', {
        group_id: +groupId,
        paid_by:  +form.paid_by,
        paid_to:  +form.paid_to,
        amount:   parseFloat(form.amount),
        currency: form.currency,
        exchange_rate: parseFloat(form.exchange_rate) || 1,
        date:  form.date,
        notes: form.notes || undefined
      });
      toast.success('Payment recorded!');
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Record Settlement</h2>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>

        <form onSubmit={submit}>
          <div style={{
            display:'flex', alignItems:'center', gap:8, marginBottom:20,
            padding:'12px 16px', background:'var(--bg-primary)', borderRadius:'var(--radius-sm)'
          }}>
            <select name="paid_by" value={form.paid_by} onChange={handle}
              style={{ flex:1, textAlign:'center' }}>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ArrowLeftRight size={18} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
            <select name="paid_to" value={form.paid_to} onChange={handle}
              style={{ flex:1, textAlign:'center' }}>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
            <div className="form-group">
              <label>Amount</label>
              <input name="amount" type="number" step="0.01" min="0" placeholder="0.00"
                required value={form.amount} onChange={handle}/>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input name="date" type="date" required value={form.date} onChange={handle}/>
            </div>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <input name="notes" placeholder="e.g. Paid via UPI" value={form.notes} onChange={handle}/>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{width:16,height:16}}/> : <ArrowLeftRight size={16}/>}
              {loading ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
