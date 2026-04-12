import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

const roleLabel = {
  student: "Aluno",
  mentor: "Mentor",
  admin: "Administrador",
};

export default function Users() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createOk, setCreateOk] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await api("/api/users");
      setList(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveRow(u) {
    const select = document.getElementById(`role-${u.id}`);
    const active = document.getElementById(`active-${u.id}`);
    if (!select) return;
    setSavingId(u.id);
    setError("");
    try {
      await api(`/api/users/${u.id}`, {
        method: "PATCH",
        body: {
          role: select.value,
          is_active: active.checked,
        },
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  const isAdmin = user.role === "admin";

  async function createUser(e) {
    e.preventDefault();
    setCreateOk("");
    setError("");
    const pw = newPassword.trim();
    if (pw && pw.length < 8) {
      setError("Senha inicial: use pelo menos 8 caracteres ou deixe em branco para a senha padrão do servidor.");
      return;
    }
    setCreateBusy(true);
    try {
      const body = {
        email: newEmail.trim(),
        full_name: newName.trim(),
        preferred_locale: "pt-BR",
      };
      if (pw.length >= 8) body.password = pw;
      await api("/api/users", { method: "POST", body });
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setCreateOk(
        pw.length >= 8
          ? "Usuário criado. Envie o e-mail e a senha que você definiu (o aluno deve trocá-la no primeiro acesso)."
          : "Usuário criado com a senha inicial padrão do servidor. Informe o e-mail e essa senha pelo canal seguro da mentoria."
      );
      await load();
    } catch (err) {
      setError(err.message || "Não foi possível criar o usuário.");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="layout">
      <header className="nav">
        <div className="row">
          <Link to="/chat">← Chat</Link>
          <Link to="/materiais">Materiais</Link>
        </div>
        <span className="muted">Lista de usuários</span>
      </header>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h1>Novo usuário (aluno)</h1>
          <p className="muted">
            Cadastro público está desligado. Deixe a senha em branco para usar a padrão definida no servidor
            (variável <code>DEFAULT_INITIAL_USER_PASSWORD</code> no <code>.env</code>); o aluno será obrigado a trocar
            no primeiro acesso.
          </p>
          <form onSubmit={createUser}>
            <div className="field">
              <label htmlFor="nu-email">E-mail</label>
              <input
                id="nu-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="nu-name">Nome completo</label>
              <input
                id="nu-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="field">
              <label htmlFor="nu-pw">Senha inicial (opcional, mín. 8 caracteres)</label>
              <input
                id="nu-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="Vazio = senha padrão do servidor"
              />
            </div>
            <button type="submit" className="btn" disabled={createBusy}>
              {createBusy ? "Criando…" : "Criar usuário"}
            </button>
          </form>
          {createOk ? <p className="muted" style={{ marginTop: "0.75rem" }}>{createOk}</p> : null}
        </div>
      ) : null}

      <div className="card">
        <h1>Usuários</h1>
        <p className="muted">
          {isAdmin
            ? "Como administrador, você pode criar alunos, alterar perfil (papel) e status ativo."
            : "Como mentor, você visualiza a lista. Alterações de perfil são feitas pelo administrador."}
        </p>
        {error ? <p className="error">{error}</p> : null}
        {loading ? (
          <p className="muted">Carregando…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Ativo</th>
                  <th>1º acesso</th>
                  {isAdmin ? <th>Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>
                      {isAdmin ? (
                        <select id={`role-${u.id}`} defaultValue={u.role}>
                          <option value="student">{roleLabel.student}</option>
                          <option value="mentor">{roleLabel.mentor}</option>
                          <option value="admin">{roleLabel.admin}</option>
                        </select>
                      ) : (
                        roleLabel[u.role] ?? u.role
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <input type="checkbox" id={`active-${u.id}`} defaultChecked={u.is_active} />
                      ) : u.is_active ? (
                        "Sim"
                      ) : (
                        "Não"
                      )}
                    </td>
                    <td className="muted">{u.must_change_password ? "Trocar senha" : "—"}</td>
                    {isAdmin ? (
                      <td>
                        <button
                          type="button"
                          className="btn"
                          disabled={savingId === u.id}
                          onClick={() => saveRow(u)}
                        >
                          {savingId === u.id ? "Salvando…" : "Salvar"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
