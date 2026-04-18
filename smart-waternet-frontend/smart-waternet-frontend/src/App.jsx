import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Verify2FAPage from './pages/Verify2FAPage';
import SuccessPage from './pages/SuccessPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-2fa" element={<Verify2FAPage />} />
      <Route path="/dashboard" element={<SuccessPage />} />
    </Routes>
  );
}
