import { Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useOrg } from '../context/OrgContext';

export default function Layout() {
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const { user, signOut, changePassword, loading, userDisplayName, userRoles } = useAuth();
  const { selectedOrg, setSelectedOrg, organizations, allOrganizations, orgInfo } = useOrg();
  const navigate = useNavigate();

  const handleOrgChange = (orgId) => {
    setSelectedOrg(orgId);
    navigate('/money-lending/lending', { replace: true });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (!currentPw || !newPw || !confirmPw) {
      setPwError('All fields are required');
      return;
    }
    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match');
      return;
    }
    setPwSubmitting(true);
    try {
      await changePassword(currentPw, newPw);
      setPwSuccess('Password changed! Signing out...');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => signOut(), 1500);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect');
      } else {
        setPwError('Failed to change password. Try again.');
      }
    } finally {
      setPwSubmitting(false);
    }
  };

  const openChangePw = () => {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setPwSuccess('');
    setShowChangePw(true);
  };

  if (loading || !userRoles) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  }

  if (organizations.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '2rem', textAlign: 'center' }}>
        <h1>No Access</h1>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>You don't have access to any organization. Please contact an admin.</p>
        <button className="btn btn-outline" onClick={signOut} style={{ marginTop: '1rem' }}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="main-area">
        <header className="topbar" style={{ background: orgInfo.color, borderBottom: 'none' }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>🏠 Home</span>
          <select
            className="org-dropdown"
            value={selectedOrg}
            onChange={e => handleOrgChange(e.target.value)}
          >
            {allOrganizations.map(org => {
              const hasAccess = organizations.some(o => o.id === org.id);
              return (
                <option key={org.id} value={org.id} disabled={!hasAccess}>
                  {org.name}{!hasAccess ? ' 🔒' : ''}
                </option>
              );
            })}
          </select>
          <div className="topbar-spacer" />
          <span className="user-name" style={{ color: 'rgba(255,255,255,0.9)' }}>{userDisplayName || 'User'}</span>
          <button className="btn btn-sm btn-outline" onClick={openChangePw} style={{ marginLeft: '0.5rem', color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}>
            🔑 Change Password
          </button>
          <button className="btn btn-sm btn-outline" onClick={signOut} style={{ marginLeft: '0.25rem', color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}>
            ⏻ Sign out
          </button>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {showChangePw && (
        <div className="modal-overlay" onClick={() => setShowChangePw(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1rem' }}>Change Password</h2>
            <form onSubmit={handleChangePassword} className="login-form">
              <input type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" autoFocus />
              <input type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
              <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
              {pwError && <div className="login-error">{pwError}</div>}
              {pwSuccess && <div className="login-success">{pwSuccess}</div>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={pwSubmitting} style={{ flex: 1 }}>
                  {pwSubmitting ? 'Updating...' : 'Update Password'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowChangePw(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
