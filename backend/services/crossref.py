from __future__ import annotations

import asyncio
import re
from html import unescape
from typing import Any
from urllib.parse import quote

import httpx

from backend.config import Settings

TITLE_NORMALIZE_PATTERN = re.compile(r"[^a-z0-9]+")


class CrossrefNotFoundError(Exception):
    pass


class CrossrefError(Exception):
    pass


class CrossrefClient:
    def __init__(self, settings: Settings) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://api.crossref.org",
            headers={"User-Agent": settings.user_agent},
            timeout=settings.semantic_scholar_timeout,
        )
        self.semaphore = asyncio.Semaphore(settings.request_concurrency)
        self.max_retries = settings.request_max_retries
        self.backoff_base = settings.request_backoff_base

    async def close(self) -> None:
        await self.client.aclose()

    async def get_work(self, doi: str) -> dict[str, Any]:
        normalized_doi = _normalize_doi(doi)
        payload = await self._request("GET", f"/works/{quote(normalized_doi, safe='')}")
        message = payload.get("message") or {}
        if not message:
            raise CrossrefNotFoundError("Paper not found in Crossref.")
        return self._normalize_work(message)

    async def find_exact_title(self, title: str, limit: int = 5) -> dict[str, Any] | None:
        payload = await self._request(
            "GET",
            "/works",
            params={"query.title": title, "rows": limit, "select": "DOI,title,author,published-print,published-online,created,container-title,URL,link"},
        )
        works = payload.get("message", {}).get("items") or []
        normalized_query = _normalize_title(title)
        for work in works:
            normalized = self._normalize_work(work)
            if _normalize_title(normalized.get("title")) == normalized_query:
                return normalized
        return None

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
                    raise CrossrefError("Unable to reach Crossref.") from exc

                if response.status_code == 404:
                    raise CrossrefNotFoundError("Paper not found in Crossref.")

                if response.status_code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_base * (2**attempt))
                    continue

                if response.is_error:
                    raise CrossrefError(f"Crossref request failed with status {response.status_code}.")

                return response.json()

        raise CrossrefError("Crossref request failed.") from last_error

    def _normalize_work(self, work: dict[str, Any]) -> dict[str, Any]:
        doi = _normalize_doi(work.get("DOI"))
        title = _pick_first(work.get("title")) or "Untitled paper"
        authors = [
            {"name": " ".join(part for part in [author.get("given"), author.get("family")] if part).strip()}
            for author in (work.get("author") or [])
            if author.get("given") or author.get("family")
        ]
        return {
            "paperId": f"DOI:{doi}" if doi else "",
            "title": unescape(title),
            "authors": [author for author in authors if author.get("name")],
            "year": _extract_year(work),
            "citationCount": 0,
            "abstract": None,
            "venue": unescape(_pick_first(work.get("container-title")) or "") or None,
            "externalIds": {"DOI": doi} if doi else {},
            "url": _resolve_crossref_url(work, doi),
            "source": "crossref",
            "references": [],
            "citations": [],
        }


def _pick_first(value: Any) -> str | None:
    if isinstance(value, list) and value:
        first = value[0]
        return first if isinstance(first, str) else None
    if isinstance(value, str):
        return value
    return None


def _extract_year(work: dict[str, Any]) -> int | None:
    for key in ("published-print", "published-online", "created"):
        parts = (((work.get(key) or {}).get("date-parts") or [[]])[0] or [])
        if parts:
            year = parts[0]
            if isinstance(year, int):
                return year
    return None


def _normalize_doi(raw_doi: str | None) -> str | None:
    if not raw_doi:
        return None
    return raw_doi.removeprefix("https://doi.org/").removeprefix("http://doi.org/").strip()


def _normalize_title(title: str | None) -> str:
    if not title:
        return ""
    return TITLE_NORMALIZE_PATTERN.sub(" ", title.lower()).strip()


def _resolve_crossref_url(work: dict[str, Any], doi: str | None) -> str | None:
    for link in work.get("link") or []:
        content_url = link.get("URL")
        if content_url:
            return content_url
    if work.get("URL"):
        return work["URL"]
    if doi:
        return f"https://doi.org/{doi}"
    return None
