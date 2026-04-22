import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import lendingRoutes from './modules/lending';
import { OrgProvider } from './context/OrgContext';

export default function App() {
  return (
    <OrgProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/money-lending/lending" replace />} />
          {lendingRoutes}
        </Route>
      </Routes>
    </OrgProvider>
  );
}
