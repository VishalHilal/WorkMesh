import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0


def _embed_single_with_retry(
    client: httpx.Client,
    text: str,
    model: str,
    dimensions: int,
    api_key: str,
    base_url: str,
) -> list[float]:
    """Generate a single embedding with exponential backoff on HTTP 429."""
    url = f"{base_url}/models/{model}:embedContent?key={api_key}"
    payload = {
        "model": f"models/{model}",
        "content": {"parts": [{"text": text}]},
        "outputDimensionality": dimensions,
    }

    backoff = INITIAL_BACKOFF
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.post(url, json=payload)
            if response.status_code == 429:
                if attempt < MAX_RETRIES:
                    logger.warning(
                        "Gemini embedding rate limit 429 hit, retrying in %.1fs (attempt %d/%d)",
                        backoff,
                        attempt + 1,
                        MAX_RETRIES,
                    )
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                response.raise_for_status()

            response.raise_for_status()
            data = response.json()
            return data["embedding"]["values"]
        except httpx.HTTPStatusError:
            if attempt == MAX_RETRIES:
                raise
            time.sleep(backoff)
            backoff *= 2
        except httpx.RequestError:
            if attempt == MAX_RETRIES:
                raise
            time.sleep(backoff)
            backoff *= 2

    raise RuntimeError("Failed to generate embedding after retries.")


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Compute 768-dimensional dense vector embeddings using Google Gemini gemini-embedding-2.

    Attempts batchEmbedContents first; falls back to individual embedContent with
    exponential backoff retry on HTTP 429 rate limits.
    """
    if not texts:
        return []

    model = settings.gemini_embedding_model
    dimensions = settings.embedding_dimension
    api_key = settings.gemini_api_key
    base_url = settings.gemini_api_base_url

    if not api_key:
        logger.warning(
            "GEMINI_API_KEY is not configured; returning fallback zero vectors of dimension %d.",
            dimensions,
        )
        return [[0.0] * dimensions for _ in texts]

    batch_url = f"{base_url}/models/{model}:batchEmbedContents?key={api_key}"
    batch_payload = {
        "requests": [
            {
                "model": f"models/{model}",
                "content": {"parts": [{"text": text}]},
                "outputDimensionality": dimensions,
            }
            for text in texts
        ]
    }

    with httpx.Client(timeout=30.0) as client:
        # Try batch endpoint first
        try:
            response = client.post(batch_url, json=batch_payload)
            if response.status_code == 200:
                data = response.json()
                return [item["values"] for item in data["embeddings"]]
            logger.info(
                "Batch embedding returned status %d; falling back to individual calls.",
                response.status_code,
            )
        except (httpx.HTTPError, KeyError) as exc:
            logger.info("Batch embedding failed (%s); falling back to individual calls.", exc)

        # Fallback: process individually with retry & backoff
        results: list[list[float]] = []
        for text in texts:
            vec = _embed_single_with_retry(
                client=client,
                text=text,
                model=model,
                dimensions=dimensions,
                api_key=api_key,
                base_url=base_url,
            )
            results.append(vec)
        return results
