from unittest.mock import MagicMock, patch

from app.models.chunk import DocumentChunk
from app.services.retriever import retrieve_relevant_chunks


def test_retrieve_relevant_chunks_success():
    mock_session = MagicMock()

    chunk1 = DocumentChunk(
        id="chunk_1",
        document_id="doc_1",
        company_id="company_test",
        chunk_index=0,
        content="Leave policy: Employees receive 20 days paid vacation.",
        token_count=10,
        embedding=[0.1] * 768,
    )
    chunk2 = DocumentChunk(
        id="chunk_2",
        document_id="doc_1",
        company_id="company_test",
        chunk_index=1,
        content="Sick leave: Up to 10 days annual sick leave.",
        token_count=10,
        embedding=[0.2] * 768,
    )

    # session.execute().all() returns tuples of (DocumentChunk, similarity)
    mock_session.execute.return_value.all.return_value = [
        (chunk1, 0.89123),
        (chunk2, 0.75432),
    ]

    with patch(
        "app.services.retriever.generate_embeddings",
        return_value=[[0.05] * 768],
    ):
        matches = retrieve_relevant_chunks(
            session=mock_session,
            company_id="company_test",
            query="vacation days",
            top_k=5,
            threshold=0.3,
        )

    assert len(matches) == 2
    assert matches[0].chunk_id == "chunk_1"
    assert matches[0].similarity_score == 0.8912
    assert (
        matches[0].content == "Leave policy: Employees receive 20 days paid vacation."
    )
    assert matches[1].chunk_id == "chunk_2"
    assert matches[1].similarity_score == 0.7543


def test_retrieve_relevant_chunks_empty_inputs():
    mock_session = MagicMock()

    assert retrieve_relevant_chunks(mock_session, "", "query") == []
    assert retrieve_relevant_chunks(mock_session, "company_1", "") == []
    assert retrieve_relevant_chunks(mock_session, "   ", "   ") == []
    mock_session.execute.assert_not_called()


def test_retrieve_relevant_chunks_with_document_ids():
    mock_session = MagicMock()
    mock_session.execute.return_value.all.return_value = []

    with patch(
        "app.services.retriever.generate_embeddings",
        return_value=[[0.1] * 768],
    ):
        matches = retrieve_relevant_chunks(
            session=mock_session,
            company_id="company_test",
            query="test",
            top_k=3,
            threshold=0.5,
            document_ids=["doc_100", "doc_200"],
        )

    assert matches == []
    assert mock_session.execute.called
