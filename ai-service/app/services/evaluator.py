"""Automated RAG evaluation pipeline using citation recall and Gemini LLM-as-a-judge."""

from __future__ import annotations

import json
import logging
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.llm import call_gemini_api

logger = logging.getLogger(__name__)

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)

JUDGE_SYSTEM_PROMPT = """You are an impartial RAG evaluation judge.
Score the candidate answer strictly between 0.0 and 1.0 on two metrics:
1. faithfulness: Are all factual claims in the answer directly supported by the provided context? (1.0 = fully grounded, 0.0 = hallucinated/contradicted)
2. relevance: Does the answer directly and accurately address the user question compared to the expected answer? (1.0 = complete & accurate, 0.0 = irrelevant)

Respond ONLY with valid JSON:
{"faithfulness": 0.0, "relevance": 0.0, "reasoning": "Brief 1-sentence explanation"}
"""


@dataclass(frozen=True)
class EvalScores:
    """Per-case evaluation metrics."""

    faithfulness: float
    relevance: float
    reasoning: str


@dataclass(frozen=True)
class EvalSummary:
    """Aggregate evaluation metrics across a dataset."""

    total_cases: int
    mean_faithfulness: float
    mean_relevance: float
    mean_citation_recall: float
    passed: bool


def compute_citation_recall(expected_ids: list[str], cited_ids: list[str]) -> float:
    """Compute fraction of expected chunk IDs present in cited_ids (0.0 to 1.0)."""
    if not expected_ids:
        return 1.0
    expected_set = set(expected_ids)
    cited_set = set(cited_ids)
    return round(len(expected_set & cited_set) / len(expected_set), 4)


def _clamp_score(value: Any) -> float:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return 0.0
    return round(max(0.0, min(1.0, num)), 4)


def judge_rag_response(
    question: str,
    context: str,
    answer: str,
    expected_answer: str,
) -> EvalScores:
    """Evaluate a RAG response using Gemini as an LLM-as-a-judge."""
    user_prompt = (
        f"Question: {question}\n\n"
        f"Retrieved Context:\n{context}\n\n"
        f"Expected Reference Answer:\n{expected_answer}\n\n"
        f"Candidate Answer:\n{answer}"
    )

    raw = call_gemini_api(
        system_prompt=JUDGE_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        chat_history=[],
    )

    candidate = raw.strip()
    match = _JSON_BLOCK_RE.search(candidate)
    if match:
        candidate = match.group(1).strip()

    try:
        parsed = json.loads(candidate)
        if not isinstance(parsed, dict):
            msg = "Judge output is not a JSON object"
            raise TypeError(msg)
        return EvalScores(
            faithfulness=_clamp_score(parsed.get("faithfulness")),
            relevance=_clamp_score(parsed.get("relevance")),
            reasoning=str(parsed.get("reasoning") or "").strip(),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to parse LLM judge output: %s", exc)
        return EvalScores(
            faithfulness=0.0,
            relevance=0.0,
            reasoning="Failed to parse structured judge response.",
        )


def evaluate_dataset(
    cases: list[dict[str, Any]],
    runner_fn: Callable[[dict[str, Any]], tuple[str, list[str]]],
    min_threshold: float = 0.7,
) -> EvalSummary:
    """Run evaluation over a list of golden cases and aggregate scores."""
    if not cases:
        return EvalSummary(
            total_cases=0,
            mean_faithfulness=0.0,
            mean_relevance=0.0,
            mean_citation_recall=0.0,
            passed=False,
        )

    faith_scores: list[float] = []
    rel_scores: list[float] = []
    recall_scores: list[float] = []

    for case in cases:
        answer, cited_ids = runner_fn(case)
        context_text = "\n".join(
            c.get("content", "") for c in case.get("context_chunks", [])
        )
        scores = judge_rag_response(
            question=case["question"],
            context=context_text,
            answer=answer,
            expected_answer=case["expected_answer"],
        )
        recall = compute_citation_recall(
            case.get("expected_chunk_ids", []),
            cited_ids,
        )
        faith_scores.append(scores.faithfulness)
        rel_scores.append(scores.relevance)
        recall_scores.append(recall)

    n = len(cases)
    mean_f = round(sum(faith_scores) / n, 4)
    mean_r = round(sum(rel_scores) / n, 4)
    mean_c = round(sum(recall_scores) / n, 4)
    passed = mean_f >= min_threshold and mean_r >= min_threshold

    return EvalSummary(
        total_cases=n,
        mean_faithfulness=mean_f,
        mean_relevance=mean_r,
        mean_citation_recall=mean_c,
        passed=passed,
    )


def _default_case_runner(case: dict[str, Any]) -> tuple[str, list[str]]:
    """Synthesize an answer from fixture context chunks using the production RAG prompt."""
    from app.schemas.retrieve import ChunkMatch
    from app.services.rag import SYSTEM_PROMPT, build_user_prompt

    chunks = [
        ChunkMatch(
            chunk_id=c["chunk_id"],
            document_id="eval-doc",
            chunk_index=idx,
            content=c["content"],
            similarity_score=0.95,
        )
        for idx, c in enumerate(case.get("context_chunks", []))
    ]
    prompt = build_user_prompt(case["question"], chunks)
    answer = call_gemini_api(system_prompt=SYSTEM_PROMPT, user_prompt=prompt)
    cited_ids = [c.chunk_id for c in chunks if c.chunk_id in answer]
    return answer, cited_ids


if __name__ == "__main__":
    dataset_path = (
        Path(__file__).resolve().parents[2]
        / "tests"
        / "fixtures"
        / "rag_eval_dataset.json"
    )
    golden_cases = json.loads(dataset_path.read_text(encoding="utf-8"))
    summary = evaluate_dataset(golden_cases, _default_case_runner)
    print(
        f"RAG Eval ({summary.total_cases} cases) | "
        f"Faithfulness={summary.mean_faithfulness:.2f} | "
        f"Relevance={summary.mean_relevance:.2f} | "
        f"CitationRecall={summary.mean_citation_recall:.2f} | "
        f"Passed={summary.passed}"
    )
    sys.exit(0 if summary.passed else 1)
