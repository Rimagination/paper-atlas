from __future__ import annotations

import asyncio
import time
from typing import Any
from urllib.parse import quote

import httpx

from backend.config import Settings
from backend.models.schemas import GraphNode, PaperDetail, PaperSummary, WorkItem

SEARCH_FIELDS = "paperId,title,authors,year,citationCount,abstract,venue,externalIds,url"
DETAIL_FIELDS = (
    "paperId,title,authors,year,citationCount,abstract,venue,"
    "externalIds,url,references.paperId,references.citationCount,citations.paperId,citations.citationCount"
)
BATCH_FIELDS = (
    "paperId,title,authors,year,citationCount,abstract,venue,"
    "externalIds,url,references.paperId,citations.paperId"
)


class SemanticScholarNotFoundError(Exception):
    pass


class SemanticScholarError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class SemanticScholarClient:
    def __init__(self, settings: Settings) -> None:
        headers = {"User-Agent": settings.user_agent}
        if settings.semantic_scholar_api_key:
            headers["x-api-key"] = settings.semantic_scholar_api_key

        self.client = httpx.AsyncClient(
            base_url=settings.semantic_scholar_base_url,
            headers=headers,
            timeout=settings.semantic_scholar_timeout,
        )
        self.semaphore = asyncio.Semaphore(settings.request_concurrency)
        self.max_retries = settings.request_max_retries
        self.backoff_base = settings.request_backoff_base
        self.cooldown_seconds = settings.source_cooldown_seconds
        self.unavailable_until = 0.0

    async def close(self) -> None:
        await self.client.aclose()

    async def search_papers(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        payload = await self._request(
            "GET",
            "/paper/search",
            params={"query": query, "fields": SEARCH_FIELDS, "limit": limit},
        )
        return payload.get("data", [])

    async def get_paper(self, paper_id: str, fields: str = DETAIL_FIELDS) -> dict[str, Any]:
        if ":" not in paper_id:
            papers = await self.get_papers_batch([paper_id], fields=fields)
            if papers:
                return papers[0]
            raise SemanticScholarNotFoundError("Paper not found in Semantic Scholar.")

        encoded_id = quote(paper_id, safe="")
        return await self._request("GET", f"/paper/{encoded_id}", params={"fields": fields})

    async def get_papers_batch(self, ids: list[str], fields: str = BATCH_FIELDS) -> list[dict[str, Any]]:
        if not ids:
            return []

        results: list[dict[str, Any]] = []
        for start in range(0, len(ids), 500):
            chunk = ids[start : start + 500]
            payload = await self._request("POST", "/paper/batch", params={"fields": fields}, json={"ids": chunk})
            results.extend(item for item in payload if item and item.get("paperId"))
        return results

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        if self.unavailable_until > time.monotonic():
            raise SemanticScholarError("Semantic Scholar temporarily unavailable.", status_code=503)

        last_error: Exception | None = None

        async with self.semaphore:
            for attempt in range(self.max_retries + 1):
                try:
                    response = await self.client.request(method, path, **kwargs)
                except httpx.RequestError as exc:
                    last_error = exc
                    if attempt < self.max_retries:
                        await asyncio.sleep(self.backoff_base * (2**attempt))
                        continue
                    self._enter_cooldown()
                    raise SemanticScholarError("Unable to reach Semantic Scholar.") from exc

                if response.status_code == 404:
                    raise SemanticScholarNotFoundError("Paper not found in Semantic Scholar.")

                if response.status_code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_base * (2**attempt))
                    continue

                if response.is_error:
                    if response.status_code in {429, 500, 502, 503, 504}:
                        self._enter_cooldown()
                    raise SemanticScholarError(
                        f"Semantic Scholar request failed with status {response.status_code}.",
                        status_code=response.status_code,
                    )

                return response.json()

        self._enter_cooldown()
        raise SemanticScholarError("Semantic Scholar request failed.") from last_error

    def _enter_cooldown(self) -> None:
        self.unavailable_until = time.monotonic() + self.cooldown_seconds


def normalize_authors(paper: dict[str, Any]) -> list[str]:
    authors = paper.get("authors") or []
    return [author.get("name", "").strip() for author in authors if author.get("name")]


def resolve_doi(paper: dict[str, Any]) -> str | None:
    external_ids = paper.get("externalIds") or {}
    return external_ids.get("DOI") or external_ids.get("doi")


def resolve_url(paper: dict[str, Any]) -> str | None:
    doi = resolve_doi(paper)
    if doi:
        return f"https://doi.org/{doi}"
    if paper.get("url"):
        return paper["url"]
    if paper.get("paperId"):
        return f"https://www.semanticscholar.org/paper/{paper['paperId']}"
    return None


def paper_to_summary(paper: dict[str, Any]) -> PaperSummary:
    return PaperSummary(
        paper_id=paper.get("paperId", ""),
        title=paper.get("title") or "Untitled paper",
        authors=normalize_authors(paper),
        year=paper.get("year"),
        citation_count=paper.get("citationCount") or 0,
        abstract=paper.get("abstract"),
    )


def paper_to_detail(paper: dict[str, Any]) -> PaperDetail:
    return PaperDetail(
        **paper_to_summary(paper).model_dump(),
        venue=paper.get("venue"),
        doi=resolve_doi(paper),
        url=resolve_url(paper),
        reference_count=len(paper.get("references") or []),
    )


def paper_to_work_item(paper: dict[str, Any]) -> WorkItem:
    return WorkItem(
        paper_id=paper.get("paperId", ""),
        title=paper.get("title") or "Untitled",
        year=paper.get("year"),
        citation_count=paper.get("citationCount") or 0,
        authors=normalize_authors(paper),
        doi=resolve_doi(paper),
        url=resolve_url(paper),
    )


def paper_to_graph_node(paper: dict[str, Any], seed_paper_id: str) -> GraphNode:
    return GraphNode(
        id=paper.get("paperId", ""),
        title=paper.get("title") or "Untitled paper",
        year=paper.get("year"),
        citation_count=paper.get("citationCount") or 0,
        abstract=paper.get("abstract"),
        authors=normalize_authors(paper),
        url=resolve_url(paper),
        is_seed=paper.get("paperId") == seed_paper_id,
    )
