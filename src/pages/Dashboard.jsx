import { Link } from 'react-router-dom';

export default function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Apps</h1>
      <div className="card-grid">
        <Link to="/money-lending/lending" className="dashboard-card">
          <span className="dashboard-card-icon">💰</span>
          <h3>Money Lending</h3>
          <p>Track loans, repayments & interest</p>
        </Link>
        {/* Future modules will add cards here */}
      </div>
    </div>
  );
}
