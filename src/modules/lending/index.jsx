import { Route } from 'react-router-dom';
import LoanList from './pages/LoanList';
import LoanForm from './pages/LoanForm';
import LoanDetail from './pages/LoanDetail';
import BorrowingList from './pages/BorrowingList';
import BorrowingForm from './pages/BorrowingForm';
import BorrowingDetail from './pages/BorrowingDetail';
import FinalizedView from './pages/FinalizedView';
import ClientDetail from './pages/ClientDetail';

// Module route config — imported by App.jsx
const lendingRoutes = (
  <>
    <Route path="money-lending/lending" element={<LoanList />} />
    <Route path="money-lending/lending/new" element={<LoanForm />} />
    <Route path="money-lending/borrowing" element={<BorrowingList />} />
    <Route path="money-lending/borrowing/new" element={<BorrowingForm />} />
    <Route path="money-lending/borrowing/:id" element={<BorrowingDetail />} />
    <Route path="money-lending/borrowing/:id/edit" element={<BorrowingForm />} />
    <Route path="money-lending/finalized" element={<FinalizedView />} />
    <Route path="money-lending/client/:name" element={<ClientDetail />} />
    <Route path="money-lending/lending/:id" element={<LoanDetail />} />
    <Route path="money-lending/lending/:id/edit" element={<LoanForm />} />
  </>
);

export default lendingRoutes;
