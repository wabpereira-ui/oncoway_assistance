from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from openai import OpenAI
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.config import settings
from app.database import get_db
from app.models import DocumentStatus, SupportDocument, SupportDocumentChunk, User, UserRole
from app.schemas import MaterialOut
from app.services.rag import index_support_document

router = APIRouter(prefix="/materials", tags=["materials"])


def _materials_dir() -> Path:
    return Path(settings.materials_storage_path).resolve()


def _to_out(d: SupportDocument) -> MaterialOut:
    return MaterialOut(
        id=d.id,
        title=d.title,
        original_filename=d.original_filename,
        status=d.status.value,
        created_at=d.created_at,
        indexed_at=d.indexed_at,
        index_error=d.index_error,
    )


@router.get("", response_model=list[MaterialOut])
def list_materials(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.mentor, UserRole.admin)),
):
    docs = db.scalars(select(SupportDocument).order_by(SupportDocument.id.desc())).all()
    return [_to_out(d) for d in docs]


@router.post("", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
async def upload_material(
    title: str = Form(..., min_length=1, max_length=512),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.mentor, UserRole.admin)),
):
    raw = await file.read()
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo deve ter no máximo 15 MB.")

    name = file.filename or "documento"
    ext = Path(name).suffix.lower()
    if ext not in (".pdf", ".txt"):
        raise HTTPException(status_code=400, detail="Envie apenas PDF ou TXT.")

    _materials_dir().mkdir(parents=True, exist_ok=True)

    doc = SupportDocument(
        title=title.strip(),
        original_filename=name[:512],
        stored_path="",
        status=DocumentStatus.draft,
        created_by_id=user.id,
    )
    db.add(doc)
    db.flush()

    dest = _materials_dir() / f"{doc.id}{ext}"
    dest.write_bytes(raw)
    doc.stored_path = str(dest.resolve())
    db.commit()
    db.refresh(doc)
    return _to_out(doc)


@router.post("/{doc_id}/publish", response_model=MaterialOut)
def publish_material(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.mentor, UserRole.admin)),
):
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY necessária para indexar embeddings.",
        )
    doc = db.get(SupportDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Material não encontrado.")

    client = OpenAI(api_key=settings.openai_api_key)
    try:
        index_support_document(db, doc, client)
    except ValueError as e:
        doc = db.get(SupportDocument, doc_id)
        if doc:
            doc.index_error = str(e)[:4000]
            db.commit()
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        db.rollback()
        doc = db.get(SupportDocument, doc_id)
        if doc:
            doc.index_error = str(e)[:4000]
            db.commit()
        raise HTTPException(status_code=502, detail=f"Falha ao indexar: {e!s}") from e

    doc = db.get(SupportDocument, doc_id)
    return _to_out(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.mentor, UserRole.admin)),
):
    doc = db.get(SupportDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    path = Path(doc.stored_path)
    db.execute(delete(SupportDocumentChunk).where(SupportDocumentChunk.document_id == doc_id))
    db.delete(doc)
    db.commit()
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            pass
    return None
