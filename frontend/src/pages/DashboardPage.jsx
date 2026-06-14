import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatDate, getInitials, getAvatarColor } from '../utils/format';
import { TrendingUp, TrendingDown, Users, Receipt, ArrowRight, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups]           = useState([]);
  const [balanceSummary, setBalanceSummary] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [newGroup, setNewGroup]       = useState({ name: '', description: '' });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const gRes = await api.get('/groups');
      setGroups(gRes.data);

      // Collect balances from first group if exists
      if (gRes.data.length > 0) {
        const bRes = await api.get(`/expenses/balances/${gRes.data[0].id}`);
        setBalanceSummary(bRes.data);
      }
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function createGroup(e) {
    e.preventDefault();
    try {
      await api.post('/groups', newGroup);
      toast.success('Group created!');
      setShowCreate(false);
      setNewGroup({ name: '', description: '' });
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    }
  }

  const myBalance = balanceSummary.balances?.[user?.id];
  const netAmount = myBalance?.net || 0;
  const allTransactions = balanceSummary.transactions || [];
  const myTransactions = allTransactions.filter(
    t => t.from === user?.id || t.to === user?.id
  );

  if (loading) return (
    <div className="loading-overlay">
      <div className="spinner" style={{width:32,height:32}}/>
      <p>Loading dashboard…</p>
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p>Here's your financial snapshot</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16}/> New Group
        </button>
      </div>

      {/* Stats row */}
      <div className="card-grid" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-label">Your Net Balance</div>
          <div className={`stat-value ${netAmount >= 0 ? 'amount-positive' : 'amount-negative'}`}>
            {formatINR(Math.abs(netAmount))}
          </div>
          <div className="stat-sub" style={{ display:'flex', alignItems:'center', gap:4 }}>
            {netAmount >= 0
              ? <><TrendingUp size={14} style={{color:'var(--green)'}}/> Others owe you</>
              : <><TrendingDown size={14} style={{color:'var(--red)'}}/> You owe others</>
            }
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Groups</div>
          <div className="stat-value">{groups.length}</div>
          <div className="stat-sub">Active expense groups</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Pending Payments</div>
          <div className="stat-value">{myTransactions.length}</div>
          <div className="stat-sub">Settlements to make/receive</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total You've Paid</div>
          <div className="stat-value amount-positive">{formatINR(myBalance?.paid || 0)}</div>
          <div className="stat-sub">Across all groups</div>
        </div>
      </div>

      {/* What you owe / are owed */}
      {myTransactions.length > 0 && (
        <div className="card" style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 16 }}>💳 Settlement Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myTransactions.map((t, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 16px', background:'var(--bg-primary)', borderRadius:'var(--radius-sm)',
                flexWrap:'wrap', gap:8
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div className={`avatar ${getAvatarColor(t.from === user?.id ? t.toName : t.fromName)}`}>
                    {getInitials(t.from === user?.id ? t.toName : t.fromName)}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'0.875rem' }}>
                      {t.from === user?.id
                        ? `You pay ${t.toName}`
                        : `${t.fromName} pays you`
                      }
                    </div>
                  </div>
                </div>
                <span className={`stat-value ${t.from === user?.id ? 'amount-negative' : 'amount-positive'}`}
                  style={{ fontSize:'1.1rem' }}>
                  {formatINR(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups list */}
      <h2 style={{ marginBottom: 16 }}>Your Groups</h2>
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
            <div key={g.id} className="card"
              onClick={() => navigate(`/groups/${g.id}`)}
              style={{ cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{
                  width:40, height:40, borderRadius:'var(--radius-sm)',
                  background:'var(--accent-glow)', border:'1px solid rgba(139,92,246,0.2)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20
                }}>🏠</div>
                <ArrowRight size={16} style={{ color:'var(--text-muted)' }}/>
              </div>
              <h3>{g.name}</h3>
              {g.description && <p style={{ fontSize:'0.8rem', marginTop:4 }}>{g.description}</p>}
              <div style={{
                display:'flex', gap:12, marginTop:12, fontSize:'0.78rem', color:'var(--text-muted)'
              }}>
                <span><Users size={12} style={{display:'inline',marginRight:4}}/>{g.member_count} members</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create group modal */}
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
