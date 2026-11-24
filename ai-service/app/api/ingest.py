import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_engine
from app.models.chunk import DocumentChunk
from app.schemas.ingest import IngestData, IngestRequest, IngestResponse
from app.services.chunker import chunk_text
from app.services.embeddings import generate_embeddings
from app.services.parser import parse_document
from app.services.storage import download_object

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ingestion"])


@router.post(
    "/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_200_OK,
    summary="Ingest a document from object storage, chunk, embed, and index in pgvector",
)
def ingest_document(payload: IngestRequest) -> IngestResponse:
    engine = get_engine()

    # 1. Transition document status to PROCESSING
    try:
        with Session(engine) as session:
            session.execute(
                text('UPDATE documents SET status = \'PROCESSING\', "updatedAt" = NOW() WHERE id = :id'),
                {"id": payload.document_id},
            )
            session.commit()
    except Exception as err:  # noqa: BLE001
        logger.warning(f"Could not update document status to PROCESSING: {err}")

    try:
        # 2. Download raw document bytes from storage
        content_bytes = download_object(payload.storage_key)

        # 3. Extract text from document
        extracted_text = parse_document(payload.file_name, content_bytes)

        # 4. Chunk text into semantic passages
        chunks = chunk_text(extracted_text)

        if not chunks:
            # Handle empty documents gracefully
            with Session(engine) as session:
                session.execute(
                    text('UPDATE documents SET status = \'READY\', "chunkCount" = 0, "updatedAt" = NOW() WHERE id = :id'),
                    {"id": payload.document_id},
                )
                session.commit()

            return IngestResponse(
                data=IngestData(
                    document_id=payload.document_id,
                    company_id=payload.company_id,
                    chunk_count=0,
                    status="READY",
                ),
                meta={"timestamp": datetime.now(UTC).isoformat()},
            )

        # 5. Compute vector embeddings
        texts = [c["content"] for c in chunks]
        embeddings = generate_embeddings(texts)

        # 6. Bulk insert chunks into PostgreSQL with pgvector within a single transaction
        with Session(engine) as session:
            # Remove existing chunks for this document (ensures idempotency on re-ingestion)
            session.query(DocumentChunk).filter(DocumentChunk.document_id == payload.document_id).delete()

            for chunk_data, emb in zip(chunks, embeddings, strict=True):
                chunk_record = DocumentChunk(
                    document_id=payload.document_id,
                    company_id=payload.company_id,
                    chunk_index=chunk_data["chunk_index"],
                    content=chunk_data["content"],
                    token_count=chunk_data["token_count"],
                    embedding=emb,
                )
                session.add(chunk_record)

            # 7. Update document status in documents table to READY
            session.execute(
                text(
                    'UPDATE documents SET status = \'READY\', "chunkCount" = :count, "updatedAt" = NOW() WHERE id = :id'
                ),
                {"count": len(chunks), "id": payload.document_id},
            )
            session.commit()

        logger.info(
            f"Successfully ingested document {payload.document_id} ({len(chunks)} chunks embedded)"
        )

        return IngestResponse(
            data=IngestData(
                document_id=payload.document_id,
                company_id=payload.company_id,
                chunk_count=len(chunks),
                status="READY",
            ),
            meta={"timestamp": datetime.now(UTC).isoformat()},
        )

    except Exception as err:
        logger.exception(f"Ingestion failed for document {payload.document_id}")

        # Mark document as FAILED in database
        try:
            with Session(engine) as session:
                session.execute(
                    text(
                        'UPDATE documents SET status = \'FAILED\', "errorMessage" = :err, "updatedAt" = NOW() WHERE id = :id'
                    ),
                    {"err": str(err)[:500], "id": payload.document_id},
                )
                session.commit()
        except Exception as db_err:  # noqa: BLE001
            logger.error(f"Could not record FAILED status for document: {db_err}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document ingestion failed: {err}",
        ) from err
