from app.services.embeddings import generate_embeddings


def test_generate_embeddings_empty():
    assert generate_embeddings([]) == []


def test_generate_embeddings_texts():
    texts = [
        "WorkMesh AI enterprise document search",
        "Employee onboarding and security handbook",
    ]
    embeddings = generate_embeddings(texts)

    assert len(embeddings) == 2
    assert len(embeddings[0]) == 384
    assert len(embeddings[1]) == 384
    assert isinstance(embeddings[0][0], float)
