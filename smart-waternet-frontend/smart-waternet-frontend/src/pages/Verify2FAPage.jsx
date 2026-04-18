import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import OTPInput from '../components/OTPInput';
import { useAuth } from '../context/AuthContext';

export default function Verify2FAPage() {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { verify2FA, user } = useAuth();

  const maskedEmail = useMemo(() => {
    if (!user?.email) return 'your registered email';
    const [name, domain] = user.email.split('@');
    if (!domain) return user.email;
    return `${name.slice(0, 2)}****@${domain}`;
  }, [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (code.length !== 6) {
      setFeedback('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    const result = await verify2FA(code);
    setLoading(false);

    if (!result.ok) {
      setFeedback(result.message);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <AuthLayout
      title="2FA Verification"
      subtitle="Enter the one-time code sent to your registered email or authenticator app"
    >
      <form className="auth-form verify-form" onSubmit={handleSubmit}>
        <div className="verify-panel">
          <div className="verify-icon">🛡</div>
          <p>
            We sent a 6-digit code to <strong>{maskedEmail}</strong>.
          </p>
          <p className="helper-copy">For demo preview, use code: 123456</p>
        </div>

        <OTPInput value={code} onChange={setCode} />

        {feedback && <p className="form-message error">{feedback}</p>}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify & Continue'}
        </button>

        <div className="auth-links dual-links">
          <button type="button" className="text-link">
            Resend code
          </button>
          <Link className="text-link link-button" to="/login">
            Back to login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
