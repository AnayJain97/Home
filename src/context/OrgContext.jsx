import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const ORGANIZATIONS = [
  { id: 'PB', name: 'PB', color: '#6d4c9e' },
  { id: 'VB', name: 'VB', color: '#0097a7' },
  { id: 'AB', name: 'AB', color: '#c2185b' },
  { id: 'SB', name: 'SB', color: '#5d4037' },
  { id: 'TEST', name: 'TEST', color: '#607d8b' },
];

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const { userRoles } = useAuth();

  const accessibleOrgs = useMemo(() => {
    if (!userRoles) return [];
    return ORGANIZATIONS.filter(o => userRoles[o.id] === 'read' || userRoles[o.id] === 'write');
  }, [userRoles]);

  const [selectedOrg, setSelectedOrgState] = useState(() => {
    return localStorage.getItem('selectedOrg') || 'PB';
  });

  useEffect(() => {
    if (accessibleOrgs.length > 0 && !accessibleOrgs.find(o => o.id === selectedOrg)) {
      const first = accessibleOrgs[0].id;
      setSelectedOrgState(first);
      localStorage.setItem('selectedOrg', first);
    }
  }, [accessibleOrgs, selectedOrg]);

  const setSelectedOrg = (orgId) => {
    setSelectedOrgState(orgId);
    localStorage.setItem('selectedOrg', orgId);
  };

  const orgInfo = ORGANIZATIONS.find(o => o.id === selectedOrg) || ORGANIZATIONS[0];

  const currentOrgRole = useMemo(() => {
    if (!userRoles) return 'none';
    return userRoles[selectedOrg] || 'none';
  }, [userRoles, selectedOrg]);

  const canWrite = currentOrgRole === 'write';

  return (
    <OrgContext.Provider value={{ selectedOrg, setSelectedOrg, organizations: accessibleOrgs, allOrganizations: ORGANIZATIONS, orgInfo, currentOrgRole, canWrite }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}

/** Helper: returns org-scoped Firestore collection path */
export function getOrgCollection(orgId, collection) {
  return `orgs/${orgId}/${collection}`;
}
