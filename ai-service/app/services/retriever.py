import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chunk import DocumentChunk
from app.schemas.retrieve import ChunkMatch
from app.services.embeddings import generate_embeddings

logger = logging.getLogger(__name__)


def retrieve_relevant_chunks(
    session: Session,
    company_id: str,
    query: str,
    top_k: int = 5,
    threshold: float = 0.3,
    document_ids: list[str] | None = None,
) -> list[ChunkMatch]:
    """Retrieve ranked document chunks matching the query via pgvector cosine distance.

    Enforces strict multi-tenant isolation by filtering by company_id.
    """
    clean_query = query.strip()
    clean_company_id = company_id.strip()

    if not clean_query or not clean_company_id:
        return []

    # 1. Embed query into 384-dimensional dense vector
    query_embeddings = generate_embeddings([clean_query])
    if not query_embeddings:
        return []
    query_vector = query_embeddings[0]

    # 2. Build pgvector cosine distance and similarity expression
    distance_expr = DocumentChunk.embedding.cosine_distance(query_vector)
    similarity_expr = (1.0 - distance_expr).label("similarity")

    stmt = select(DocumentChunk, similarity_expr).where(
        DocumentChunk.company_id == clean_company_id
    )

    if document_ids:
        stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))

    # 3. Filter by similarity threshold and order by nearest distance
    stmt = stmt.where((1.0 - distance_expr) >= threshold)
    stmt = stmt.order_by(distance_expr.asc()).limit(top_k)

    rows = session.execute(stmt).all()

    matches: list[ChunkMatch] = []
    for chunk, similarity in rows:
        matches.append(
            ChunkMatch(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                token_count=chunk.token_count,
                similarity_score=round(float(similarity), 4),
            )
        )

    logger.info(
        "Retrieved %d chunks for company '%s' (query: '%s', top_k=%d, threshold=%.2f)",
        len(matches),
        clean_company_id,
        clean_query[:50],
        top_k,
        threshold,
    )
    return matches
