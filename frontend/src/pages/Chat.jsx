import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { firstName } from "../utils/name.js";

const roleLabel = {
  student: "Aluno",
  mentor: "Mentor",
  admin: "Administrador",
};

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Use imagem JPG, PNG, WebP ou GIF (PDF envie como captura de tela)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("Leitura inválida."));
        return;
      }
      const comma = dataUrl.indexOf(",");
      if (comma < 0) {
        reject(new Error("Formato de imagem inválido."));
        return;
      }
      const meta = dataUrl.slice(0, comma);
      const b64 = dataUrl.slice(comma + 1);
      const mimeMatch = meta.match(/^data:([^;]+)/);
      const mediaType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      resolve({ base64: b64, mediaType });
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export default function Chat() {
  const { user, logout } = useAuth();
  const [thread, setThread] = useState([]);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  function clearImage() {
    setPendingImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function attachImageFile(file) {
    if (!file.type.startsWith("image/")) {
      setError("Use apenas imagem (arquivo ou colar captura de tela / recorte).");
      return;
    }
    setError("");
    try {
      if (file.size > 12 * 1024 * 1024) {
        throw new Error("Imagem muito grande; use até ~12 MB ou reduza a resolução.");
      }
      const parts = await readImageFile(file);
      setPendingImage(parts);
      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err.message || "Erro ao carregar imagem.");
      clearImage();
    }
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    void attachImageFile(file);
  }

  function onPaste(e) {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) void attachImageFile(blob);
        return;
      }
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && !pendingImage) return;
    setError("");
    setLoading(true);
    const userText = trimmed || "(imagem anexada — analise no contexto de oncologia veterinária, de forma educacional.)";
    const nextMessages = [...thread, { role: "user", content: userText }];
    try {
      const res = await api("/api/chat", {
        method: "POST",
        body: {
          messages: nextMessages,
          image_base64: pendingImage?.base64 ?? null,
          image_media_type: pendingImage?.mediaType ?? "image/jpeg",
        },
      });
      setThread([...nextMessages, { role: "assistant", content: res.message }]);
      setText("");
      clearImage();
    } catch (err) {
      setError(err.message || "Falha ao obter resposta.");
    } finally {
      setLoading(false);
    }
  }

  const greet = firstName(user.full_name) || user.full_name;

  return (
    <div className="layout">
      <header className="nav">
        <div>
          <strong>Oncoway Assistance</strong>
        </div>
        <div className="row">
          {(user.role === "admin" || user.role === "mentor") && (
            <>
              <Link to="/materiais">Materiais</Link>
              <Link to="/usuarios">Usuários</Link>
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <div className="card">
        <h1>Olá, {greet}</h1>
        <p className="muted">
          Perfil: <strong>{roleLabel[user.role] ?? user.role}</strong>
          {user.preferred_locale ? (
            <>
              {" "}
              · Idioma: <strong>{user.preferred_locale}</strong>
            </>
          ) : null}
        </p>
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Apoio educacional em oncologia veterinária. O assistente pode usar <strong>materiais publicados</strong> pelos
          mentores para embasar respostas (com citações). Anexe ou <strong>cole uma imagem</strong> (Ctrl+V) no campo
          abaixo. Não substitui o julgamento clínico.
        </p>

        <div className="chat-wrap">
          {thread.length === 0 ? (
            <p className="muted">Envie uma pergunta, anexe uma imagem ou cole com Ctrl+V no campo de texto.</p>
          ) : null}
          {thread.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role === "user" ? "user" : "assistant"}`}>
              {m.content}
            </div>
          ))}
        </div>

        {previewUrl ? (
          <div className="chat-toolbar">
            <img src={previewUrl} alt="Pré-visualização" className="chat-preview" />
            <button type="button" className="btn btn-ghost" onClick={clearImage}>
              Remover imagem
            </button>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <form onSubmit={onSubmit}>
          <div className="chat-toolbar">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} />
          </div>
          <div className="chat-input-row">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={onPaste}
              placeholder="Digite sua dúvida ou cole uma imagem aqui (Ctrl+V)…"
              disabled={loading}
            />
            <button type="submit" className="btn" disabled={loading || (!text.trim() && !pendingImage)}>
              {loading ? "…" : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
