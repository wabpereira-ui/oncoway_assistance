import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function DefinirSenha() {
  const { user, refresh, logout } = useAuth();
  const nav = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  if (!user) return <Navigate to="/login" replace />;
  if (!user.must_change_password) return <Navigate to="/chat" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("A nova senha e a confirmação não coincidem.");
      return;
    }
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: { current_password: current, new_password: next },
      });
      await refresh();
      nav("/chat", { replace: true });
    } catch (err) {
      setError(err.message || "Não foi possível alterar a senha.");
    }
  }

  return (
    <div className="layout">
      <div className="card" style={{ maxWidth: 440, margin: "2rem auto" }}>
        <h1>Definir nova senha</h1>
        <p className="muted">
          Por segurança, troque a senha inicial antes de usar o Oncoway Assistance. Use a senha que recebeu do
          administrador no campo «senha atual».
        </p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="cur">Senha atual (inicial)</label>
            <input
              id="cur"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="nw">Nova senha (mín. 8 caracteres)</label>
            <input
              id="nw"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cf">Confirmar nova senha</label>
            <input
              id="cf"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn" style={{ width: "100%" }}>
            Salvar e continuar
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sair
          </button>
        </p>
      </div>
    </div>
  );
}
