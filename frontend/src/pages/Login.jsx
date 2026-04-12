import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) {
    return <Navigate to={user.must_change_password ? "/definir-senha" : "/chat"} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const me = await login(email, password);
      nav(me.must_change_password ? "/definir-senha" : "/chat", { replace: true });
    } catch (err) {
      setError(err.message || "Falha no login.");
    }
  }

  return (
    <div className="layout">
      <div className="card" style={{ maxWidth: 400, margin: "3rem auto" }}>
        <h1>Entrar</h1>
        <p className="muted">Oncoway Assistance</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn" style={{ width: "100%" }}>
            Entrar
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1rem" }}>
          O acesso é criado pelo administrador do programa. Em dúvida, contate a coordenação.
        </p>
      </div>
    </div>
  );
}
