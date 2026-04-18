import { Link, useLocation } from 'react-router-dom';
import WaterDropLogo from './WaterDropLogo';

export default function AuthLayout({
  title,
  subtitle,
  caption = 'Secure access to water infrastructure monitoring',
  children,
}) {
  const location = useLocation();

  return (
    <main className="auth-shell">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />
      <div className="bg-orb orb-three" />

      <section className="auth-card">
        <div className="logo-wrap">
          <WaterDropLogo />
        </div>

        <header className="auth-header">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>

        <div className="auth-tabs" aria-label="Authentication navigation">
          <Link className={location.pathname === '/login' ? 'active' : ''} to="/login">
            Login
          </Link>
          <Link className={location.pathname === '/signup' ? 'active' : ''} to="/signup">
            Sign Up
          </Link>
          <Link className={location.pathname === '/verify-2fa' ? 'active' : ''} to="/verify-2fa">
            2FA
          </Link>
        </div>

        {children}

        <footer className="auth-footer">
          <div className="divider" />
          <p>{caption}</p>
        </footer>
      </section>
    </main>
  );
}
