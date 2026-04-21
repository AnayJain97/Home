import { Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useOrg } from '../context/OrgContext';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { selectedOrg, setSelectedOrg, organizations, orgInfo } = useOrg();
  const navigate = useNavigate();

  const handleOrgChange = (orgId) => {
    setSelectedOrg(orgId);
    navigate('/money-lending/lending', { replace: true });
  };

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="topbar" style={{ background: orgInfo.color, borderBottom: 'none' }}>
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu" style={{ color: '#fff' }}>
            ☰
          </button>
          <select
            className="org-dropdown"
            value={selectedOrg}
            onChange={e => handleOrgChange(e.target.value)}
          >
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <div className="topbar-spacer" />
          <span className="user-name" style={{ color: 'rgba(255,255,255,0.9)' }}>{user?.displayName || 'MJ Finance'}</span>
          <button className="btn btn-sm btn-outline" onClick={signOut} style={{ marginLeft: '0.5rem', color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}>
            Sign out
          </button>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
