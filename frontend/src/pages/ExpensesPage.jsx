import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate, getInitials, getAvatarColor, SPLIT_TYPE_LABELS, SPLIT_TYPE_BADGES } from '../utils/format';
import { Receipt, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExpensesPage() {
  const [expenses, setExpenses]   = useState([]);
  const [groups, setGroups]       = useState([]);
  const [groupId, setGroupId]     = useState('');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    api.get('/groups').then(r => {
      setGroups(r.data);
      if (r.data.length > 0) {
        setGroupId(String(r.data[0].id));
      }
    });
  }, []);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    api.get(`/expenses?group_id=${groupId}`)
      .then(r => setExpenses(r.data))
      .catch(() => toast.error('Failed to load expenses'))
      .finally(() => setLoading(false));
  }, [groupId]);

  const filtered = expenses.filter(e =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.paid_by_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation:'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div><h1>Expenses</h1><p>All recorded expenses</p></div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <select value={groupId} onChange={e => setGroupId(e.target.value)}
            style={{ width:'auto' }}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ position:'relative', marginBottom:20 }}>
        <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
        <input placeholder="Search expenses…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft:36 }}/>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" style={{width:32,height:32}}/></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Receipt size={48}/>
          <h3>No expenses found</h3>
          <p>Add expenses from the group detail page</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Description</th><th>Paid By</th>
                <th>Amount</th><th>Split</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ color:'var(--text-muted)', fontSize:'0.8rem', whiteSpace:'nowrap' }}>
                    {formatDate(e.date)}
                  </td>
                  <td style={{ fontWeight:500 }}>{e.description}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div className={`avatar ${getAvatarColor(e.paid_by_name)}`} style={{width:24,height:24,fontSize:'0.6rem'}}>
                        {getInitials(e.paid_by_name)}
                      </div>
                      {e.paid_by_name}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight:700 }}>{formatINR(Math.abs(e.amount_inr))}</div>
                    {e.currency !== 'INR' && (
                      <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>
                        {e.currency} {Math.abs(e.amount)}
                      </div>
                    )}
                    {e.amount_inr < 0 && <span className="badge badge-red" style={{marginTop:2}}>Refund</span>}
                  </td>
                  <td><span className={`badge ${SPLIT_TYPE_BADGES[e.split_type]}`}>{SPLIT_TYPE_LABELS[e.split_type]}</span></td>
                  <td style={{ color:'var(--text-muted)', fontSize:'0.8rem', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {e.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
