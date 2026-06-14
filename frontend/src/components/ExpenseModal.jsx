import { useState, useEffect } from 'react';
import api from '../api/client';
import { formatINR } from '../utils/format';
import { X, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';

const SPLIT_TYPES = [
  { value: 'equal',      label: 'Equal', desc: 'Split equally among all members' },
  { value: 'unequal',    label: 'Unequal', desc: 'Specify exact amount per person' },
  { value: 'percentage', label: 'Percentage', desc: 'Specify % per person' },
  { value: 'share',      label: 'Share-weighted', desc: 'Assign units (e.g. 1x, 2x)' },
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
const DEFAULT_RATES = { INR: 1, USD: 84.5, EUR: 91, GBP: 107 };

export default function ExpenseModal({ groupId, members, allUsers, onClose, onSave }) {
  const [form, setForm] = useState({
    description: '', date: new Date().toISOString().split('T')[0],
    paid_by: members[0]?.id || '', amount: '',
    currency: 'INR', exchange_rate: 1,
    split_type: 'equal', notes: ''
  });
  const [selectedMembers, setSelectedMembers] = useState(members.map(m => m.id));
  const [splitDetails, setSplitDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-set exchange rate when currency changes
  useEffect(() => {
    setForm(f => ({ ...f, exchange_rate: DEFAULT_RATES[f.currency] || 1 }));
  }, [form.currency]);

  function handle(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function toggleMember(uid) {
    setSelectedMembers(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);
  }

  // Auto-compute equal split value
  function getEqualShare() {
    const amt = parseFloat(form.amount) || 0;
    const rate = parseFloat(form.exchange_rate) || 1;
    const inr = amt * rate;
    const n = selectedMembers.length;
    return n > 0 ? (inr / n).toFixed(0) : 0;
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (selectedMembers.length === 0) {
      setError('Select at least one member to split with');
      return;
    }

    const amount = parseFloat(form.amount);
    if (!amount || isNaN(amount)) { setError('Enter a valid amount'); return; }

    // Validate percentage sum
    if (form.split_type === 'percentage') {
      const total = selectedMembers.reduce((a, uid) => a + (parseFloat(splitDetails[uid])||0), 0);
      if (Math.abs(total - 100) > 0.01) {
        setError(`Percentages must sum to 100% (current: ${total.toFixed(1)}%)`);
        return;
      }
    }

    // Build split payload
    const splits = selectedMembers.map(uid => ({ userId: uid }));

    // Build split_details_by_name
    const split_details_by_name = {};
    if (form.split_type !== 'equal') {
      for (const uid of selectedMembers) {
        const member = [...members, ...allUsers].find(m => m.id === +uid);
        if (member) split_details_by_name[member.name] = parseFloat(splitDetails[uid]) || 1;
      }
    }

    setLoading(true);
    try {
      await api.post('/expenses', {
        group_id: +groupId,
        description: form.description,
        date: form.date,
        paid_by: +form.paid_by,
        amount,
        currency: form.currency,
        exchange_rate: parseFloat(form.exchange_rate),
        split_type: form.split_type,
        notes: form.notes || undefined,
        splits,
        split_details_by_name: Object.keys(split_details_by_name).length ? split_details_by_name : undefined
      });
      toast.success('Expense added!');
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  }

  const totalPct = form.split_type === 'percentage'
    ? selectedMembers.reduce((a, uid) => a + (parseFloat(splitDetails[uid])||0), 0)
    : null;

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <h2 className="modal-title">Add Expense</h2>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Description</label>
            <input name="description" placeholder="Groceries, Rent, etc."
              required value={form.description} onChange={handle}/>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label>Date</label>
              <input name="date" type="date" required value={form.date} onChange={handle}/>
            </div>
            <div className="form-group">
              <label>Paid By</label>
              <select name="paid_by" required value={form.paid_by} onChange={handle}>
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label>Amount</label>
              <input name="amount" type="number" step="0.01" min="0" placeholder="0.00"
                required value={form.amount} onChange={handle}/>
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select name="currency" value={form.currency} onChange={handle}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {form.currency !== 'INR' && (
              <div className="form-group">
                <label>Rate (₹)</label>
                <input name="exchange_rate" type="number" step="0.01" value={form.exchange_rate} onChange={handle}/>
              </div>
            )}
          </div>

          {form.currency !== 'INR' && form.amount && (
            <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:12, marginTop:-8 }}>
              ≈ {formatINR(parseFloat(form.amount) * parseFloat(form.exchange_rate))}
            </div>
          )}

          {/* Split Type */}
          <div className="form-group">
            <label>Split Type</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {SPLIT_TYPES.map(st => (
                <button key={st.value} type="button"
                  onClick={() => setForm(f => ({...f, split_type: st.value}))}
                  style={{
                    padding:'10px 12px', borderRadius:'var(--radius-sm)',
                    border: `1px solid ${form.split_type===st.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.split_type===st.value ? 'var(--accent-glow)' : 'var(--bg-input)',
                    color: form.split_type===st.value ? 'var(--accent-light)' : 'var(--text-secondary)',
                    cursor:'pointer', textAlign:'left', transition:'all 0.15s'
                  }}>
                  <div style={{ fontWeight:600, fontSize:'0.8rem' }}>{st.label}</div>
                  <div style={{ fontSize:'0.7rem', opacity:0.7 }}>{st.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Member selection */}
          <div className="form-group">
            <label>Split With</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {members.map(m => (
                <button key={m.id} type="button"
                  onClick={() => toggleMember(m.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:6,
                    padding:'6px 12px', borderRadius:999,
                    border: `1px solid ${selectedMembers.includes(m.id) ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedMembers.includes(m.id) ? 'var(--accent-glow)' : 'var(--bg-input)',
                    color: selectedMembers.includes(m.id) ? 'var(--accent-light)' : 'var(--text-secondary)',
                    cursor:'pointer', fontSize:'0.8rem', fontWeight:500, transition:'all 0.15s'
                  }}>
                  {selectedMembers.includes(m.id) ? <Minus size={12}/> : <Plus size={12}/>}
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Split details (not for equal) */}
          {form.split_type !== 'equal' && selectedMembers.length > 0 && (
            <div className="form-group">
              <label>
                {form.split_type === 'percentage' ? 'Percentages' :
                 form.split_type === 'unequal'    ? 'Amounts (INR)' : 'Units'}
                {totalPct !== null && (
                  <span style={{
                    marginLeft:8, fontWeight:400,
                    color: Math.abs(totalPct-100) < 0.01 ? 'var(--green)' : 'var(--red)'
                  }}>
                    {totalPct.toFixed(1)}%
                    {Math.abs(totalPct-100) >= 0.01 && ' ← must be 100%'}
                  </span>
                )}
              </label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {selectedMembers.map(uid => {
                  const m = members.find(x => x.id === uid) || allUsers.find(x => x.id === uid);
                  return (
                    <div key={uid} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:80, fontSize:'0.8rem', fontWeight:500 }}>{m?.name}</span>
                      <input type="number" step="0.01" min="0"
                        placeholder={form.split_type==='percentage' ? '33.33' : form.split_type==='share' ? '1' : '0'}
                        value={splitDetails[uid] || ''}
                        onChange={e => setSplitDetails(d => ({...d, [uid]: e.target.value}))}
                        style={{ flex:1 }}/>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                        {form.split_type==='percentage' ? '%' :
                         form.split_type==='share' ? 'unit(s)' : '₹'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Equal split preview */}
          {form.split_type === 'equal' && form.amount && selectedMembers.length > 0 && (
            <div style={{
              padding:'10px 14px', background:'var(--bg-primary)', borderRadius:'var(--radius-sm)',
              fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:12
            }}>
              Each pays: <strong>{formatINR(getEqualShare())}</strong>
              {' '}({selectedMembers.length} people)
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <input name="notes" placeholder="Any extra info…" value={form.notes} onChange={handle}/>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{width:16,height:16}}/> : <Plus size={16}/>}
              {loading ? 'Saving…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
