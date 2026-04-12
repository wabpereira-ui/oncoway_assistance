import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

const statusLabel = {
  draft: "Rascunho",
  published: "Publicado",
};

export default function Materials() {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await api("/api/materials");
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

  async function onUpload(e) {
    e.preventDefault();
    if (!file) {
      setError("Selecione um arquivo PDF ou TXT.");
      return;
    }
    setError("");
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("file", file);
      await api("/api/materials", { method: "POST", body: fd });
      setTitle("");
      setFile(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function onPublish(id) {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/materials/${id}/publish`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id) {
    if (!window.confirm("Excluir este material e todos os trechos indexados?")) return;
    setBusyId(id);
    setError("");
    try {
      await api(`/api/materials/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="layout">
      <header className="nav">
        <Link to="/chat">← Chat</Link>
        <span className="muted">Materiais de apoio (RAG)</span>
      </header>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h1>Novo material</h1>
        <p className="muted">
          Envie PDF (com texto selecionável) ou TXT. Fica como rascunho até você clicar em <strong>Publicar</strong>
          — aí o texto é indexado e passa a orientar o chat automaticamente.
        </p>
        <form onSubmit={onUpload}>
          <div className="field">
            <label htmlFor="mtitle">Título (como aparecerá nas citações)</label>
            <input id="mtitle" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={512} />
          </div>
          <div className="field">
            <label htmlFor="mfile">Arquivo</label>
            <input
              id="mfile"
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn" disabled={!title.trim() || !file}>
            Enviar rascunho
          </button>
        </form>
      </div>

      <div className="card">
        <h1>Materiais</h1>
        {loading ? (
          <p className="muted">Carregando…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Arquivo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <td>{m.title}</td>
                    <td>{m.original_filename}</td>
                    <td>
                      {statusLabel[m.status] ?? m.status}
                      {m.index_error ? (
                        <div className="error" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                          {m.index_error}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="row">
                        {m.status === "draft" && (
                          <button
                            type="button"
                            className="btn"
                            disabled={busyId === m.id}
                            onClick={() => onPublish(m.id)}
                          >
                            {busyId === m.id ? "…" : "Publicar"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busyId === m.id}
                          onClick={() => onDelete(m.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
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
