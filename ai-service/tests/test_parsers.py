import io

import pytest
from docx import Document as DocxDocument
from pypdf import PdfWriter

from app.services.parser import (
    extract_text_from_docx,
    extract_text_from_pdf,
    extract_text_from_txt,
    parse_document,
)


def test_extract_text_from_txt():
    content = b"Hello WorkMesh AI\nThis is a plain text document."
    result = extract_text_from_txt(content)
    assert "Hello WorkMesh AI" in result
    assert "plain text document" in result


def test_extract_text_from_pdf():
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    # Write empty/minimal PDF to bytes
    pdf_bytes = io.BytesIO()
    writer.write(pdf_bytes)
    pdf_data = pdf_bytes.getvalue()

    result = extract_text_from_pdf(pdf_data)
    assert isinstance(result, str)


def test_extract_text_from_docx():
    doc = DocxDocument()
    doc.add_paragraph("Paragraph 1 of Word Document.")
    doc.add_paragraph("Paragraph 2 with company policy details.")
    docx_bytes = io.BytesIO()
    doc.save(docx_bytes)
    docx_data = docx_bytes.getvalue()

    result = extract_text_from_docx(docx_data)
    assert "Paragraph 1 of Word Document." in result
    assert "Paragraph 2 with company policy details." in result


def test_parse_document_routing():
    txt_content = b"Simple text note."
    assert "Simple text note." in parse_document("note.txt", txt_content)

    with pytest.raises(ValueError, match="Unsupported file type"):
        parse_document("unsupported.exe", b"binary data")
