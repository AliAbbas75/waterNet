import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import InputField from '../components/InputField';
import { useAuth } from '../context/AuthContext';

const initialState = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  organization: '',
  role: '',
};

export default function SignupPage() {
  const [formData, setFormData] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [termsChecked, setTermsChecked] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const validationMessage = useMemo(() => {
    if (!submitted) return '';
    if (!formData.fullName || !formData.email || !formData.password || !formData.role) {
      return 'Please complete all required fields.';
    }
    if (formData.password.length < 8) {
      return 'Password should be at least 8 characters long.';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
    }
    if (!termsChecked) {
      return 'You must agree to the access and privacy statement.';
    }
    return '';
  }, [formData, submitted, termsChecked]);

  const onChange = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);

    if (
      !formData.fullName ||
      !formData.email ||
      !formData.password ||
      !formData.role ||
      formData.password.length < 8 ||
      formData.password !== formData.confirmPassword ||
      !termsChecked
    ) {
      return;
    }

    setLoading(true);
    const result = await signup(formData);
    setLoading(false);

    if (result.ok) {
      navigate('/verify-2fa');
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Request secure access for water monitoring and plant operations"
    >
      <form className="auth-form auth-form-signup" onSubmit={onSubmit}>
        <div className="form-grid two-columns">
          <InputField
            label="Full Name"
            icon="👤"
            type="text"
            placeholder="Ali Abbas"
            value={formData.fullName}
            onChange={onChange('fullName')}
          />

          <InputField
            label="Official Email"
            icon="✉"
            type="email"
            placeholder="name@watermonitor.gov"
            value={formData.email}
            onChange={onChange('email')}
          />
        </div>

        <div className="form-grid two-columns">
          <InputField
            label="Password"
            icon="🔒"
            type="password"
            placeholder="Minimum 8 characters"
            value={formData.password}
            onChange={onChange('password')}
          />

          <InputField
            label="Confirm Password"
            icon="✔"
            type="password"
            placeholder="Re-enter password"
            value={formData.confirmPassword}
            onChange={onChange('confirmPassword')}
          />
        </div>

        <div className="form-grid two-columns">
          <InputField
            label="Authority / Society"
            icon="🏢"
            type="text"
            placeholder="CDA, Bahria, DHA..."
            value={formData.organization}
            onChange={onChange('organization')}
          />

          <InputField
            label="Requested Role"
            icon="⍟"
            as="select"
            value={formData.role}
            onChange={onChange('role')}
            className="select-control"
          >
            <option value="">Select role</option>
            <option value="admin">Administrator</option>
            <option value="maintainer">Maintainer</option>
            <option value="public">Public User</option>
          </InputField>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={termsChecked}
            onChange={(event) => setTermsChecked(event.target.checked)}
          />
          <span>I agree to the access policy and secure data handling statement.</span>
        </label>

        {validationMessage && <p className="form-message error">{validationMessage}</p>}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <div className="auth-links dual-links">
          <p className="inline-note compact-note">
            Already registered? <Link to="/login">Back to login</Link>
          </p>
          <p className="inline-note compact-note">
            Next step: <Link to="/verify-2fa">2FA verification</Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
