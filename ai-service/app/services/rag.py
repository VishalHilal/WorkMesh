import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.chat import ChatData, ChatMessage, Citation
from app.schemas.retrieve import ChunkMatch
from app.services.guardrails import (
    SAFE_REFUSAL_MESSAGE,
    redact_sensitive_output,
    validate_user_input,
)
from app.services.llm import call_gemini_api
from app.services.retriever import retrieve_relevant_chunks

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are WorkMesh AI, an enterprise assistant for WorkMesh Technologies Pvt. Ltd.
Your job is to answer employee questions accurately and strictly based on the provided company document excerpts.

Strict Rules:
1. Answer ONLY using facts directly mentioned in the provided Context Chunks.
2. If the context does not contain the answer, say clearly: "I could not find information regarding this in the uploaded company documents." Do NOT invent or extrapolate facts.
3. When providing facts from a chunk, append an inline citation with the exact chunk identifier in brackets, like [Source: <chunk_id>].
4. Maintain a professional, concise, and helpful tone suitable for an enterprise workspace.
5. Formatting & Structure:
   - For evaluation, candidate fit, comparison, or multi-faceted questions:
     * Start with a direct, one-line verdict or summary.
     * Follow with structured sections using bold headings: **Key Qualifications & Strengths**, **Gaps / Not Found in Documents**, and **Suggested Next Steps**.
   - Use clean markdown bullet points with bold lead-ins for readability.
   - Avoid vague hedges (such as "it depends on your specific requirements"); give a direct, factual synthesis based on the documents."""


def build_user_prompt(query: str, chunks: list[ChunkMatch]) -> str:
    """Format user query and context chunks into an augmented prompt."""
    context_blocks = []
    for chunk in chunks:
        context_blocks.append(
            f"--- Context Chunk [ID: {chunk.chunk_id}] (Document: {chunk.document_id}) ---\n"
            f"{chunk.content.strip()}\n"
        )

    context_str = "\n".join(context_blocks)
    return (
        f"Context Chunks from Company Documentation:\n"
        f"{context_str}\n\n"
        f"Employee Question: {query}\n\n"
        f"Please provide a factual answer citing source chunk IDs [Source: <chunk_id>]."
    )


def build_citations(chunks: list[ChunkMatch], answer: str) -> list[Citation]:
    """Map retrieved chunks to structured citations if referenced or in top matches."""
    citations: list[Citation] = []
    for chunk in chunks:
        # Include if explicitly cited in text or top relevant chunk
        snippet = (
            chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
        )
        citations.append(
            Citation(
                chunk_id=chunk.chunk_id,
                document_id=chunk.document_id,
                chunk_index=chunk.chunk_index,
                snippet=snippet,
                similarity_score=chunk.similarity_score,
            )
        )
    return citations


def run_rag_pipeline(
    session: Session,
    company_id: str,
    query: str,
    chat_history: list[ChatMessage] | None = None,
    top_k: int = 5,
    threshold: float = 0.3,
    document_ids: list[str] | None = None,
) -> ChatData:
    """Run full RAG pipeline: multi-tenant retrieval, prompt augmentation, and Gemini LLM synthesis."""
    # 0. Pre-LLM input guardrail
    guard = validate_user_input(query)
    if not guard.allowed:
        logger.warning(
            "RAG input guardrail triggered for company '%s' (rule=%s)",
            company_id,
            guard.rule,
        )
        return ChatData(
            query=query,
            answer=SAFE_REFUSAL_MESSAGE,
            citations=[],
            model=settings.gemini_model,
            grounded=False,
        )

    # 1. Retrieve top-k relevant document chunks for the company
    chunks = retrieve_relevant_chunks(
        session=session,
        company_id=company_id,
        query=query,
        top_k=top_k,
        threshold=threshold,
        document_ids=document_ids,
    )

    # 2. Anti-hallucination guardrail: No chunks found
    if not chunks:
        logger.info(
            "No matching chunks found for company '%s' (query: '%s')",
            company_id,
            query[:40],
        )
        return ChatData(
            query=query,
            answer=(
                "I could not find any relevant information in your company's uploaded documents "
                "to answer this question. Please ensure the relevant policy or documentation has "
                "been uploaded to the Document Hub."
            ),
            citations=[],
            model=settings.gemini_model,
            grounded=False,
        )

    # 3. Assemble prompt with context chunks
    user_prompt = build_user_prompt(query, chunks)

    # 4. Invoke Google Gemini Flash
    raw_answer = call_gemini_api(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        chat_history=chat_history,
    )
    answer, redacted_rules = redact_sensitive_output(raw_answer)
    if redacted_rules:
        logger.warning(
            "Redacted sensitive output in RAG response for company '%s' (rules=%s)",
            company_id,
            redacted_rules,
        )

    # 5. Build structured citations
    citations = build_citations(chunks, answer)

    return ChatData(
        query=query,
        answer=answer,
        citations=citations,
        model=settings.gemini_model,
        grounded=True,
    )
