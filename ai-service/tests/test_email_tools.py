"""Unit tests for MCP email tool schemas and human-in-the-loop approval state machine.

Covers Issue #63 — Phase 9 MCP Email Tools & Human Approval Workflows.
"""

from __future__ import annotations

import re

import pytest
from pydantic import ValidationError

from app.agents.nodes.human_approval import human_approval_node
from app.agents.state import AgentState
from app.mcp.email_tools import (
    MCP_EMAIL_TOOLS,
    EmailDraftInput,
    EmailReadInput,
    EmailSendInput,
)

# ---------------------------------------------------------------------------
# EmailDraftInput validation
# ---------------------------------------------------------------------------


class TestEmailDraftInput:
    def test_valid_minimal_input(self) -> None:
        """Accept a valid draft with only required fields."""
        draft = EmailDraftInput(to="alice@workmesh.com", subject="Hello", body="Hi there")
        assert draft.to == "alice@workmesh.com"
        assert draft.cc == []

    def test_valid_input_with_cc(self) -> None:
        """Accept a valid draft with optional CC list."""
        draft = EmailDraftInput(
            to="alice@workmesh.com",
            subject="Budget Review",
            body="Please find attached.",
            cc=["bob@workmesh.com", "carol@workmesh.com"],
        )
        assert len(draft.cc) == 2

    def test_missing_to_raises(self) -> None:
        """Raise ValidationError when 'to' is omitted."""
        with pytest.raises(ValidationError):
            EmailDraftInput(subject="Hi", body="Body")  # type: ignore[call-arg]

    def test_missing_subject_raises(self) -> None:
        """Raise ValidationError when 'subject' is omitted."""
        with pytest.raises(ValidationError):
            EmailDraftInput(to="alice@workmesh.com", body="Body")  # type: ignore[call-arg]

    def test_empty_subject_raises(self) -> None:
        """Raise ValidationError when subject is whitespace-only."""
        with pytest.raises(ValidationError, match="empty or whitespace"):
            EmailDraftInput(to="alice@workmesh.com", subject="   ", body="Body")

    def test_empty_body_raises(self) -> None:
        """Raise ValidationError when body is whitespace-only."""
        with pytest.raises(ValidationError, match="empty or whitespace"):
            EmailDraftInput(to="alice@workmesh.com", subject="Hi", body="\t\n")

    def test_invalid_to_email_raises(self) -> None:
        """Raise ValidationError for a malformed email address in 'to'."""
        with pytest.raises(ValidationError, match="not a valid email"):
            EmailDraftInput(to="not-an-email", subject="Hi", body="Body")

    def test_invalid_cc_email_raises(self) -> None:
        """Raise ValidationError for malformed email in CC list."""
        with pytest.raises(ValidationError, match="not a valid email"):
            EmailDraftInput(
                to="alice@workmesh.com",
                subject="Hi",
                body="Body",
                cc=["bad-email"],
            )


# ---------------------------------------------------------------------------
# EmailSendInput validation
# ---------------------------------------------------------------------------


class TestEmailSendInput:
    VALID_TOKEN = "550e8400-e29b-41d4-a716-446655440000"

    def test_valid_uuid4_token(self) -> None:
        """Accept a valid UUID4 approval token."""
        payload = EmailSendInput(approval_token=self.VALID_TOKEN)
        assert payload.approval_token == self.VALID_TOKEN

    def test_invalid_token_format_raises(self) -> None:
        """Raise ValidationError for a non-UUID4 token."""
        with pytest.raises(ValidationError, match="UUID4"):
            EmailSendInput(approval_token="not-a-uuid")

    def test_missing_token_raises(self) -> None:
        """Raise ValidationError when approval_token is omitted."""
        with pytest.raises(ValidationError):
            EmailSendInput()  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# EmailReadInput validation
# ---------------------------------------------------------------------------


class TestEmailReadInput:
    def test_defaults(self) -> None:
        """Default limit=10 and unread_only=False."""
        payload = EmailReadInput()
        assert payload.limit == 10
        assert payload.unread_only is False

    def test_custom_values(self) -> None:
        """Accept custom limit and unread_only."""
        payload = EmailReadInput(limit=25, unread_only=True)
        assert payload.limit == 25
        assert payload.unread_only is True

    def test_limit_exceeds_max_raises(self) -> None:
        """Raise ValidationError when limit > 50."""
        with pytest.raises(ValidationError):
            EmailReadInput(limit=51)

    def test_limit_below_min_raises(self) -> None:
        """Raise ValidationError when limit < 1."""
        with pytest.raises(ValidationError):
            EmailReadInput(limit=0)


# ---------------------------------------------------------------------------
# MCP_EMAIL_TOOLS registry
# ---------------------------------------------------------------------------


class TestMcpEmailToolsRegistry:
    def test_registry_contains_all_three_tools(self) -> None:
        """MCP_EMAIL_TOOLS registry exposes email_draft, email_send, email_read."""
        assert "email_draft" in MCP_EMAIL_TOOLS
        assert "email_send" in MCP_EMAIL_TOOLS
        assert "email_read" in MCP_EMAIL_TOOLS

    def test_registry_input_output_models(self) -> None:
        """Each tool entry has input and output model classes."""
        for tool_name, models in MCP_EMAIL_TOOLS.items():
            assert "input" in models, f"{tool_name} missing 'input' model"
            assert "output" in models, f"{tool_name} missing 'output' model"


# ---------------------------------------------------------------------------
# HumanApprovalState defaults
# ---------------------------------------------------------------------------


class TestHumanApprovalStateDefaults:
    def test_fresh_state_has_no_approval_fields(self) -> None:
        """A new AgentState without approval fields has falsy defaults."""
        state: AgentState = {
            "company_id": "test-co",
            "query": "send email",
            "messages": [],
            "agent_path": [],
            "citations": [],
            "iteration_count": 0,
        }
        assert state.get("pending_approval") is None
        assert state.get("approval_token") is None
        assert state.get("approved") is None
        assert state.get("rejected") is None
        assert state.get("draft_payload") is None


# ---------------------------------------------------------------------------
# human_approval_node
# ---------------------------------------------------------------------------

UUID4_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


class TestHumanApprovalNode:
    def _base_state(self, draft: dict | None = None) -> AgentState:
        return {
            "company_id": "acme",
            "query": "send a leave email",
            "messages": [],
            "agent_path": ["supervisor", "office_agent"],
            "citations": [],
            "iteration_count": 1,
            "draft_payload": draft,
        }

    def test_sets_pending_approval_true(self) -> None:
        """Node sets pending_approval=True in returned dict."""
        result = human_approval_node(self._base_state())
        assert result["pending_approval"] is True

    def test_generates_uuid4_token(self) -> None:
        """Node generates a valid UUID4 approval_token."""
        result = human_approval_node(self._base_state())
        assert UUID4_PATTERN.match(result["approval_token"]), (
            f"Token '{result['approval_token']}' is not a valid UUID4"
        )

    def test_generates_unique_tokens(self) -> None:
        """Two consecutive calls produce different approval tokens."""
        state = self._base_state()
        token_a = human_approval_node(state)["approval_token"]
        token_b = human_approval_node(state)["approval_token"]
        assert token_a != token_b

    def test_approved_and_rejected_default_false(self) -> None:
        """Node initialises approved=False and rejected=False."""
        result = human_approval_node(self._base_state())
        assert result["approved"] is False
        assert result["rejected"] is False

    def test_preserves_draft_payload(self) -> None:
        """Node preserves the draft_payload passed in state."""
        draft = {"to": "hr@workmesh.com", "subject": "Leave", "body": "I need 2 days off."}
        result = human_approval_node(self._base_state(draft=draft))
        assert result["draft_payload"] == draft

    def test_handles_missing_draft_payload_gracefully(self) -> None:
        """Node handles None draft_payload without raising."""
        result = human_approval_node(self._base_state(draft=None))
        assert result["draft_payload"] == {}

    def test_logs_approval_token(self, caplog: pytest.LogCaptureFixture) -> None:
        """Node logs the approval token at INFO level."""
        import logging

        with caplog.at_level(logging.INFO, logger="app.agents.nodes.human_approval"):
            result = human_approval_node(self._base_state())
        assert result["approval_token"] in caplog.text


# ---------------------------------------------------------------------------
# graph routing — office_agent → human_approval when draft_payload present
# ---------------------------------------------------------------------------


class TestGraphRoutesOfficeAgentToApproval:
    def test_route_office_agent_with_draft_payload(self) -> None:
        """route_office_agent returns 'human_approval' when draft_payload is set."""
        from app.agents.graph import route_office_agent

        state: AgentState = {
            "company_id": "acme",
            "query": "email HR",
            "messages": [],
            "agent_path": [],
            "citations": [],
            "iteration_count": 1,
            "draft_payload": {"to": "hr@workmesh.com", "subject": "Leave", "body": "..."},
        }
        assert route_office_agent(state) == "human_approval"

    def test_route_office_agent_without_draft_payload(self) -> None:
        """route_office_agent returns END when draft_payload is absent."""
        from langgraph.graph import END

        from app.agents.graph import route_office_agent

        state: AgentState = {
            "company_id": "acme",
            "query": "summarise action items",
            "messages": [],
            "agent_path": [],
            "citations": [],
            "iteration_count": 1,
        }
        assert route_office_agent(state) == END

    def test_compiled_graph_includes_human_approval_node(self) -> None:
        """The compiled graph has a 'human_approval' node registered."""
        from app.agents.graph import compiled_agent_graph

        node_names = set(compiled_agent_graph.nodes.keys())
        assert "human_approval" in node_names
