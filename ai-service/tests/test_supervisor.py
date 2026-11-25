"""Unit tests for LangGraph typed state and supervisor intent routing."""

from unittest.mock import patch

from app.agents.state import AgentState
from app.agents.supervisor import (
    MAX_SUPERVISOR_ITERATIONS,
    parse_supervisor_route,
    supervisor_node,
)


def test_parse_supervisor_route_valid_options():
    assert parse_supervisor_route("knowledge_agent") == "knowledge_agent"
    assert parse_supervisor_route("   KNOWLEDGE_AGENT  \n") == "knowledge_agent"
    assert parse_supervisor_route("office_agent") == "office_agent"
    assert parse_supervisor_route("Draft office memo") == "office_agent"
    assert parse_supervisor_route("FINISH") == "FINISH"
    assert parse_supervisor_route("finish.") == "FINISH"


def test_parse_supervisor_route_fallback_default():
    # If model outputs unexpected tokens, safely fallback to knowledge_agent
    assert parse_supervisor_route("random gibberish output") == "knowledge_agent"
    assert parse_supervisor_route("") == "knowledge_agent"


def test_supervisor_greeting_fast_path():
    state: AgentState = {
        "company_id": "company_test_123",
        "query": "Hello there",
        "iteration_count": 0,
        "agent_path": [],
    }

    result = supervisor_node(state)

    assert result["route"] == "FINISH"
    assert result["current_agent"] == "supervisor"
    assert result["iteration_count"] == 1
    assert "supervisor" in result["agent_path"]
    assert "WorkMesh AI Assistant" in result["final_response"]


def test_supervisor_empty_query_fast_path():
    state: AgentState = {
        "company_id": "company_test_123",
        "query": "",
        "iteration_count": 0,
        "agent_path": [],
    }

    result = supervisor_node(state)

    assert result["route"] == "FINISH"
    assert result["iteration_count"] == 1
    assert "How can I assist you" in result["final_response"]


def test_supervisor_routes_to_knowledge_agent():
    state: AgentState = {
        "company_id": "company_test_123",
        "query": "What is our company annual leave and vacation policy?",
        "iteration_count": 0,
        "agent_path": [],
    }

    with patch(
        "app.agents.supervisor.call_gemini_api",
        return_value="knowledge_agent",
    ) as mock_llm:
        result = supervisor_node(state)

        mock_llm.assert_called_once()
        assert result["route"] == "knowledge_agent"
        assert result["current_agent"] == "supervisor"
        assert result["iteration_count"] == 1
        assert result["agent_path"] == ["supervisor"]


def test_supervisor_routes_to_office_agent():
    state: AgentState = {
        "company_id": "company_test_123",
        "query": "Draft an internal team announcement about the new office opening.",
        "iteration_count": 0,
        "agent_path": [],
    }

    with patch(
        "app.agents.supervisor.call_gemini_api",
        return_value="office_agent",
    ) as mock_llm:
        result = supervisor_node(state)

        mock_llm.assert_called_once()
        assert result["route"] == "office_agent"
        assert result["current_agent"] == "supervisor"
        assert result["iteration_count"] == 1
        assert result["agent_path"] == ["supervisor"]


def test_supervisor_max_iteration_cycle_guardrail():
    # If iteration count has reached MAX_SUPERVISOR_ITERATIONS, prevent infinite loop
    state: AgentState = {
        "company_id": "company_test_123",
        "query": "Recursive complex task",
        "iteration_count": MAX_SUPERVISOR_ITERATIONS,
        "agent_path": ["supervisor", "knowledge_agent", "supervisor"],
    }

    result = supervisor_node(state)

    assert result["route"] == "FINISH"
    assert result["current_agent"] == "supervisor"
    assert result["iteration_count"] == MAX_SUPERVISOR_ITERATIONS + 1
    assert "maximum allowable steps" in result["final_response"]


def test_supervisor_finishes_when_final_response_already_present():
    state: AgentState = {
        "company_id": "company_test_123",
        "query": "What is the policy?",
        "iteration_count": 1,
        "final_response": "The policy permits 20 days vacation.",
        "agent_path": ["supervisor", "knowledge_agent"],
    }

    result = supervisor_node(state)

    assert result["route"] == "FINISH"
    assert result["current_agent"] == "supervisor"
    assert result["iteration_count"] == 2
    assert result["agent_path"] == ["supervisor", "knowledge_agent", "supervisor"]


def test_supervisor_handles_llm_exception_gracefully():
    state: AgentState = {
        "company_id": "company_test_123",
        "query": "How do travel expense approvals work?",
        "iteration_count": 0,
        "agent_path": [],
    }

    with patch(
        "app.agents.supervisor.call_gemini_api",
        side_effect=RuntimeError("Gemini API connection error"),
    ):
        result = supervisor_node(state)

        # Fallback to knowledge_agent
        assert result["route"] == "knowledge_agent"
        assert result["iteration_count"] == 1
