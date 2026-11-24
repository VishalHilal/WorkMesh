from app.services.chunker import chunk_text, estimate_tokens


def test_estimate_tokens():
    assert estimate_tokens("hello") >= 1
    assert estimate_tokens("a" * 400) == 100


def test_chunk_text_empty():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_chunk_text_short():
    text = "WorkMesh AI simplifies enterprise productivity and employee workflows."
    chunks = chunk_text(text, chunk_size=500, chunk_overlap=50)

    assert len(chunks) == 1
    assert chunks[0]["chunk_index"] == 0
    assert chunks[0]["content"] == text
    assert chunks[0]["token_count"] > 0


def test_chunk_text_long_paragraphs():
    paragraphs = [
        f"Section {i}: This is detailed enterprise policy text explaining workflow rule {i} in great depth."
        for i in range(1, 40)
    ]
    long_text = "\n\n".join(paragraphs)

    chunks = chunk_text(long_text, chunk_size=300, chunk_overlap=40)

    assert len(chunks) > 1
    for idx, chunk in enumerate(chunks):
        assert chunk["chunk_index"] == idx
        assert len(chunk["content"]) > 0
        assert chunk["token_count"] > 0
