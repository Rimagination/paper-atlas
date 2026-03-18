from __future__ import annotations

import asyncio
import re
from html import unescape
from typing import Any

import httpx

from backend.config import Settings

TAG_PATTERN = re.compile(r"<[^>]+>")
DOI_YEAR_PATTERN = re.compile(r"\.(19|20)\d{2}\.")


class FrontiersNotFoundError(Exception):
    pass


class FrontiersError(Exception):
    pass


class FrontiersClient:
    def __init__(self, settings: Settings) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://www.frontiersin.org",
            headers={
                "User-Agent": settings.user_agent,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=settings.semantic_scholar_timeout,
        )
        self.semaphore = asyncio.Semaphore(settings.request_concurrency)
        self.max_retries = settings.request_max_retries
        self.backoff_base = settings.request_backoff_base

    async def close(self) -> None:
        await self.client.aclose()

    async def search_papers(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        payload = await self._search(query, limit=limit)
        return [self._normalize_article(article) for article in self._extract_articles(payload)[:limit]]

    async def get_paper(self, paper_id: str) -> dict[str, Any]:
        normalized_id = paper_id.removeprefix("FRONTIERS:")
        payload = await self._search(normalized_id, limit=3)
        for article in self._extract_articles(payload):
            article_id = str(article.get("ArticleId") or "")
            doi = (article.get("Doi") or "").lower()
            if normalized_id == article_id or normalized_id.lower() == doi:
                return self._normalize_article(article)
        raise FrontiersNotFoundError("Paper not found in Frontiers.")

    async def get_paper_by_doi(self, doi: str) -> dict[str, Any]:
        payload = await self._search(doi, limit=3)
        normalized_doi = doi.lower().removeprefix("doi:")
        for article in self._extract_articles(payload):
            if (article.get("Doi") or "").lower() == normalized_doi:
                return self._normalize_article(article)
        raise FrontiersNotFoundError("Paper not found in Frontiers.")

    async def _search(self, query: str, limit: int) -> dict[str, Any]:
        body = {
            "UserId": 0,
            "Search": query,
            "Skip": 0,
            "Top": limit,
            "SearchType": 1,
            "Filter": {},
        }
        return await self._request("POST", "/api/v2/search", json=body)

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
                    raise FrontiersError("Unable to reach Frontiers.") from exc

                if response.status_code == 404:
                    raise FrontiersNotFoundError("Paper not found in Frontiers.")

                if response.status_code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_base * (2**attempt))
                    continue

                if response.is_error:
                    raise FrontiersError(f"Frontiers request failed with status {response.status_code}.")

                return response.json()

        raise FrontiersError("Frontiers request failed.") from last_error

    @staticmethod
    def _extract_articles(payload: dict[str, Any]) -> list[dict[str, Any]]:
        top_results = payload.get("TopResults") or {}
        return top_results.get("Articles") or payload.get("Articles") or []

    def _normalize_article(self, article: dict[str, Any]) -> dict[str, Any]:
        doi = article.get("Doi")
        return {
            "paperId": f"FRONTIERS:{article.get('ArticleId')}",
            "title": self._clean_text(article.get("Title")) or "Untitled paper",
            "authors": [
                {"name": self._clean_text(author.get("FullName"))}
                for author in (article.get("Authors") or [])
                if self._clean_text(author.get("FullName"))
            ],
            "year": self._resolve_year(article),
            "citationCount": (((article.get("Impact") or {}).get("Citations") or {}).get("Count")) or 0,
            "abstract": self._clean_text(article.get("Abstract")),
            "venue": ((article.get("Journal") or {}).get("Title")) or ((article.get("Journal") or {}).get("Abbreviation")),
            "externalIds": {"DOI": doi} if doi else {},
            "url": article.get("PublicUrl"),
            "references": [],
            "citations": [],
            "source": "frontiers",
        }

    @staticmethod
    def _clean_text(value: str | None) -> str | None:
        if not value:
            return None
        return unescape(TAG_PATTERN.sub("", value)).strip() or None

    def _resolve_year(self, article: dict[str, Any]) -> int | None:
        published_date = self._clean_text(article.get("PublishedDate"))
        if published_date:
            year_match = re.search(r"(19|20)\d{2}", published_date)
            if year_match:
                return int(year_match.group(0))

        doi = (article.get("Doi") or "").lower()
        year_match = DOI_YEAR_PATTERN.search(doi)
        if year_match:
            return int(year_match.group(0).strip("."))

        return None
