import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import InputField from '../components/InputField';
import { useAuth } from '../context/AuthContext';

const initialState = {
  email: 'admin@watermonitor.gov',
  password: '',
  role: '',
};

export default function LoginPage() {
  const [formData, setFormData] = useState(initialState);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onChange = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!formData.email || !formData.password || !formData.role) {
      setError('Please fill in email, password and role to continue.');
      return;
    }

    setError('');
    setLoading(true);
    const result = await login(formData);
    setLoading(false);

    if (result.ok) {
      navigate('/verify-2fa');
    }
  };

  return (
    <AuthLayout title="Water Monitor" subtitle="Smart IoT Water Monitoring System">
      <form className="auth-form" onSubmit={onSubmit}>
        <InputField
          label="Email Address"
          icon="✉"
          type="email"
          placeholder="admin@watermonitor.gov"
          value={formData.email}
          onChange={onChange('email')}
        />

        <InputField
          label="Password"
          icon="🔒"
          type="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={onChange('password')}
        />

        <InputField
          label="User Role"
          icon="⍟"
          as="select"
          value={formData.role}
          onChange={onChange('role')}
          className="select-control"
        >
          <option value="">Select your role</option>
          <option value="admin">Administrator</option>
          <option value="maintainer">Maintainer</option>
          <option value="public">Public User</option>
        </InputField>

        {error && <p className="form-message error">{error}</p>}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </button>

        <div className="auth-links single-link">
          <button type="button" className="text-link">
            Forgot your password?
          </button>
        </div>

        <p className="inline-note">
          New to Smart WaterNet? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
