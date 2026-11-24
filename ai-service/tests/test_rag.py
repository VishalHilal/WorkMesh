from unittest.mock import MagicMock, patch

from app.schemas.retrieve import ChunkMatch
from app.services.rag import (
    build_citations,
    build_user_prompt,
    run_rag_pipeline,
)


def test_build_user_prompt():
    chunks = [
        ChunkMatch(
            chunk_id="chunk-1",
            document_id="doc-101",
            chunk_index=0,
            content="Employees get 15 days PTO.",
            token_count=6,
            similarity_score=0.88,
        )
    ]
    prompt = build_user_prompt("What is the PTO policy?", chunks)
    assert "Context Chunks from Company Documentation:" in prompt
    assert "[ID: chunk-1]" in prompt
    assert "Employees get 15 days PTO." in prompt
    assert "Employee Question: What is the PTO policy?" in prompt


def test_build_citations():
    chunks = [
        ChunkMatch(
            chunk_id="chunk-1",
            document_id="doc-101",
            chunk_index=0,
            content="A very long policy content excerpt that explains remote work rules.",
            token_count=12,
            similarity_score=0.92,
        )
    ]
    citations = build_citations(chunks, "Some answer text")
    assert len(citations) == 1
    assert citations[0].chunk_id == "chunk-1"
    assert citations[0].document_id == "doc-101"
    assert citations[0].similarity_score == 0.92


def test_run_rag_pipeline_anti_hallucination_when_no_chunks():
    mock_session = MagicMock()

    with patch("app.services.rag.retrieve_relevant_chunks", return_value=[]):
        chat_data = run_rag_pipeline(
            session=mock_session,
            company_id="company_test",
            query="What is the non-existent policy?",
        )

        assert chat_data.grounded is False
        assert chat_data.citations == []
        assert "could not find any relevant information" in chat_data.answer


def test_run_rag_pipeline_with_grounded_answer():
    mock_session = MagicMock()
    mock_chunks = [
        ChunkMatch(
            chunk_id="chunk-xyz",
            document_id="doc-abc",
            chunk_index=0,
            content="Full-time employees receive health insurance benefits.",
            token_count=8,
            similarity_score=0.89,
        )
    ]

    with (
        patch("app.services.rag.retrieve_relevant_chunks", return_value=mock_chunks),
        patch(
            "app.services.rag.call_gemini_api",
            return_value="Health insurance is provided [Source: chunk-xyz].",
        ),
    ):
        chat_data = run_rag_pipeline(
            session=mock_session,
            company_id="company_test",
            query="Do we get health insurance?",
        )

        assert chat_data.grounded is True
        assert len(chat_data.citations) == 1
        assert chat_data.citations[0].chunk_id == "chunk-xyz"
        assert "Health insurance is provided" in chat_data.answer
