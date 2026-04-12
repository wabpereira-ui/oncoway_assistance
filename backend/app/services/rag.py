"""Chunking, embeddings e busca por similaridade para materiais publicados."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from openai import OpenAI
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from datetime import datetime, timezone

from app.config import settings
from app.models import DocumentStatus, SupportDocument, SupportDocumentChunk

def extract_text_from_file(path: Path) -> str:
    suf = path.suffix.lower()
    if suf == ".txt":
        return path.read_text(encoding="utf-8", errors="replace")
    if suf == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        parts: list[str] = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n".join(parts)
    raise ValueError(f"Extensão não suportada: {suf}")


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start = max(0, end - overlap)
        if start == 0 and end < n:
            start = end
    return chunks


def embed_texts(client: OpenAI, model: str, inputs: list[str]) -> list[list[float]]:
    if not inputs:
        return []
    out: list[list[float]] = []
    batch = 64
    for i in range(0, len(inputs), batch):
        sub = inputs[i : i + batch]
        resp = client.embeddings.create(model=model, input=sub)
        out.extend([d.embedding for d in resp.data])
    return out


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def last_user_query_text(messages: list) -> str:
    for m in reversed(messages):
        role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else None)
        content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else None)
        if role == "user" and content:
            return str(content)[:4000]
    return ""


def index_support_document(db: Session, doc: SupportDocument, client: OpenAI) -> None:
    path = Path(doc.stored_path)
    if not path.is_file():
        raise ValueError("Arquivo não encontrado no servidor.")

    text = extract_text_from_file(path)
    if len(text.strip()) < 30:
        raise ValueError(
            "Pouco ou nenhum texto extraído. PDFs só com imagem exigem OCR separado; prefira PDF com texto ou TXT."
        )

    chunks = chunk_text(text, settings.rag_chunk_size, settings.rag_chunk_overlap)
    if not chunks:
        raise ValueError("Não foi possível gerar trechos do documento.")

    embeddings = embed_texts(client, settings.openai_embedding_model, chunks)
    if len(embeddings) != len(chunks):
        raise ValueError("Falha ao gerar embeddings.")

    try:
        db.execute(delete(SupportDocumentChunk).where(SupportDocumentChunk.document_id == doc.id))
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings, strict=True)):
            db.add(
                SupportDocumentChunk(
                    document_id=doc.id,
                    chunk_index=i,
                    content=chunk,
                    embedding_json=json.dumps(emb),
                )
            )
        doc.indexed_at = datetime.now(timezone.utc)
        doc.index_error = None
        doc.status = DocumentStatus.published
        db.commit()
        db.refresh(doc)
    except Exception:
        db.rollback()
        raise


def build_rag_context(db: Session, client: OpenAI, messages: list) -> str:
    """Recupera trechos dos materiais publicados com base na última pergunta do usuário."""
    q = last_user_query_text(messages).strip()
    if not q:
        return ""

    stmt = (
        select(SupportDocumentChunk, SupportDocument.title)
        .join(SupportDocument, SupportDocumentChunk.document_id == SupportDocument.id)
        .where(SupportDocument.status == DocumentStatus.published)
    )
    rows = db.execute(stmt).all()
    if not rows:
        return ""

    q_emb = embed_texts(client, settings.openai_embedding_model, [q])
    if not q_emb:
        return ""
    query_vec = q_emb[0]

    scored: list[tuple[float, str, str]] = []
    for chunk, title in rows:
        try:
            vec = json.loads(chunk.embedding_json)
        except (json.JSONDecodeError, TypeError):
            continue
        if not vec:
            continue
        score = cosine(query_vec, vec)
        scored.append((score, title, chunk.content))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[: settings.rag_top_k]
    if not top:
        return ""

    parts: list[str] = []
    for i, (_s, title, content) in enumerate(top, start=1):
        parts.append(f"[{i}] Fonte: «{title}»\n{content}")
    return "\n\n---\n".join(parts)

