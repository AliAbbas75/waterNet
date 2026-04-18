import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SuccessPage() {
  const { user, logout } = useAuth();

  return (
    <main className="success-shell">
      <section className="success-card">
        <div className="success-badge">✓</div>
        <h1>Authentication Flow Ready</h1>
        <p>
          This frontend includes the requested Login, Signup and 2FA pages styled to match the
          Smart WaterNet UI direction.
        </p>

        <div className="summary-grid">
          <article>
            <span>Signed in as</span>
            <strong>{user?.email ?? 'demo@watermonitor.gov'}</strong>
          </article>
          <article>
            <span>Role</span>
            <strong>{user?.role ?? 'admin'}</strong>
          </article>
          <article>
            <span>Status</span>
            <strong>{user?.stage ?? 'authenticated'}</strong>
          </article>
        </div>

        <div className="success-actions">
          <Link className="primary-button center-button" to="/login">
            View Login Again
          </Link>
          <button className="secondary-button" type="button" onClick={logout}>
            Clear Demo State
          </button>
        </div>
      </section>
    </main>
  );
}
