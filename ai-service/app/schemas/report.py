"""Pydantic schemas for AI-synthesized DOCX and PDF report generation."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.chat import Citation

ReportFormat = Literal["pdf", "docx"]
ReportTemplate = Literal["executive_summary", "policy_brief", "compliance_audit"]


class ReportGenerateRequest(BaseModel):
    """Input payload for generating a tenant-scoped report artifact."""

    company_id: str = Field(..., min_length=1, description="Tenant company ID")
    title: str = Field(..., min_length=1, max_length=200, description="Report title")
    prompt: str = Field(
        ..., min_length=1, description="Topic or instructions for report synthesis"
    )
    format: ReportFormat = Field(default="pdf", description="Output file format")
    template: ReportTemplate = Field(
        default="executive_summary",
        description="Structural template style for the report",
    )
    document_ids: list[str] | None = Field(
        default=None,
        description="Optional list of document IDs to restrict source retrieval",
    )


class ReportGenerateData(BaseModel):
    """Generated report binary (base64) and metadata."""

    title: str
    format: ReportFormat
    template: ReportTemplate
    file_name: str
    mime_type: str
    file_size: int
    content_base64: str
    citations: list[Citation] = Field(default_factory=list)


class ReportGenerateResponse(BaseModel):
    """Envelope returned by POST /api/v1/reports/generate."""

    success: bool = True
    data: ReportGenerateData
