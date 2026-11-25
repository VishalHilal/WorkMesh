"""Report synthesis and DOCX/PDF rendering service grounded in company RAG documents."""

from __future__ import annotations

import base64
import io
import re
import textwrap
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from docx import Document as DocxDocument

from app.schemas.report import ReportFormat, ReportGenerateData, ReportTemplate
from app.services.rag import run_rag_pipeline

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.schemas.chat import Citation

_MIME_TYPES: dict[ReportFormat, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

_TEMPLATE_LABELS: dict[ReportTemplate, str] = {
    "executive_summary": "Executive Summary",
    "policy_brief": "Policy Brief",
    "compliance_audit": "Compliance Audit Report",
}


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug[:60] or "workmesh-report"


def _render_docx_bytes(
    title: str,
    template: ReportTemplate,
    body_markdown: str,
    citations: list[Citation],
) -> bytes:
    """Render report title, synthesized body, and citations into a valid DOCX archive."""
    doc = DocxDocument()
    doc.add_heading(title, level=0)
    doc.add_paragraph(
        f"Template: {_TEMPLATE_LABELS[template]}  |  "
        f"Generated: {datetime.now(tz=UTC).strftime('%Y-%m-%d %H:%M UTC')}"
    )

    for raw_line in body_markdown.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("### "):
            doc.add_heading(line[4:], level=3)
        elif line.startswith("## "):
            doc.add_heading(line[3:], level=2)
        elif line.startswith("# "):
            doc.add_heading(line[2:], level=1)
        elif line.startswith(("- ", "* ")):
            doc.add_paragraph(line[2:].replace("**", ""), style="List Bullet")
        else:
            doc.add_paragraph(line.replace("**", ""))

    if citations:
        doc.add_heading("Grounded Sources", level=2)
        for idx, cite in enumerate(citations, start=1):
            doc.add_paragraph(
                f"[{idx}] Document {cite.document_id} (Chunk #{cite.chunk_index + 1}, "
                f"{round(cite.similarity_score * 100)}% match): {cite.snippet}"
            )

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _escape_pdf_text(text: str) -> str:
    """Escape characters special to PDF literal strings and normalize non-Latin1."""
    latin = text.encode("latin-1", "replace").decode("latin-1")
    return latin.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _render_pdf_bytes(
    title: str,
    template: ReportTemplate,
    body_markdown: str,
    citations: list[Citation],
) -> bytes:
    """Render report text into a clean multi-page PDF 1.4 document with zero extra deps."""
    generated_at = datetime.now(tz=UTC).strftime("%Y-%m-%d %H:%M UTC")
    lines: list[tuple[str, int]] = [
        (title, 15),
        (f"{_TEMPLATE_LABELS[template]} | Generated {generated_at}", 9),
        ("", 10),
    ]

    for raw_line in body_markdown.splitlines():
        clean = raw_line.strip().lstrip("#").strip().replace("**", "")
        if not clean:
            lines.append(("", 10))
            continue
        for wrapped in textwrap.wrap(clean, width=88) or [""]:
            lines.append((wrapped, 10))

    if citations:
        lines.append(("", 10))
        lines.append(("Grounded Sources", 12))
        for idx, cite in enumerate(citations, start=1):
            src_line = (
                f"[{idx}] Doc {cite.document_id} (Chunk #{cite.chunk_index + 1}, "
                f"{round(cite.similarity_score * 100)}%): {cite.snippet}"
            )
            for wrapped in textwrap.wrap(src_line, width=88):
                lines.append((wrapped, 9))

    # Paginate lines (~46 lines per US Letter page)
    pages_lines: list[list[tuple[str, int]]] = [
        lines[i : i + 46] for i in range(0, max(len(lines), 1), 46)
    ]

    # Build PDF objects: 1=Catalog, 2=Pages, 3=Font, then (Page, Content) pairs
    objects: list[bytes] = []
    page_obj_ids: list[int] = []
    next_id = 4

    page_entries: list[tuple[int, int, bytes]] = []
    for page in pages_lines:
        stream_cmds = ["BT", "/F1 10 Tf"]
        y = 740
        for text, size in page:
            if text:
                stream_cmds.append(f"/F1 {size} Tf")
                stream_cmds.append(f"1 0 0 1 54 {y} Tm ({_escape_pdf_text(text)}) Tj")
            y -= 15 if size >= 12 else 14
        stream_cmds.append("ET")
        stream_bytes = "\n".join(stream_cmds).encode("latin-1")

        page_id = next_id
        content_id = next_id + 1
        next_id += 2
        page_obj_ids.append(page_id)
        page_entries.append((page_id, content_id, stream_bytes))

    kids_str = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(
        f"2 0 obj\n<< /Type /Pages /Kids [{kids_str}] /Count {len(page_obj_ids)} >>\nendobj\n".encode(
            "ascii"
        )
    )
    objects.append(
        b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    )

    for page_id, content_id, stream_bytes in page_entries:
        objects.append(
            f"{page_id} 0 obj\n"
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>\n"
            f"endobj\n".encode("ascii")
        )
        objects.append(
            f"{content_id} 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode(
                "ascii"
            )
            + stream_bytes
            + b"\nendstream\nendobj\n"
        )

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets: list[int] = []
    for obj in objects:
        offsets.append(out.tell())
        out.write(obj)

    xref_pos = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.write(b"0000000000 65535 f \n")
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode("ascii"))

    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode(
            "ascii"
        )
    )
    return out.getvalue()


def generate_report(
    session: Session,
    company_id: str,
    title: str,
    prompt: str,
    report_format: ReportFormat = "pdf",
    template: ReportTemplate = "executive_summary",
    document_ids: list[str] | None = None,
) -> ReportGenerateData:
    """Synthesize report content from company documents and render DOCX or PDF bytes."""
    synthesis_query = (
        f"Generate a structured {_TEMPLATE_LABELS[template]} titled '{title}'. "
        f"Include Executive Summary, Key Findings, and Actionable Recommendations. "
        f"Focus on: {prompt}"
    )

    rag_result = run_rag_pipeline(
        session=session,
        company_id=company_id,
        query=synthesis_query,
        top_k=8,
        threshold=0.25,
        document_ids=document_ids,
    )

    if report_format == "docx":
        raw_bytes = _render_docx_bytes(
            title=title,
            template=template,
            body_markdown=rag_result.answer,
            citations=rag_result.citations,
        )
    else:
        raw_bytes = _render_pdf_bytes(
            title=title,
            template=template,
            body_markdown=rag_result.answer,
            citations=rag_result.citations,
        )

    file_name = f"{_slugify(title)}.{report_format}"
    encoded = base64.b64encode(raw_bytes).decode("ascii")

    return ReportGenerateData(
        title=title,
        format=report_format,
        template=template,
        file_name=file_name,
        mime_type=_MIME_TYPES[report_format],
        file_size=len(raw_bytes),
        content_base64=encoded,
        citations=rag_result.citations,
    )
