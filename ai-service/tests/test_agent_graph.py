"""Unit and integration tests for LangGraph multi-agent orchestration and API endpoint."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.agents.graph import create_agent_graph, run_agent_workflow
from app.agents.knowledge_agent import knowledge_agent_node
from app.agents.office_agent import office_agent_node
from app.agents.state import AgentState
from app.core.config import settings
from app.main import app
from app.schemas.chat import ChatData, Citation

client = TestClient(app)
VALID_INTERNAL_HEADERS = {"X-Internal-Key": settings.internal_api_key}


# -----------------------------------------------------------------------------
# Node-level tests
# -----------------------------------------------------------------------------


def test_knowledge_agent_node_success():
    state: AgentState = {
        "company_id": "company_test_abc",
        "query": "What is our health insurance coverage?",
        "agent_path": ["supervisor"],
        "messages": [],
    }

    mock_chat_data = ChatData(
        query="What is our health insurance coverage?",
        answer="WorkMesh covers comprehensive health and dental [Source: chunk-ins-1].",
        citations=[
            Citation(
                chunk_id="chunk-ins-1",
                document_id="doc-ins-99",
                chunk_index=0,
                snippet="Health coverage includes comprehensive medical...",
                similarity_score=0.92,
            )
        ],
        model="gemini-3.8-flash",
        grounded=True,
    )

    with (
        patch("app.agents.knowledge_agent.get_engine"),
        patch("app.agents.knowledge_agent.Session"),
        patch(
            "app.agents.knowledge_agent.run_rag_pipeline", return_value=mock_chat_data
        ),
    ):
        result = knowledge_agent_node(state)

        assert result["current_agent"] == "knowledge_agent"
        assert result["route"] == "FINISH"
        assert "WorkMesh covers comprehensive health" in result["final_response"]
        assert len(result["citations"]) == 1
        assert result["citations"][0]["chunk_id"] == "chunk-ins-1"
        assert result["agent_path"] == ["supervisor", "knowledge_agent"]


def test_knowledge_agent_node_anti_hallucination_zero_chunks():
    state: AgentState = {
        "company_id": "company_test_abc",
        "query": "What is the policy for spaceship travel?",
        "agent_path": ["supervisor"],
    }

    mock_chat_data = ChatData(
        query="What is the policy for spaceship travel?",
        answer="I could not find any relevant information in your company's uploaded documents.",
        citations=[],
        model="gemini-3.8-flash",
        grounded=False,
    )

    with (
        patch("app.agents.knowledge_agent.get_engine"),
        patch("app.agents.knowledge_agent.Session"),
        patch(
            "app.agents.knowledge_agent.run_rag_pipeline", return_value=mock_chat_data
        ),
    ):
        result = knowledge_agent_node(state)

        assert result["current_agent"] == "knowledge_agent"
        assert "could not find any relevant information" in result["final_response"]
        assert result["citations"] == []


def test_office_agent_node_success():
    state: AgentState = {
        "company_id": "company_test_abc",
        "query": "Draft an announcement about the upcoming product launch next Monday.",
        "agent_path": ["supervisor"],
    }

    mock_draft = (
        "### Subject: Upcoming WorkMesh AI Product Launch\n\n"
        "Team, we are excited to announce our launch next Monday.\n\n"
        "> ⚠️ **WorkMesh Safe Execution Notice**: This is a generated draft."
    )

    with patch("app.agents.office_agent.call_gemini_api", return_value=mock_draft):
        result = office_agent_node(state)

        assert result["current_agent"] == "office_agent"
        assert result["route"] == "FINISH"
        assert "Upcoming WorkMesh AI Product Launch" in result["final_response"]
        assert "Safe Execution Notice" in result["final_response"]
        assert result["citations"] == []
        assert result["agent_path"] == ["supervisor", "office_agent"]


# -----------------------------------------------------------------------------
# Graph compilation & End-to-end traversal tests
# -----------------------------------------------------------------------------


def test_graph_compilation():
    graph = create_agent_graph()
    assert graph is not None


def test_end_to_end_knowledge_routing():
    mock_chat_data = ChatData(
        query="Explain our annual leave policy",
        answer="Full-time employees receive 20 days annual leave [Source: leave-1].",
        citations=[
            Citation(
                chunk_id="leave-1",
                document_id="doc-leave",
                chunk_index=0,
                snippet="Full-time employees receive 20 days of paid annual leave.",
                similarity_score=0.89,
            )
        ],
        model="gemini-3.8-flash",
        grounded=True,
    )

    with (
        patch(
            "app.agents.supervisor.call_gemini_api",
            return_value='{"route": "knowledge_agent", "reasoning": "User asking about leave policy"}',
        ),
        patch("app.agents.knowledge_agent.get_engine"),
        patch("app.agents.knowledge_agent.Session"),
        patch(
            "app.agents.knowledge_agent.run_rag_pipeline", return_value=mock_chat_data
        ),
    ):
        result = run_agent_workflow(
            company_id="company_test_abc",
            query="Explain our annual leave policy",
        )

        assert result["agent_handled"] == "knowledge_agent"
        assert result["agent_path"] == ["supervisor", "knowledge_agent"]
        assert "20 days annual leave" in result["answer"]
        assert len(result["citations"]) == 1
        assert result["citations"][0]["chunk_id"] == "leave-1"
        assert result["iterations"] == 1


def test_end_to_end_office_routing():
    mock_draft = (
        "### Subject: Q4 Planning Meeting Agenda\n\n"
        "- [ ] Review Q3 KPIs\n"
        "- [ ] Align Q4 Roadmap\n\n"
        "> ⚠️ **WorkMesh Safe Execution Notice**: This is a generated draft."
    )

    with (
        patch(
            "app.agents.supervisor.call_gemini_api",
            return_value='{"route": "office_agent", "reasoning": "User requests agenda draft"}',
        ),
        patch("app.agents.office_agent.call_gemini_api", return_value=mock_draft),
    ):
        result = run_agent_workflow(
            company_id="company_test_abc",
            query="Draft an agenda for our Q4 planning meeting",
        )

        assert result["agent_handled"] == "office_agent"
        assert result["agent_path"] == ["supervisor", "office_agent"]
        assert "Q4 Planning Meeting Agenda" in result["answer"]
        assert result["citations"] == []
        assert result["iterations"] == 1


def test_end_to_end_greeting_fast_path():
    result = run_agent_workflow(
        company_id="company_test_abc",
        query="Hello! Good morning",
    )

    assert result["agent_handled"] == "supervisor"
    assert result["agent_path"] == ["supervisor"]
    assert "WorkMesh AI Assistant" in result["answer"]
    assert result["citations"] == []


# -----------------------------------------------------------------------------
# REST API endpoint tests (/api/v1/agents/run)
# -----------------------------------------------------------------------------


def test_api_agents_run_unauthorized_missing_header():
    payload = {
        "company_id": "company_test_abc",
        "query": "Tell me about paternity leave",
    }
    response = client.post("/api/v1/agents/run", json=payload)
    assert response.status_code == 401
    assert "Invalid or missing X-Internal-Key" in response.json()["detail"]


def test_api_agents_run_unauthorized_invalid_header():
    payload = {
        "company_id": "company_test_abc",
        "query": "Tell me about paternity leave",
    }
    response = client.post(
        "/api/v1/agents/run",
        json=payload,
        headers={"X-Internal-Key": "wrong-secret-key"},
    )
    assert response.status_code == 401
    assert "Invalid or missing X-Internal-Key" in response.json()["detail"]


def test_api_agents_run_authorized_success():
    payload = {
        "company_id": "company_test_abc",
        "query": "Hi there",
    }
    response = client.post(
        "/api/v1/agents/run",
        json=payload,
        headers=VALID_INTERNAL_HEADERS,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["agent_handled"] == "supervisor"
    assert body["data"]["agent_path"] == ["supervisor"]
    assert "WorkMesh AI Assistant" in body["data"]["answer"]
    assert body["data"]["iterations"] >= 1
