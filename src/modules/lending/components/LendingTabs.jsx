import { NavLink } from 'react-router-dom';

export default function LendingTabs() {
  return (
    <div className="lending-tabs">
      <NavLink to="/money-lending/lending" end className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
        💰 Lendings
      </NavLink>
      <NavLink to="/money-lending/borrowing" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
        🔄 Borrowings
      </NavLink>
      <NavLink to="/money-lending/finalized" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
        📊 Finalized
      </NavLink>
    </div>
  );
}
