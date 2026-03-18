from __future__ import annotations

import asyncio
import re
from typing import Any
from urllib.parse import quote

import httpx

from backend.config import Settings

ARXIV_DOI_PATTERN = re.compile(r"^10\.48550/arxiv\.(?P<arxiv_id>.+)$", re.IGNORECASE)


class OpenAlexNotFoundError(Exception):
    pass


class OpenAlexError(Exception):
    pass


class OpenAlexClient:
    def __init__(self, settings: Settings) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://api.openalex.org",
            headers={"User-Agent": settings.user_agent},
            timeout=settings.semantic_scholar_timeout,
        )
        self.semaphore = asyncio.Semaphore(settings.request_concurrency)
        self.max_retries = settings.request_max_retries
        self.backoff_base = settings.request_backoff_base

    async def close(self) -> None:
        await self.client.aclose()

    async def search_papers(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        payload = await self._request(
            "GET",
            "/works",
            params={"search": query, "per-page": limit},
        )
        return [self._normalize_work(work) for work in payload.get("results", [])]

    async def get_paper(self, paper_id: str) -> dict[str, Any]:
        normalized_id = self._normalize_input_id(paper_id)
        if normalized_id.startswith("DOI:"):
            doi = normalized_id.removeprefix("DOI:")
            payload = await self._request(
                "GET",
                "/works",
                params={"filter": f"doi:https://doi.org/{doi}", "per-page": 1},
            )
            results = payload.get("results", [])
            if not results:
                raise OpenAlexNotFoundError("Paper not found in OpenAlex.")
            return self._normalize_work(results[0])

        payload = await self._request("GET", f"/works/{quote(normalized_id, safe='')}")
        return self._normalize_work(payload)

    async def get_papers_batch(self, ids: list[str]) -> list[dict[str, Any]]:
        normalized_ids = [self._normalize_input_id(paper_id) for paper_id in ids if paper_id]
        if not normalized_ids:
            return []

        results: list[dict[str, Any]] = []
        for start in range(0, len(normalized_ids), 50):
            chunk = normalized_ids[start : start + 50]
            payload = await self._request(
                "GET",
                "/works",
                params={"filter": f"openalex:{'|'.join(chunk)}", "per-page": len(chunk)},
            )
            results.extend(self._normalize_work(work) for work in payload.get("results", []))
        return results

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
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
                    raise OpenAlexError("Unable to reach OpenAlex.") from exc

                if response.status_code == 404:
                    raise OpenAlexNotFoundError("Paper not found in OpenAlex.")

                if response.status_code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_base * (2**attempt))
                    continue

                if response.is_error:
                    raise OpenAlexError(f"OpenAlex request failed with status {response.status_code}.")

                return response.json()

        raise OpenAlexError("OpenAlex request failed.") from last_error

    def _normalize_work(self, work: dict[str, Any]) -> dict[str, Any]:
        paper_id = self._openalex_id(work.get("id"))
        ids = work.get("ids") or {}
        doi = self._normalize_doi(ids.get("doi") or work.get("doi"))
        arxiv_id = self._extract_arxiv_id(ids.get("doi"))
        primary_location = work.get("primary_location") or {}
        source = primary_location.get("source") or {}
        external_ids: dict[str, str] = {}
        if doi:
            external_ids["DOI"] = doi
        if arxiv_id:
            external_ids["ArXiv"] = arxiv_id

        return {
            "paperId": paper_id,
            "title": work.get("display_name") or work.get("title") or "Untitled paper",
            "authors": [
                {"name": authorship.get("author", {}).get("display_name", "").strip()}
                for authorship in (work.get("authorships") or [])
                if authorship.get("author", {}).get("display_name")
            ],
            "year": work.get("publication_year"),
            "citationCount": work.get("cited_by_count") or 0,
            "abstract": self._decode_abstract(work.get("abstract_inverted_index")),
            "venue": source.get("display_name"),
            "externalIds": external_ids,
            "url": primary_location.get("landing_page_url") or (f"https://doi.org/{doi}" if doi else work.get("id")),
            "source": "openalex",
            "references": [{"paperId": self._openalex_id(item)} for item in (work.get("referenced_works") or [])],
            # OpenAlex does not return citing IDs inline; use related works as a similarity proxy in fallback mode.
            "citations": [{"paperId": self._openalex_id(item)} for item in (work.get("related_works") or [])],
        }

    def _normalize_input_id(self, paper_id: str) -> str:
        if paper_id.startswith("https://openalex.org/"):
            return self._openalex_id(paper_id)
        return paper_id

    @staticmethod
    def _openalex_id(raw_id: str | None) -> str:
        if not raw_id:
            return ""
        return raw_id.rstrip("/").split("/")[-1]

    @staticmethod
    def _normalize_doi(raw_doi: str | None) -> str | None:
        if not raw_doi:
            return None
        return raw_doi.removeprefix("https://doi.org/").removeprefix("http://doi.org/")

    @classmethod
    def _extract_arxiv_id(cls, raw_doi: str | None) -> str | None:
        normalized_doi = cls._normalize_doi(raw_doi)
        if not normalized_doi:
            return None
        match = ARXIV_DOI_PATTERN.match(normalized_doi)
        if not match:
            return None
        return match.group("arxiv_id")

    @staticmethod
    def _decode_abstract(abstract_index: dict[str, list[int]] | None) -> str | None:
        if not abstract_index:
            return None

        positions: dict[int, str] = {}
        for token, indexes in abstract_index.items():
            for index in indexes:
                positions[index] = token

        return " ".join(token for _, token in sorted(positions.items()))
