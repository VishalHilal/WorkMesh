"""alter document_chunks embedding to 768 dimensions for gemini-embedding-2

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-25 10:00:00.000000

"""

from collections.abc import Sequence

from pgvector.sqlalchemy import Vector

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop existing HNSW index tied to 384 dimensions
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding")

    # Alter column type to vector(768)
    op.alter_column(
        "document_chunks",
        "embedding",
        type_=Vector(768),
        postgresql_using="embedding::vector(768)",
    )

    # Recreate HNSW index for 768 dimensions
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding")

    op.alter_column(
        "document_chunks",
        "embedding",
        type_=Vector(384),
        postgresql_using="embedding::vector(384)",
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops)"
    )
