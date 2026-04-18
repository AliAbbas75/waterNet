export default function WaterDropLogo() {
  return (
    <div className="water-logo" aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10c1e8" />
            <stop offset="100%" stopColor="#1763ff" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#logoGradient)" />
        <path
          d="M32 16c-6.4 8-12 14.7-12 21.4C20 44.8 25.4 50 32 50s12-5.2 12-12.6C44 30.7 38.4 24 32 16Zm0 30.7c-5 0-8.6-3.8-8.6-9.2 0-4.4 3.3-9.1 8.6-15.9 5.3 6.8 8.6 11.5 8.6 15.9 0 5.4-3.7 9.2-8.6 9.2Z"
          fill="#fff"
        />
      </svg>
    </div>
  );
}
