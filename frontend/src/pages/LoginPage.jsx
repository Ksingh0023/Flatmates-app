import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError('Name is required'); setLoading(false); return; }
        await register(form.name, form.email, form.password);
      }
      toast.success(`Welcome ${mode === 'login' ? 'back' : 'aboard'}!`);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.15) 0%, transparent 60%), var(--bg-primary)',
      padding: '16px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', margin: '0 auto 16px',
            boxShadow: '0 0 40px rgba(139,92,246,0.4)'
          }}>💸</div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>FlatMates</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Split expenses, stay friends.
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ borderRadius: 'var(--radius-xl)', padding: '32px' }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-sm)', padding: '4px', marginBottom: '28px'
          }}>
            {['login','register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px',
                  border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                  transition: 'all 0.2s',
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? 'white' : 'var(--text-secondary)'
                }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <div className="form-group">
                <label>Full Name</label>
                <input name="name" placeholder="Aisha" value={form.name} onChange={handle} required />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input name="email" type="email" placeholder="you@flatmates.app"
                value={form.email} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input name="password" type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••" value={form.password} onChange={handle}
                  required style={{ paddingRight: '44px' }} />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', padding: 0
                  }}>
                  {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '16px', padding: '10px 12px' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg"
              disabled={loading} style={{ width: '100%', marginTop: '4px' }}>
              {loading ? <span className="spinner" style={{width:18,height:18}}/> : null}
              {loading ? 'Please wait…' : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          {/* Quick login hint */}
          <div style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Demo accounts:</strong>
            <br/>aisha@flatmates.app / aisha123 &nbsp;·&nbsp; rohan@flatmates.app / rohan123
            <br/>priya@flatmates.app / priya123 &nbsp;·&nbsp; sam@flatmates.app / sam123
          </div>
        </div>
      </div>
    </div>
  );
}
