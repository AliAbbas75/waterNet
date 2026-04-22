import { Link, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Me from "./pages/Me.jsx";

export default function App() {
  return (
    <div style={{ padding: 24, textAlign: "left" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>WaterNet Auth Test</h2>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link to="/login">Login</Link>
          <Link to="/me">Me</Link>
        </nav>
      </header>

      <div style={{ height: 12 }} />

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/me" element={<Me />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}
