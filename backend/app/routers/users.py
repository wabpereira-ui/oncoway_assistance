from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_user_by_email, hash_password, require_roles
from app.database import get_db
from app.models import User, UserRole
from app.config import settings
from app.schemas import UserCreateByAdmin, UserPublic, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.mentor)),
):
    return db.query(User).order_by(User.id).all()


@router.patch("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.preferred_locale is not None:
        user.preferred_locale = body.preferred_locale
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user_admin(
    body: UserCreateByAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    """Admin cria usuário (aluno). Senha omitida → DEFAULT_INITIAL_USER_PASSWORD; 1º acesso exige troca."""
    if get_user_by_email(db, str(body.email)):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    raw_pwd = (body.password or "").strip() or settings.default_initial_user_password
    if len(raw_pwd) < 8:
        raise HTTPException(
            status_code=500,
            detail="DEFAULT_INITIAL_USER_PASSWORD no servidor deve ter pelo menos 8 caracteres.",
        )

    user = User(
        email=str(body.email).lower(),
        hashed_password=hash_password(raw_pwd),
        full_name=body.full_name.strip(),
        preferred_locale=body.preferred_locale or "pt-BR",
        role=UserRole.student,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
