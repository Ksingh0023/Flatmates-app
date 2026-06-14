import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Receipt, ArrowLeftRight,
  Upload, LogOut, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const AVATAR_COLORS = ['avatar-0','avatar-1','avatar-2','avatar-3','avatar-4','avatar-5'];

function getAvatarColor(name) {
  if (!name) return 'avatar-0';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0,2) || '??';
  const colorClass = getAvatarColor(user?.name);

  const links = [
    { to: '/',          icon: <LayoutDashboard size={18}/>, label: 'Dashboard'  },
    { to: '/groups',    icon: <Users size={18}/>,           label: 'Groups'     },
    { to: '/expenses',  icon: <Receipt size={18}/>,         label: 'Expenses'   },
    { to: '/settlements',icon:<ArrowLeftRight size={18}/>,  label: 'Settlements'},
    { to: '/import',    icon: <Upload size={18}/>,          label: 'Import CSV' },
  ];

  return (
    <>
      {/* Mobile top bar */}
      <div style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
        height: '56px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }} className="mobile-topbar">
        <div className="logo-mark" style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className="logo-icon">💸</div>
          <span className="logo-text">FlatMates</span>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={() => setOpen(o => !o)}>
          {open ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </div>

      {/* Sidebar */}
      <aside className="sidebar" style={open ? {} : {}}>
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">💸</div>
            <div>
              <div className="logo-text">FlatMates</div>
              <div className="logo-sub">Shared Expenses</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Menu</div>
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {link.icon}
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className={`user-avatar ${colorClass}`}>{initials}</div>
            <div className="user-info">
              <div className="name">{user?.name}</div>
              <div className="email">{user?.email}</div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={16}/>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
