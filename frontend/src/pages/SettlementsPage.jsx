import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate, getInitials, getAvatarColor } from '../utils/format';
import { ArrowLeftRight, Plus } from 'lucide-react';
import SettlementModal from '../components/SettlementModal';
import toast from 'react-hot-toast';

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState([]);
  const [groups, setGroups]           = useState([]);
  const [groupId, setGroupId]         = useState('');
  const [members, setMembers]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [showModal, setShowModal]     = useState(false);

  useEffect(() => {
    api.get('/groups').then(r => {
      setGroups(r.data);
      if (r.data.length > 0) setGroupId(String(r.data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    Promise.all([
      api.get(`/settlements?group_id=${groupId}`),
      api.get(`/groups/${groupId}`)
    ]).then(([sRes, gRes]) => {
      setSettlements(sRes.data);
      setMembers(gRes.data.members?.filter(m => !m.left_at) || []);
    }).catch(() => toast.error('Failed to load settlements'))
    .finally(() => setLoading(false));
  }, [groupId]);

  return (
    <div style={{ animation:'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div><h1>Settlements</h1><p>Payment history between members</p></div>
        <div style={{ display:'flex', gap:12 }}>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} style={{ width:'auto' }}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16}/> Record Payment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" style={{width:32,height:32}}/></div>
      ) : settlements.length === 0 ? (
        <div className="empty-state">
          <ArrowLeftRight size={48}/>
          <h3>No settlements yet</h3>
          <p>Record payments between members to reduce outstanding debts</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16}/> Record Payment
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>From</th><th>To</th><th>Amount</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {settlements.map(s => (
                <tr key={s.id}>
                  <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{formatDate(s.date)}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div className={`avatar ${getAvatarColor(s.paid_by_name)}`} style={{width:24,height:24,fontSize:'0.6rem'}}>
                        {getInitials(s.paid_by_name)}
                      </div>
                      <span style={{ fontWeight:600 }}>{s.paid_by_name}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div className={`avatar ${getAvatarColor(s.paid_to_name)}`} style={{width:24,height:24,fontSize:'0.6rem'}}>
                        {getInitials(s.paid_to_name)}
                      </div>
                      <span style={{ fontWeight:600 }}>{s.paid_to_name}</span>
                    </div>
                  </td>
                  <td><span className="amount-positive">{formatINR(s.amount_inr)}</span></td>
                  <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{s.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && members.length > 0 && (
        <SettlementModal
          groupId={groupId}
          members={members}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            setLoading(true);
            api.get(`/settlements?group_id=${groupId}`)
              .then(r => setSettlements(r.data))
              .finally(() => setLoading(false));
          }}
        />
      )}
    </div>
  );
}
