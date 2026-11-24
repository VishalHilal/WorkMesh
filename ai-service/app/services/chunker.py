from typing import TypedDict


class TextChunk(TypedDict):
    chunk_index: int
    content: str
    token_count: int


def estimate_tokens(text: str) -> int:
    """Approximate token count (rule of thumb: ~4 characters per token in English)."""
    return max(1, len(text) // 4)


def chunk_text(
    text: str,
    chunk_size: int = 1500,
    chunk_overlap: int = 150,
) -> list[TextChunk]:
    """Recursively split text into overlapping chunks using natural paragraph and sentence delimiters."""
    clean_text = text.strip()
    if not clean_text:
        return []

    # If already smaller than chunk size, return as single chunk
    if len(clean_text) <= chunk_size:
        return [
            {
                "chunk_index": 0,
                "content": clean_text,
                "token_count": estimate_tokens(clean_text),
            }
        ]

    # Split hierarchy: double newline -> single newline -> period+space -> space
    separators = ["\n\n", "\n", ". ", " "]

    def recursive_split(subtext: str, sep_idx: int) -> list[str]:
        if len(subtext) <= chunk_size:
            return [subtext] if subtext.strip() else []

        if sep_idx >= len(separators):
            # Base case: hard split by character
            return [
                subtext[i : i + chunk_size]
                for i in range(0, len(subtext), chunk_size - chunk_overlap)
            ]

        sep = separators[sep_idx]
        parts = subtext.split(sep)
        splits: list[str] = []
        current = ""

        for part in parts:
            candidate = f"{current}{sep}{part}" if current else part
            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current:
                    splits.append(current)
                if len(part) > chunk_size:
                    splits.extend(recursive_split(part, sep_idx + 1))
                    current = ""
                else:
                    current = part

        if current.strip():
            splits.append(current)

        return splits

    raw_splits = recursive_split(clean_text, 0)

    # Apply overlap between adjacent chunks
    chunks: list[TextChunk] = []
    for idx, segment in enumerate(raw_splits):
        content = segment.strip()
        if not content:
            continue

        # If not the first chunk and overlap requested, prepend tail of previous chunk
        if idx > 0 and chunk_overlap > 0 and len(chunks) > 0:
            prev_content = chunks[-1]["content"]
            overlap_text = prev_content[-chunk_overlap:].strip()
            if overlap_text and not content.startswith(overlap_text):
                content = f"{overlap_text} ... {content}"

        chunks.append(
            {
                "chunk_index": len(chunks),
                "content": content,
                "token_count": estimate_tokens(content),
            }
        )

    return chunks
