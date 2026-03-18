from __future__ import annotations

import asyncio
import re
from typing import Any

import httpx

from backend.config import Settings

TITLE_NORMALIZE_PATTERN = re.compile(r"[^a-z0-9]+")


class DblpError(Exception):
    pass


class DblpClient:
    def __init__(self, settings: Settings) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://dblp.org",
            headers={"User-Agent": settings.user_agent},
            timeout=settings.semantic_scholar_timeout,
        )
        self.semaphore = asyncio.Semaphore(settings.request_concurrency)
        self.max_retries = settings.request_max_retries
        self.backoff_base = settings.request_backoff_base

    async def close(self) -> None:
        await self.client.aclose()

    async def find_exact_title(self, query: str) -> dict[str, Any] | None:
        payload = await self._request(
            "GET",
            "/search/publ/api",
            params={"q": query, "h": 10, "format": "json"},
        )
        hits = ((payload.get("result") or {}).get("hits") or {}).get("hit") or []
        matches = [self._normalize_hit(hit.get("info") or {}) for hit in hits]
        exact_matches = [item for item in matches if _normalize_title(item.get("title")) == _normalize_title(query)]
        if not exact_matches:
            return None

        exact_matches.sort(key=_dblp_rank, reverse=True)
        return exact_matches[0]

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        async with self.semaphore:
            last_error: Exception | None = None
            for attempt in range(self.max_retries + 1):
                try:
                    response = await self.client.request(method, path, **kwargs)
                except httpx.RequestError as exc:
                    last_error = exc
                    if attempt < self.max_retries:
                        await asyncio.sleep(self.backoff_base * (2**attempt))
                        continue
                    raise DblpError("Unable to reach DBLP.") from exc

                if response.status_code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_base * (2**attempt))
                    continue

                if response.is_error:
                    raise DblpError(f"DBLP request failed with status {response.status_code}.")

                return response.json()

        raise DblpError("DBLP request failed.") from last_error

    def _normalize_hit(self, info: dict[str, Any]) -> dict[str, Any]:
        authors = info.get("authors") or {}
        author_list = authors.get("author") or []
        if isinstance(author_list, dict):
            author_list = [author_list]

        year = info.get("year")
        try:
            normalized_year = int(year) if year is not None else None
        except (TypeError, ValueError):
            normalized_year = None

        url = info.get("ee") or info.get("url")
        title = _strip_trailing_punctuation(info.get("title") or "Untitled paper")
        venue = info.get("venue")
        doi = _extract_doi(url)

        return {
            "title": title,
            "authors": [{"name": item.get("text", "").strip()} for item in author_list if item.get("text")],
            "year": normalized_year,
            "venue": venue,
            "url": url,
            "externalIds": {"DOI": doi} if doi else {},
            "abstract": None,
            "citationCount": None,
            "type": info.get("type"),
        }


def _dblp_rank(item: dict[str, Any]) -> tuple[int, int]:
    venue = (item.get("venue") or "").casefold()
    paper_type = (item.get("type") or "").casefold()
    preferred = 0
    if venue and venue != "corr":
        preferred += 2
    if "conference" in paper_type or "journal" in paper_type:
        preferred += 1
    return preferred, item.get("year") or 0


def _normalize_title(title: str | None) -> str:
    if not title:
        return ""
    return TITLE_NORMALIZE_PATTERN.sub(" ", title.lower()).strip()


def _strip_trailing_punctuation(title: str) -> str:
    return title.rstrip(" .")


def _extract_doi(url: str | None) -> str | None:
    if not url:
        return None
    lowered = url.casefold()
    if "doi.org/" not in lowered:
        return None
    return url.split("doi.org/")[-1].strip() or None
