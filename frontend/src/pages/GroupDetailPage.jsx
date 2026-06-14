import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  formatINR, formatDate, formatCurrency, getInitials,
  getAvatarColor, SPLIT_TYPE_LABELS, SPLIT_TYPE_BADGES
} from '../utils/format';
import {
  ArrowLeft, Plus, Receipt, Users, ArrowLeftRight,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp, Trash2, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExpenseModal from '../components/ExpenseModal';
import SettlementModal from '../components/SettlementModal';

export default function GroupDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup]               = useState(null);
  const [expenses, setExpenses]         = useState([]);
  const [balances, setBalances]         = useState({});
  const [transactions, setTransactions] = useState([]);
  const [settlements, setSettlements]   = useState([]);
  const [allUsers, setAllUsers]         = useState([]);
  const [tab, setTab]                   = useState('expenses'); // expenses | balances | settlements
  const [loading, setLoading]           = useState(true);
  const [showExpModal, setShowExpModal] = useState(false);
  const [showSetModal, setShowSetModal] = useState(false);
  const [expandedExp, setExpandedExp]   = useState(null);

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [gRes, eRes, bRes, sRes, uRes] = await Promise.all([
        api.get(`/groups/${id}`),
        api.get(`/expenses?group_id=${id}`),
        api.get(`/expenses/balances/${id}`),
        api.get(`/settlements?group_id=${id}`),
        api.get('/auth/users'),
      ]);
      setGroup(gRes.data);
      setExpenses(eRes.data);
      setBalances(bRes.data.balances || {});
      setTransactions(bRes.data.transactions || []);
      setSettlements(sRes.data);
      setAllUsers(uRes.data);
    } catch (err) {
      toast.error('Failed to load group');
    } finally {
      setLoading(false);
    }
  }

  async function deleteExpense(expId) {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${expId}`);
      toast.success('Expense deleted');
      loadAll();
    } catch { toast.error('Failed to delete'); }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" style={{width:32,height:32}}/></div>;
  if (!group) return <div className="empty-state"><h3>Group not found</h3></div>;

  const activeMembers = group.members?.filter(m => !m.left_at) || [];
  const myBalance = balances[user?.id];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{
          width:40, height:40, borderRadius:'var(--radius-sm)',
          background:'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20
        }}>🏠</div>
        <div>
          <h1 style={{ fontSize:'1.5rem' }}>{group.name}</h1>
          {group.description && <p style={{ fontSize:'0.8rem', marginTop:2 }}>{group.description}</p>}
        </div>
      </div>

      {/* Members strip */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {group.members?.map(m => (
          <div key={m.id} title={`${m.name} — joined ${formatDate(m.joined_at)}${m.left_at?' · left '+formatDate(m.left_at):''}`}
            style={{ display:'flex', alignItems:'center', gap:6,
              background:'var(--bg-card)', border:'1px solid var(--border)',
              borderRadius:999, padding:'4px 10px 4px 4px', fontSize:'0.78rem',
              opacity: m.left_at ? 0.5 : 1
            }}>
            <div className={`avatar ${getAvatarColor(m.name)}`} style={{width:24,height:24,fontSize:'0.65rem'}}>
              {getInitials(m.name)}
            </div>
            {m.name}
            {m.left_at && <span style={{fontSize:'0.65rem',color:'var(--red)'}}>left</span>}
          </div>
        ))}
      </div>

      {/* My balance card */}
      {myBalance && (
        <div className="card" style={{ marginBottom:24, background:
          myBalance.net > 0 ? 'rgba(52,211,153,0.05)' :
          myBalance.net < 0 ? 'rgba(248,113,113,0.05)' : 'var(--bg-card)',
          borderColor: myBalance.net > 0 ? 'rgba(52,211,153,0.2)' :
                       myBalance.net < 0 ? 'rgba(248,113,113,0.2)' : 'var(--border)'
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                Your balance in this group
              </div>
              <div className={`stat-value ${myBalance.net>0?'amount-positive':myBalance.net<0?'amount-negative':'amount-neutral'}`}
                style={{ fontSize:'1.5rem', margin:'4px 0' }}>
                {myBalance.net > 0 ? '+' : ''}{formatINR(myBalance.net)}
              </div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                {myBalance.net > 0 ? 'Others owe you' : myBalance.net < 0 ? 'You owe others' : 'All settled up!'}
              </div>
            </div>
            <div style={{ display:'flex', gap:16 }}>
              <div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>You paid</div>
                <div style={{ fontWeight:700, color:'var(--green)' }}>{formatINR(myBalance.paid)}</div>
              </div>
              <div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Your share</div>
                <div style={{ fontWeight:700, color:'var(--red)' }}>{formatINR(myBalance.owed)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:'flex', gap:8, marginBottom:24, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {[
          { key:'expenses',    label:'Expenses',    icon:<Receipt size={15}/> },
          { key:'balances',    label:'Balances',    icon:<TrendingUp size={15}/> },
          { key:'settlements', label:'Settlements', icon:<ArrowLeftRight size={15}/> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="btn" style={{
              borderRadius:'var(--radius-sm) var(--radius-sm) 0 0',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent-light)' : 'var(--text-secondary)',
              background: 'none', padding:'8px 16px',
            }}>
            {t.icon} {t.label}
          </button>
        ))}

        <div style={{ flex:1 }}/>
        {tab === 'expenses' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowExpModal(true)}>
            <Plus size={14}/> Add Expense
          </button>
        )}
        {tab === 'settlements' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowSetModal(true)}>
            <Plus size={14}/> Record Payment
          </button>
        )}
      </div>

      {/* ── EXPENSES TAB ── */}
      {tab === 'expenses' && (
        <div>
          {expenses.length === 0 ? (
            <div className="empty-state">
              <Receipt size={48}/>
              <h3>No expenses yet</h3>
              <p>Add your first expense to get started</p>
              <button className="btn btn-primary" onClick={() => setShowExpModal(true)}>
                <Plus size={16}/> Add Expense
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {expenses.map(exp => (
                <div key={exp.id} className="card" style={{ padding:'16px 20px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:600, fontSize:'0.95rem' }}>{exp.description}</span>
                        <span className={`badge ${SPLIT_TYPE_BADGES[exp.split_type]}`}>
                          {SPLIT_TYPE_LABELS[exp.split_type]}
                        </span>
                        {exp.currency !== 'INR' && (
                          <span className="badge badge-yellow">{exp.currency}</span>
                        )}
                        {exp.amount_inr < 0 && <span className="badge badge-red">Refund</span>}
                      </div>
                      <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4 }}>
                        {formatDate(exp.date)} · paid by <strong style={{color:'var(--text-secondary)'}}>{exp.paid_by_name}</strong>
                        {exp.currency !== 'INR' && (
                          <span> · {formatCurrency(exp.amount, exp.currency)} @ ₹{exp.exchange_rate}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:700, fontSize:'1.05rem' }}>{formatINR(Math.abs(exp.amount_inr))}</div>
                        {exp.splits && exp.splits.find(s => s.user_id === user?.id) && (
                          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                            your share: <strong style={{color: exp.paid_by===user?.id ? 'var(--green)':'var(--red)'}}>
                              {formatINR(Math.abs(exp.splits.find(s=>s.user_id===user?.id)?.share_amount||0))}
                            </strong>
                          </div>
                        )}
                      </div>
                      <button className="btn btn-ghost btn-icon" onClick={() => setExpandedExp(expandedExp===exp.id?null:exp.id)}>
                        {expandedExp===exp.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                      <button className="btn btn-danger btn-icon" onClick={() => deleteExpense(exp.id)}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>

                  {/* Expanded split breakdown (Rohan's requirement) */}
                  {expandedExp === exp.id && (
                    <div style={{
                      marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)',
                      animation:'slideUp 0.15s ease'
                    }}>
                      {exp.notes && (
                        <div style={{
                          fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:12,
                          padding:'8px 12px', background:'var(--bg-primary)', borderRadius:'var(--radius-sm)',
                          display:'flex', gap:8, alignItems:'flex-start'
                        }}>
                          <Info size={14} style={{flexShrink:0, marginTop:1}}/>
                          {exp.notes}
                        </div>
                      )}
                      {exp.import_row && (
                        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:8 }}>
                          CSV row #{exp.import_row}
                        </div>
                      )}
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                          Split Breakdown
                        </div>
                        {exp.splits?.map(s => (
                          <div key={s.user_id} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'8px 12px', background:'var(--bg-primary)', borderRadius:'var(--radius-sm)'
                          }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div className={`avatar ${getAvatarColor(s.user_name)}`} style={{width:26,height:26,fontSize:'0.65rem'}}>
                                {getInitials(s.user_name)}
                              </div>
                              <span style={{ fontWeight:500, fontSize:'0.875rem' }}>{s.user_name}</span>
                              {s.share_pct && <span style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{s.share_pct?.toFixed(1)}%</span>}
                              {s.share_units && <span style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{s.share_units} unit{s.share_units!==1?'s':''}</span>}
                            </div>
                            <span style={{ fontWeight:700, color: s.user_id===exp.paid_by ? 'var(--green)' : 'var(--text-primary)' }}>
                              {formatINR(Math.abs(s.share_amount))}
                              {s.user_id===exp.paid_by && <span style={{fontSize:'0.7rem',color:'var(--text-muted)',marginLeft:4}}>(payer)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BALANCES TAB ── */}
      {tab === 'balances' && (
        <div>
          <div className="card-grid" style={{ marginBottom:24 }}>
            {Object.entries(balances).map(([uid, b]) => (
              <div key={uid} className="stat-card" style={{
                background: b.net > 0 ? 'rgba(52,211,153,0.05)' :
                            b.net < 0 ? 'rgba(248,113,113,0.05)' : 'var(--bg-card)',
                borderColor: b.net > 0 ? 'rgba(52,211,153,0.2)' :
                             b.net < 0 ? 'rgba(248,113,113,0.2)' : 'var(--border)'
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div className={`avatar ${getAvatarColor(b.name)}`}>{getInitials(b.name)}</div>
                  <span style={{ fontWeight:600 }}>{b.name}</span>
                  {+uid === user?.id && <span className="badge badge-purple">You</span>}
                </div>
                <div className={`stat-value ${b.net>0?'amount-positive':b.net<0?'amount-negative':'amount-neutral'}`}
                  style={{ fontSize:'1.25rem' }}>
                  {b.net > 0 ? '+' : ''}{formatINR(b.net)}
                </div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                  Paid {formatINR(b.paid)} · Owes {formatINR(b.owed)}
                </div>
              </div>
            ))}
          </div>

          {transactions.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom:16 }}>💡 Simplified Settlements</h3>
              <p style={{ fontSize:'0.8rem', marginBottom:16 }}>
                These {transactions.length} payment{transactions.length!==1?'s':''} will settle all debts optimally:
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {transactions.map((t, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 16px', background:'var(--bg-primary)', borderRadius:'var(--radius-sm)',
                    flexWrap:'wrap', gap:8
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className={`avatar ${getAvatarColor(t.fromName)}`} style={{width:28,height:28,fontSize:'0.7rem'}}>
                        {getInitials(t.fromName)}
                      </div>
                      <span style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--red)' }}>{t.fromName}</span>
                      <ArrowLeftRight size={14} style={{ color:'var(--text-muted)' }}/>
                      <div className={`avatar ${getAvatarColor(t.toName)}`} style={{width:28,height:28,fontSize:'0.7rem'}}>
                        {getInitials(t.toName)}
                      </div>
                      <span style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--green)' }}>{t.toName}</span>
                    </div>
                    <span style={{ fontWeight:700, fontSize:'1.05rem' }}>{formatINR(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {transactions.length === 0 && (
            <div className="empty-state">
              <TrendingUp size={48}/>
              <h3>All settled up!</h3>
              <p>No outstanding balances in this group</p>
            </div>
          )}
        </div>
      )}

      {/* ── SETTLEMENTS TAB ── */}
      {tab === 'settlements' && (
        <div>
          {settlements.length === 0 ? (
            <div className="empty-state">
              <ArrowLeftRight size={48}/>
              <h3>No settlements recorded</h3>
              <p>Record a payment to reduce debts</p>
              <button className="btn btn-primary" onClick={() => setShowSetModal(true)}>
                <Plus size={16}/> Record Payment
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>From</th><th>To</th><th>Amount</th><th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map(s => (
                    <tr key={s.id}>
                      <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{formatDate(s.date)}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div className={`avatar ${getAvatarColor(s.paid_by_name)}`} style={{width:24,height:24,fontSize:'0.6rem'}}>
                            {getInitials(s.paid_by_name)}
                          </div>
                          {s.paid_by_name}
                        </div>
                      </td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div className={`avatar ${getAvatarColor(s.paid_to_name)}`} style={{width:24,height:24,fontSize:'0.6rem'}}>
                            {getInitials(s.paid_to_name)}
                          </div>
                          {s.paid_to_name}
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
        </div>
      )}

      {/* Modals */}
      {showExpModal && (
        <ExpenseModal
          groupId={id}
          members={activeMembers}
          allUsers={allUsers}
          onClose={() => setShowExpModal(false)}
          onSave={() => { setShowExpModal(false); loadAll(); }}
        />
      )}
      {showSetModal && (
        <SettlementModal
          groupId={id}
          members={activeMembers}
          onClose={() => setShowSetModal(false)}
          onSave={() => { setShowSetModal(false); loadAll(); }}
        />
      )}
    </div>
  );
}
