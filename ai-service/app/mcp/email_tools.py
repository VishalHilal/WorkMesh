"""MCP email tool schemas and Pydantic input/output models for WorkMesh email workflows."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

# Simple email pattern used for format validation without the email-validator package.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_email(value: str) -> str:
    """Raise ValueError if value does not look like a valid email address."""
    if not _EMAIL_RE.match(value):
        msg = f"'{value}' is not a valid email address."
        raise ValueError(msg)
    return value.lower().strip()


# ---------------------------------------------------------------------------
# EmailDraftTool — generate a structured email draft for human review
# ---------------------------------------------------------------------------


class EmailDraftInput(BaseModel):
    """Input schema for the MCP email draft tool."""

    to: str = Field(..., min_length=1, description="Primary recipient email address.")
    subject: str = Field(..., min_length=1, description="Email subject line.")
    body: str = Field(..., min_length=1, description="Full email body content.")
    cc: list[str] = Field(
        default_factory=list,
        description="Optional list of CC recipient email addresses.",
    )

    @field_validator("to", mode="before")
    @classmethod
    def validate_to_email(cls, v: str) -> str:
        """Validate the primary recipient email."""
        return _validate_email(v)

    @field_validator("cc", mode="before")
    @classmethod
    def validate_cc_emails(cls, v: list[str]) -> list[str]:
        """Validate each CC email address."""
        return [_validate_email(addr) for addr in v]

    @field_validator("subject", "body", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        """Ensure subject and body are not purely whitespace."""
        stripped = v.strip()
        if not stripped:
            msg = "Value must not be empty or whitespace-only."
            raise ValueError(msg)
        return stripped


class EmailDraftOutput(BaseModel):
    """Output schema returned by the email draft tool."""

    approval_token: str = Field(
        ..., description="UUID4 token identifying this draft for approval/rejection."
    )
    to: str
    subject: str
    body: str
    cc: list[str] = Field(default_factory=list)
    status: str = Field(
        default="PENDING",
        description="Draft lifecycle status: PENDING | APPROVED | REJECTED.",
    )


# ---------------------------------------------------------------------------
# EmailSendTool — finalise and dispatch an approved draft
# ---------------------------------------------------------------------------


class EmailSendInput(BaseModel):
    """Input schema for the MCP email send tool (requires prior approval)."""

    approval_token: str = Field(
        ...,
        min_length=36,
        max_length=36,
        description="UUID4 approval token returned from the draft step.",
    )

    @field_validator("approval_token", mode="before")
    @classmethod
    def validate_uuid_format(cls, v: str) -> str:
        """Loosely validate that the token looks like a UUID4 (36 chars, 4 hyphens)."""
        pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        if not re.match(pattern, v, re.IGNORECASE):
            msg = "approval_token must be a valid UUID4 string."
            raise ValueError(msg)
        return v


class EmailSendOutput(BaseModel):
    """Output schema returned after dispatching an approved email."""

    success: bool
    message: str


# ---------------------------------------------------------------------------
# EmailReadTool — retrieve inbox messages for context injection
# ---------------------------------------------------------------------------


class EmailReadInput(BaseModel):
    """Input schema for the MCP email read tool."""

    limit: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of emails to retrieve (1–50).",
    )
    unread_only: bool = Field(
        default=False,
        description="When True, only unread messages are returned.",
    )


class EmailReadOutput(BaseModel):
    """Output schema for a retrieved email message."""

    message_id: str
    sender: str
    subject: str
    snippet: str
    received_at: str
    unread: bool


# ---------------------------------------------------------------------------
# MCP Tool registry — maps tool name → input/output model pair
# ---------------------------------------------------------------------------

MCP_EMAIL_TOOLS: dict[str, dict[str, type[BaseModel]]] = {
    "email_draft": {"input": EmailDraftInput, "output": EmailDraftOutput},
    "email_send": {"input": EmailSendInput, "output": EmailSendOutput},
    "email_read": {"input": EmailReadInput, "output": EmailReadOutput},
}
