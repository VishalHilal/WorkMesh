import io
from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader


def extract_text_from_pdf(content: bytes) -> str:
    """Extract plain text from PDF bytes using pypdf."""
    reader = PdfReader(io.BytesIO(content))
    pages_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text.strip())
    return "\n\n".join(pages_text)


def extract_text_from_docx(content: bytes) -> str:
    """Extract plain text from Word DOCX bytes using python-docx."""
    doc = DocxDocument(io.BytesIO(content))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def extract_text_from_txt(content: bytes) -> str:
    """Decode raw bytes as UTF-8 string with fallback."""
    return content.decode("utf-8", errors="replace").strip()


def parse_document(file_name: str, content: bytes) -> str:
    """Parse document bytes into extracted text based on file extension."""
    ext = Path(file_name).suffix.lower()

    if ext == ".pdf":
        return extract_text_from_pdf(content)
    elif ext == ".docx":
        return extract_text_from_docx(content)
    elif ext == ".txt":
        return extract_text_from_txt(content)
    else:
        raise ValueError(
            f"Unsupported file type: {ext}. Only PDF, DOCX, and TXT are supported."
        )
