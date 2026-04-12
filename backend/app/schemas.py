from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str | None = None


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    preferred_locale: str = Field(default="pt-BR", max_length=10)


class UserCreateByAdmin(UserBase):
    """Criação pelo admin. Se `password` for omitido, usa DEFAULT_INITIAL_USER_PASSWORD no servidor."""

    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    preferred_locale: str | None = Field(default=None, max_length=10)
    role: UserRole | None = None
    is_active: bool | None = None


class UserPublic(UserBase):
    id: int
    role: UserRole
    is_active: bool
    must_change_password: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=32000)


class ChatRequest(BaseModel):
    """Histórico da conversa + mensagem atual do usuário por último. Imagem opcional (última mensagem user)."""

    messages: list[ChatMessageIn] = Field(..., min_length=1, max_length=40)
    image_base64: str | None = None
    image_media_type: str = Field(default="image/jpeg", max_length=64)

    @field_validator("image_media_type")
    @classmethod
    def mime_ok(cls, v: str) -> str:
        allowed = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
        if v not in allowed:
            raise ValueError("Use image/jpeg, image/png, image/webp ou image/gif.")
        return v


class ChatResponse(BaseModel):
    message: str


class MaterialOut(BaseModel):
    id: int
    title: str
    original_filename: str
    status: str
    created_at: datetime
    indexed_at: datetime | None = None
    index_error: str | None = None

    model_config = {"from_attributes": True}
