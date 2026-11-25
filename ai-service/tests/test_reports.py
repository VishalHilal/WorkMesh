"""Unit and API tests for AI report synthesis and DOCX/PDF generation.

Covers Issue #69 — Phase 10 Report Generation.
"""

from __future__ import annotations

import base64
import io
from unittest.mock import patch

from docx import Document as DocxDocument
from fastapi.testclient import TestClient
from pypdf import PdfReader

from app.core.config import settings
from app.main import app
from app.schemas.chat import ChatData, Citation

client = TestClient(app)
VALID_HEADERS = {"X-Internal-Key": settings.internal_api_key}

MOCK_CHAT_DATA = ChatData(
    query="Q4 Policy Summary",
    answer=(
        "## Executive Summary\n"
        "- Remote work is permitted up to 3 days per week [Source: chunk-1].\n"
        "- Expense reports must be submitted within 14 days.\n"
    ),
    citations=[
        Citation(
            chunk_id="chunk-1",
            document_id="doc-policy-1",
            chunk_index=0,
            snippet="Employees may work remotely up to 3 days per week with manager approval.",
            similarity_score=0.91,
        )
    ],
    model="gemini-3.8-flash",
    grounded=True,
)


def test_generate_pdf_report_returns_valid_pdf_bytes() -> None:
    """POST /api/v1/reports/generate returns valid base64 PDF readable by pypdf."""
    with (
        patch("app.api.reports.get_engine"),
        patch("app.api.reports.Session"),
        patch(
            "app.services.report_generator.run_rag_pipeline",
            return_value=MOCK_CHAT_DATA,
        ),
    ):
        res = client.post(
            "/api/v1/reports/generate",
            json={
                "company_id": "company_alpha",
                "title": "Q4 Policy Summary",
                "prompt": "Summarize remote work and expense rules",
                "format": "pdf",
                "template": "executive_summary",
            },
            headers=VALID_HEADERS,
        )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["format"] == "pdf"
    assert data["file_name"] == "q4-policy-summary.pdf"
    assert data["mime_type"] == "application/pdf"
    assert len(data["citations"]) == 1

    pdf_bytes = base64.b64decode(data["content_base64"])
    assert pdf_bytes.startswith(b"%PDF")
    assert data["file_size"] == len(pdf_bytes)

    reader = PdfReader(io.BytesIO(pdf_bytes))
    extracted_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "Q4 Policy Summary" in extracted_text
    assert "Remote work is permitted" in extracted_text


def test_generate_docx_report_returns_valid_docx_bytes() -> None:
    """POST /api/v1/reports/generate returns valid base64 DOCX readable by python-docx."""
    with (
        patch("app.api.reports.get_engine"),
        patch("app.api.reports.Session"),
        patch(
            "app.services.report_generator.run_rag_pipeline",
            return_value=MOCK_CHAT_DATA,
        ),
    ):
        res = client.post(
            "/api/v1/reports/generate",
            json={
                "company_id": "company_alpha",
                "title": "Compliance Brief",
                "prompt": "Summarize compliance policies",
                "format": "docx",
                "template": "compliance_audit",
            },
            headers=VALID_HEADERS,
        )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["format"] == "docx"
    assert data["file_name"] == "compliance-brief.docx"

    docx_bytes = base64.b64decode(data["content_base64"])
    assert docx_bytes.startswith(b"PK")

    doc = DocxDocument(io.BytesIO(docx_bytes))
    full_text = "\n".join(p.text for p in doc.paragraphs)
    assert "Compliance Brief" in full_text
    assert "Remote work is permitted" in full_text


def test_generate_report_requires_internal_key() -> None:
    """POST /api/v1/reports/generate returns 401 without valid X-Internal-Key."""
    res = client.post(
        "/api/v1/reports/generate",
        json={
            "company_id": "company_alpha",
            "title": "Test",
            "prompt": "Test prompt",
            "format": "pdf",
        },
    )
    assert res.status_code == 401


def test_generate_report_validates_format_enum() -> None:
    """POST /api/v1/reports/generate returns 422 on unsupported format."""
    res = client.post(
        "/api/v1/reports/generate",
        json={
            "company_id": "company_alpha",
            "title": "Test",
            "prompt": "Test prompt",
            "format": "xlsx",
        },
        headers=VALID_HEADERS,
    )
    assert res.status_code == 422


def test_generate_report_passes_company_id_to_retriever() -> None:
    """Report generator passes caller company_id strictly into run_rag_pipeline."""
    with (
        patch("app.api.reports.get_engine"),
        patch("app.api.reports.Session"),
        patch(
            "app.services.report_generator.run_rag_pipeline",
            return_value=MOCK_CHAT_DATA,
        ) as rag_mock,
    ):
        res = client.post(
            "/api/v1/reports/generate",
            json={
                "company_id": "tenant_xyz_999",
                "title": "Tenant Audit",
                "prompt": "Audit summary",
                "format": "pdf",
            },
            headers=VALID_HEADERS,
        )

    assert res.status_code == 200
    assert rag_mock.call_args.kwargs["company_id"] == "tenant_xyz_999"
