import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate, getInitials, getAvatarColor } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Plus, UserPlus, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const navigate = useNavigate();

  useEffect(() => { loadGroups(); }, []);

  async function loadGroups() {
    setLoading(true);
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch { toast.error('Failed to load groups'); }
    finally { setLoading(false); }
  }

  async function createGroup(e) {
    e.preventDefault();
    try {
      await api.post('/groups', newGroup);
      toast.success('Group created!');
      setShowCreate(false);
      setNewGroup({ name: '', description: '' });
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{width:32,height:32}}/></div>;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div>
          <h1>Groups</h1>
          <p>Manage your expense groups</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16}/> New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <Users size={48}/>
          <h3>No groups yet</h3>
          <p>Create a group to start tracking shared expenses</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16}/> Create your first group
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {groups.map(g => (
            <div key={g.id} className="card" onClick={() => navigate(`/groups/${g.id}`)}
              style={{ cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{
                  width:44, height:44, borderRadius:12,
                  background:'var(--accent-glow)', border:'1px solid rgba(139,92,246,0.2)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:22
                }}>🏠</div>
                <ArrowRight size={16} style={{ color:'var(--text-muted)', marginTop:4 }}/>
              </div>
              <h3 style={{ marginBottom:4 }}>{g.name}</h3>
              {g.description && <p style={{ fontSize:'0.8rem' }}>{g.description}</p>}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14 }}>
                <Users size={14} style={{ color:'var(--text-muted)' }}/>
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
                  {g.member_count} active member{g.member_count!==1?'s':''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Create Group</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createGroup}>
              <div className="form-group">
                <label>Group Name</label>
                <input placeholder="The Flat" required
                  value={newGroup.name}
                  onChange={e => setNewGroup(g => ({...g, name: e.target.value}))}/>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input placeholder="Shared flat in Bangalore"
                  value={newGroup.description}
                  onChange={e => setNewGroup(g => ({...g, description: e.target.value}))}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Plus size={16}/> Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
