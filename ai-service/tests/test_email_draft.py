"""Unit and endpoint tests for email draft generation and Office Agent draft payloads.

Covers Issue #64 — Phase 9 MCP Email Tools & Human Approval Workflows.
"""

from __future__ import annotations

import re
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.agents.office_agent import generate_email_draft_payload, office_agent_node
from app.agents.state import AgentState
from app.core.config import settings
from app.main import app

client = TestClient(app)
VALID_HEADERS = {"X-Internal-Key": settings.internal_api_key}
UUID4_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def test_draft_endpoint_generates_structured_draft() -> None:
    """POST /api/v1/agents/email/draft returns UUID4 approval_token and structured draft."""
    mock_json = (
        '{"to": "hr@workmesh.com", "subject": "Sick Leave Request", '
        '"body": "Hi HR, I need to take sick leave tomorrow.", "cc": ["manager@workmesh.com"]}'
    )

    with patch("app.agents.office_agent.call_gemini_api", return_value=mock_json):
        res = client.post(
            "/api/v1/agents/email/draft",
            json={"company_id": "company_abc", "instruction": "Email HR about sick leave"},
            headers=VALID_HEADERS,
        )

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert UUID4_PATTERN.match(body["data"]["approval_token"])
    assert body["data"]["draft"]["to"] == "hr@workmesh.com"
    assert body["data"]["draft"]["subject"] == "Sick Leave Request"
    assert body["data"]["draft"]["cc"] == ["manager@workmesh.com"]


def test_draft_endpoint_requires_instruction_field() -> None:
    """POST /api/v1/agents/email/draft returns 422 when instruction is missing."""
    res = client.post(
        "/api/v1/agents/email/draft",
        json={"company_id": "company_abc"},
        headers=VALID_HEADERS,
    )
    assert res.status_code == 422


def test_draft_endpoint_requires_internal_key() -> None:
    """POST /api/v1/agents/email/draft rejects requests without valid X-Internal-Key."""
    res = client.post(
        "/api/v1/agents/email/draft",
        json={"company_id": "company_abc", "instruction": "Email HR"},
    )
    assert res.status_code == 401


def test_office_agent_emits_draft_payload_on_email_intent() -> None:
    """office_agent_node emits structured draft_payload when query has email intent."""
    state: AgentState = {
        "company_id": "company_abc",
        "query": "Draft an email to finance@workmesh.com about Q4 expenses",
        "agent_path": ["supervisor"],
        "messages": [],
    }
    mock_json = (
        '```json\n'
        '{"to": "finance@workmesh.com", "subject": "Q4 Expense Report", '
        '"body": "Please find the Q4 expense summary.", "cc": []}\n'
        '```'
    )

    with patch("app.agents.office_agent.call_gemini_api", return_value=mock_json):
        result = office_agent_node(state)

    assert result["current_agent"] == "office_agent"
    assert result["draft_payload"] is not None
    assert result["draft_payload"]["to"] == "finance@workmesh.com"
    assert result["draft_payload"]["subject"] == "Q4 Expense Report"
    assert "Safe Execution Notice" in result["final_response"]


def test_generate_email_draft_payload_falls_back_on_plain_text() -> None:
    """generate_email_draft_payload returns a safe dict if model returns non-JSON prose."""
    with patch(
        "app.agents.office_agent.call_gemini_api",
        return_value="Dear Team, please note the updated schedule.",
    ):
        draft = generate_email_draft_payload(
            instruction="Notify team about schedule",
            context="Effective Monday",
        )

    assert draft["to"] == "team@workmesh.com"
    assert "Notify team about schedule" in draft["subject"]
    assert "Dear Team" in draft["body"]
    assert draft["cc"] == []
