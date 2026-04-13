from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.config import settings
from app.database import Base, SessionLocal, engine, ensure_users_must_change_password_column
from app.models import User, UserRole
from app.auth import hash_password, get_user_by_email
from app.routers import auth, chat, materials, users


def ensure_schema():
    Base.metadata.create_all(bind=engine)


def seed_first_admin():
    if not settings.first_admin_email or not settings.first_admin_password:
        return
    db = SessionLocal()
    try:
        count = db.scalar(select(func.count()).select_from(User)) or 0
        if count > 0:
            return
        email = settings.first_admin_email.lower()
        if get_user_by_email(db, email):
            return
        admin = User(
            email=email,
            hashed_password=hash_password(settings.first_admin_password),
            full_name=settings.first_admin_name,
            role=UserRole.admin,
            preferred_locale="pt-BR",
            must_change_password=False,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.materials_storage_path).mkdir(parents=True, exist_ok=True)
    ensure_schema()
    ensure_users_must_change_password_column()
    seed_first_admin()
    yield


app = FastAPI(
    title="Oncoway Assistance — API",
    description="Autenticação, usuários e perfis (Oncoway Assistance).",
    lifespan=lifespan,
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://oncoway-assistance.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(materials.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
