"""Unit tests for golden RAG evaluation dataset and LLM-as-a-judge scoring.

Covers Issue #91 — Phase 15 AI Observability, Guardrails & Evaluation.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

from app.services.evaluator import (
    compute_citation_recall,
    evaluate_dataset,
    judge_rag_response,
)


def test_citation_recall_exact_and_partial() -> None:
    """compute_citation_recall handles exact, partial, empty, and zero matches."""
    assert compute_citation_recall(["c1", "c2"], ["c1", "c2", "c3"]) == 1.0
    assert compute_citation_recall(["c1", "c2"], ["c1"]) == 0.5
    assert compute_citation_recall(["c1"], ["c9"]) == 0.0
    assert compute_citation_recall([], ["c1"]) == 1.0


def test_judge_rag_response_parses_structured_scores() -> None:
    """judge_rag_response parses JSON faithfulness, relevance, and reasoning."""
    mock_json = (
        '```json\n'
        '{"faithfulness": 0.95, "relevance": 0.9, "reasoning": "Grounded in context."}\n'
        '```'
    )
    with patch("app.services.evaluator.call_gemini_api", return_value=mock_json):
        scores = judge_rag_response(
            question="How many sick days?",
            context="12 paid sick days.",
            answer="You receive 12 paid sick days.",
            expected_answer="12 paid sick days.",
        )

    assert scores.faithfulness == 0.95
    assert scores.relevance == 0.9
    assert scores.reasoning == "Grounded in context."


def test_judge_rag_response_handles_malformed_json_gracefully() -> None:
    """judge_rag_response returns safe zero fallback on invalid JSON output."""
    with patch("app.services.evaluator.call_gemini_api", return_value="not valid json"):
        scores = judge_rag_response(
            question="q",
            context="c",
            answer="a",
            expected_answer="e",
        )

    assert scores.faithfulness == 0.0
    assert scores.relevance == 0.0
    assert "Failed to parse" in scores.reasoning


def test_evaluate_dataset_aggregates_golden_fixtures() -> None:
    """evaluate_dataset loads golden JSON fixtures and computes aggregate means."""
    fixture_path = (
        Path(__file__).resolve().parent / "fixtures" / "rag_eval_dataset.json"
    )
    cases = json.loads(fixture_path.read_text(encoding="utf-8"))
    assert len(cases) >= 5

    def fake_runner(case: dict) -> tuple[str, list[str]]:
        return case["expected_answer"], list(case["expected_chunk_ids"])

    judge_json = '{"faithfulness": 0.9, "relevance": 0.85, "reasoning": "Accurate."}'
    with patch("app.services.evaluator.call_gemini_api", return_value=judge_json):
        summary = evaluate_dataset(cases, fake_runner, min_threshold=0.7)

    assert summary.total_cases == len(cases)
    assert summary.mean_faithfulness == 0.9
    assert summary.mean_relevance == 0.85
    assert summary.mean_citation_recall == 1.0
    assert summary.passed is True
