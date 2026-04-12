from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import ChatRequest, ChatResponse
from app.services.rag import build_rag_context

router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM_PT = SYSTEM_PT = """
Você é um assistente educacional em oncologia veterinária vinculado ao programa OncoWay.

Sua função é exclusivamente acadêmica, voltada para:
- ensino
- interpretação de literatura
- análise de laudos e conceitos

⚠️ Limitação obrigatória:
Você NÃO fornece:
- condutas clínicas
- decisões terapêuticas
- protocolos
- doses de medicamentos

Sempre que solicitado, responda com a seguinte orientação padrão:

"Dentro do escopo educacional deste assistente, não são fornecidas doses ou protocolos terapêuticos.

Doses e decisões terapêuticas dependem da avaliação clínica individual do paciente e devem ser definidas pelo oncologista responsável com base em literatura atualizada e no contexto clínico específico. Dúvidas sobre esse assunto consulte o grupo Oncoway.

Posso, no entanto, discutir aspectos teóricos do uso desse fármaco em oncologia veterinária."

📚 Estilo de resposta:
- linguagem clara, objetiva e acadêmica
- evitar prescrição
- foco em explicação e interpretação

📌 Estrutura padrão:
1. Contextualização acadêmica breve
2. Achados principais
3. Discussão baseada na literatura
4. Fatores prognósticos relevantes
5. Limitações da interpretação

📊 Para respostas rápidas:
- usar bullet points curtos (máx. 6)

🔬 Para análise de laudos:
Seguir:
1. Coerência descrição x conclusão
2. Correlação clínico-patológica
3. Critérios de malignidade

⚠️ Sempre incluir quando apropriado:
"Esta resposta tem caráter exclusivamente educacional e não deve ser utilizada como orientação clínica ou terapêutica."
"""


def _build_openai_messages(body: ChatRequest, rag_context: str | None) -> list[dict]:
    system = SYSTEM_PT
    if rag_context:
        system += (
            "\n\n---\nTrechos recuperados dos materiais de apoio publicados (use quando pertinentes; "
            "cite o título entre colchetes):\n\n"
            + rag_context
        )

    msgs: list[dict] = [{"role": "system", "content": system}]
    n = len(body.messages)
    for i, m in enumerate(body.messages):
        last = i == n - 1
        if m.role == "user" and last and body.image_base64:
            text = (m.content or "").strip() or "Analise a imagem no contexto de oncologia veterinária, de forma educacional."
            url = f"data:{body.image_media_type};base64,{body.image_base64}"
            msgs.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text},
                        {"type": "image_url", "image_url": {"url": url}},
                    ],
                }
            )
        else:
            msgs.append({"role": m.role, "content": m.content})
    return msgs


@router.post("", response_model=ChatResponse)
def chat_completion(
    body: ChatRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço de IA não configurado. Defina OPENAI_API_KEY no servidor.",
        )

    client = OpenAI(api_key=settings.openai_api_key)

    rag_ctx = ""
    try:
        rag_ctx = build_rag_context(db, client, body.messages)
    except Exception:
        rag_ctx = ""

    messages = _build_openai_messages(body, rag_ctx if rag_ctx.strip() else None)

    try:
        completion = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            max_tokens=4096,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao contatar o provedor de IA: {e!s}",
        ) from e

    choice = completion.choices[0].message.content
    if not choice:
        raise HTTPException(status_code=502, detail="Resposta vazia do modelo.")
    return ChatResponse(message=choice)
