from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str = "troque-esta-chave-em-producao-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 dias

    database_url: str = "sqlite:///./mentoria.db"

    # Opcional: cria o primeiro administrador se não existir nenhum usuário
    first_admin_email: str | None = None
    first_admin_password: str | None = None
    first_admin_name: str = "Administrador"

    # Senha inicial para usuários criados pelo admin quando a senha não é informada (troca obrigatória no 1º acesso)
    default_initial_user_password: str = "OncowayInicial8!"

    # OpenAI (chave apenas no servidor — nunca no front)
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # Materiais de apoio (RAG): PDF/TXT na pasta abaixo (criada na subida da API)
    materials_storage_path: str = "uploads/materials"
    rag_top_k: int = 6
    rag_chunk_size: int = 900
    rag_chunk_overlap: int = 150


settings = Settings()
