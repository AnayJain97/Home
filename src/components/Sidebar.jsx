import { NavLink } from 'react-router-dom';
import { useState } from 'react';

// Config-driven nav items — add new modules here
const NAV_ITEMS = [
  { label: 'Apps', path: '/', icon: '📊' },
  { label: 'Money Lending', path: '/money-lending/lending', icon: '💰' },
  // Future modules:
  // { label: 'Invoices', path: '/invoices', icon: '📄' },
  // { label: 'Expenses', path: '/expenses', icon: '📋' },
  // { label: 'Inventory', path: '/inventory', icon: '📦' },
  // { label: 'EMI Calc', path: '/emi', icon: '🧮' },
];

export default function Sidebar({ onClose }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2>MJ Finance</h2>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">✕</button>
      </div>
      <ul className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              onClick={onClose}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
