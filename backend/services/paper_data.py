from __future__ import annotations

import asyncio
import re
from typing import Any

from backend.services.dblp import DblpClient, DblpError
from backend.services.frontiers import FrontiersClient, FrontiersError, FrontiersNotFoundError
from backend.services.openalex import OpenAlexClient, OpenAlexError, OpenAlexNotFoundError
from backend.services.semantic_scholar import (
    SemanticScholarClient,
    SemanticScholarError,
    SemanticScholarNotFoundError,
)

TITLE_NORMALIZE_PATTERN = re.compile(r"[^a-z0-9]+")
OPENALEX_ID_PATTERN = re.compile(r"^(?:https://openalex\.org/)?W\d+$", re.IGNORECASE)


class PaperDataError(Exception):
    pass


class PaperDataNotFoundError(Exception):
    pass


class PaperDataClient:
    def __init__(
        self,
        settings,
        semantic_client: SemanticScholarClient,
        openalex_client: OpenAlexClient,
        frontiers_client: FrontiersClient,
        dblp_client: DblpClient,
    ) -> None:
        self.settings = settings
        self.semantic_client = semantic_client
        self.openalex_client = openalex_client
        self.frontiers_client = frontiers_client
        self.dblp_client = dblp_client

    async def close(self) -> None:
        await self.semantic_client.close()
        await self.openalex_client.close()
        await self.frontiers_client.close()
        await self.dblp_client.close()

    async def search_papers(self, query: str, limit: int = 10) -> list[dict]:
        primary_source = ""
        primary_results: list[dict] = []
        try:
            primary_source, primary_results = await self.search_indexed_papers(query, limit=limit)
        except PaperDataError:
            primary_results = []

        if not _is_title_like_query(query):
            return primary_results

        exact_primary = _exact_title_matches(primary_results, query)
        if exact_primary:
            if primary_source == "openalex":
                try:
                    detailed_primary = await self.get_paper(exact_primary[0]["paperId"])
                except (PaperDataError, PaperDataNotFoundError):
                    repaired_primary = await self._repair_openalex_exact_matches(query, exact_primary)
                    if repaired_primary:
                        return repaired_primary[:limit]
                else:
                    return [detailed_primary]
            return exact_primary[:limit]

        try:
            frontiers_results = await self.frontiers_client.search_papers(query, limit=limit)
        except FrontiersError:
            frontiers_results = []

        exact_frontiers = _exact_title_matches(frontiers_results, query)
        if exact_frontiers:
            return exact_frontiers[:limit]

        return []

    async def get_paper(self, paper_id: str) -> dict:
        prefers_openalex = _should_prefer_openalex(paper_id)
        if paper_id.startswith("FRONTIERS:"):
            try:
                return await self.frontiers_client.get_paper(paper_id)
            except FrontiersNotFoundError as exc:
                raise PaperDataNotFoundError(str(exc)) from exc
            except FrontiersError as exc:
                raise PaperDataError(str(exc)) from exc

        if prefers_openalex:
            try:
                paper = await self.openalex_client.get_paper(paper_id)
                return await self._repair_openalex_paper(paper)
            except OpenAlexNotFoundError:
                pass
            except OpenAlexError as exc:
                raise PaperDataError(str(exc)) from exc

        semantic_error: SemanticScholarError | None = None
        try:
            return await self.semantic_client.get_paper(paper_id)
        except SemanticScholarNotFoundError:
            pass
        except SemanticScholarError as exc:
            semantic_error = exc
            if not prefers_openalex:
                try:
                    return await self._get_paper_with_fresh_semantic_client(paper_id)
                except SemanticScholarNotFoundError:
                    pass
                except SemanticScholarError as retry_exc:
                    semantic_error = retry_exc

        try:
            paper = await self.openalex_client.get_paper(paper_id)
            return await self._repair_openalex_paper(paper)
        except OpenAlexNotFoundError as exc:
            if semantic_error and not prefers_openalex:
                raise PaperDataError(str(semantic_error)) from semantic_error
            if _is_frontiers_doi(paper_id):
                try:
                    return await self.frontiers_client.get_paper_by_doi(paper_id.removeprefix("DOI:"))
                except FrontiersNotFoundError:
                    raise PaperDataNotFoundError(str(exc)) from exc
                except FrontiersError as frontiers_exc:
                    raise PaperDataError(str(frontiers_exc)) from frontiers_exc
            raise PaperDataNotFoundError(str(exc)) from exc
        except OpenAlexError as exc:
            raise PaperDataError(str(exc)) from exc

    async def get_papers_batch(self, ids: list[str]) -> list[dict]:
        if ids and all(_is_openalex_id(paper_id) for paper_id in ids):
            try:
                return await self.openalex_client.get_papers_batch(ids)
            except OpenAlexError as exc:
                raise PaperDataError(str(exc)) from exc

        semantic_error: SemanticScholarError | None = None
        try:
            return await self.semantic_client.get_papers_batch(ids)
        except SemanticScholarError as exc:
            semantic_error = exc
            try:
                return await self._get_papers_batch_with_fresh_semantic_client(ids)
            except SemanticScholarError as retry_exc:
                semantic_error = retry_exc

        if any(not _is_openalex_id(paper_id) for paper_id in ids):
            raise PaperDataError(str(semantic_error or "Unable to fetch paper batch from Semantic Scholar."))

        try:
            return await self.openalex_client.get_papers_batch(ids)
        except OpenAlexError as exc:
            raise PaperDataError(str(exc)) from exc

    async def search_indexed_papers(self, query: str, limit: int = 10) -> tuple[str, list[dict]]:
        try:
            semantic_timeout = 1.5 if _is_title_like_query(query) else 2.5
            results = await asyncio.wait_for(
                self.semantic_client.search_papers(query, limit=limit),
                timeout=semantic_timeout,
            )
            if results:
                return "semantic", results
        except (SemanticScholarError, TimeoutError, asyncio.TimeoutError):
            pass

        if _is_title_like_query(query):
            try:
                results = await asyncio.wait_for(
                    self._search_papers_with_fresh_semantic_client(query, limit),
                    timeout=2.5,
                )
                if results:
                    return "semantic", results
            except (SemanticScholarError, TimeoutError, asyncio.TimeoutError):
                pass

        try:
            results = await self.openalex_client.search_papers(query, limit=limit)
            return "openalex", results
        except OpenAlexError as exc:
            raise PaperDataError(str(exc)) from exc

    async def get_paper_prior_derivative(
        self, paper_id: str, max_items: int = 20
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Return (prior_works, derivative_works) using dedicated SS reference/citation endpoints.

        A fresh SemanticScholarClient is created so that any cooldown on the shared
        client (triggered by graph-building requests) does not silently abort these calls.
        """
        client = SemanticScholarClient(self.settings)
        try:
            # Resolve prefixed IDs (DOI:, ARXIV:, …) to a bare SS paperId
            ss_id = paper_id
            if ":" in paper_id:
                try:
                    paper = await client.get_paper(paper_id, fields="paperId")
                    ss_id = paper.get("paperId") or paper_id
                except (SemanticScholarNotFoundError, SemanticScholarError):
                    return [], []

            async def _fetch_references() -> list[dict[str, Any]]:
                try:
                    refs = await client.get_paper_references(ss_id, limit=100)
                    return sorted(refs, key=lambda x: x.get("citationCount") or 0, reverse=True)[:max_items]
                except (SemanticScholarError, SemanticScholarNotFoundError):
                    return []

            async def _fetch_citations() -> list[dict[str, Any]]:
                # Fetch a large sample, sort by citation count, take top N
                try:
                    cites = await client.get_paper_citations(ss_id, limit=500)
                    return sorted(cites, key=lambda x: x.get("citationCount") or 0, reverse=True)[:max_items]
                except (SemanticScholarError, SemanticScholarNotFoundError):
                    return []

            prior_papers, derivative_papers = await asyncio.gather(
                _fetch_references(),
                _fetch_citations(),
            )
            return prior_papers, derivative_papers
        finally:
            await client.close()

    async def get_papers_batch_from_source(self, source: str, ids: list[str]) -> list[dict]:
        if source == "semantic":
            try:
                return await self.semantic_client.get_papers_batch(ids)
            except SemanticScholarError as exc:
                raise PaperDataError(str(exc)) from exc

        if source == "openalex":
            try:
                return await self.openalex_client.get_papers_batch(ids)
            except OpenAlexError as exc:
                raise PaperDataError(str(exc)) from exc

        raise PaperDataError(f"Unknown paper source: {source}")

    async def _get_paper_with_fresh_semantic_client(self, paper_id: str) -> dict:
        client = SemanticScholarClient(self.settings)
        try:
            return await client.get_paper(paper_id)
        finally:
            await client.close()

    async def _get_papers_batch_with_fresh_semantic_client(self, ids: list[str]) -> list[dict]:
        client = SemanticScholarClient(self.settings)
        try:
            return await client.get_papers_batch(ids)
        finally:
            await client.close()

    async def _search_papers_with_fresh_semantic_client(self, query: str, limit: int) -> list[dict]:
        client = SemanticScholarClient(self.settings)
        try:
            return await client.search_papers(query, limit=limit)
        finally:
            await client.close()

    async def _repair_openalex_exact_matches(self, query: str, results: list[dict]) -> list[dict]:
        semantic_override = await self._find_exact_semantic_match(query)
        if semantic_override:
            return [self._merge_metadata_override(results[0], semantic_override)]

        repaired = []
        for paper in results:
            repaired.append(await self._repair_openalex_paper(paper, query=query))
        return repaired

    async def _repair_openalex_paper(self, paper: dict, query: str | None = None) -> dict:
        if paper.get("source") != "openalex":
            return paper

        target_query = (query or paper.get("title") or "").strip()
        if not target_query or not _is_title_like_query(target_query):
            return paper

        semantic_override = await self._find_exact_semantic_match(target_query)
        if semantic_override:
            return self._merge_metadata_override(paper, semantic_override)

        semantic_external_override = await self._find_semantic_match_from_external_ids(paper, target_query)
        if semantic_external_override:
            return self._merge_metadata_override(paper, semantic_external_override)

        try:
            dblp_override = await self.dblp_client.find_exact_title(target_query)
        except DblpError:
            dblp_override = None

        if dblp_override:
            return self._merge_metadata_override(paper, dblp_override)

        return paper

    async def _find_exact_semantic_match(self, query: str) -> dict | None:
        try:
            results = await self._search_papers_with_fresh_semantic_client(query, limit=5)
        except SemanticScholarError:
            return None

        exact_matches = _exact_title_matches(results, query)
        if not exact_matches:
            return None
        return exact_matches[0]

    async def _find_semantic_match_from_external_ids(self, paper: dict, query: str) -> dict | None:
        external_ids = paper.get("externalIds") or {}
        lookup_ids: list[str] = []
        arxiv_id = external_ids.get("ArXiv")
        if arxiv_id:
            lookup_ids.append(f"ARXIV:{arxiv_id}")

        for lookup_id in lookup_ids:
            try:
                semantic_paper = await self._get_paper_with_fresh_semantic_client(lookup_id)
            except (SemanticScholarError, SemanticScholarNotFoundError):
                continue
            if _normalize_title(semantic_paper.get("title")) == _normalize_title(query):
                return semantic_paper

        return None

    def _merge_metadata_override(self, paper: dict, override: dict) -> dict:
        merged = dict(paper)
        for key in ("title", "authors", "year", "abstract", "venue", "url"):
            value = override.get(key)
            if value not in (None, "", [], {}):
                merged[key] = value

        override_external_ids = override.get("externalIds") or {}
        existing_external_ids = merged.get("externalIds") or {}
        if override_external_ids:
            merged["externalIds"] = {**existing_external_ids, **override_external_ids}

        citation_count = override.get("citationCount")
        if citation_count is not None:
            merged["citationCount"] = citation_count
        return merged


def _is_title_like_query(query: str) -> bool:
    return len(query.strip()) >= 40 or len(query.strip().split()) >= 5


def _normalize_title(title: str | None) -> str:
    if not title:
        return ""
    return TITLE_NORMALIZE_PATTERN.sub(" ", title.lower()).strip()


def _exact_title_matches(results: list[dict], query: str) -> list[dict]:
    normalized_query = _normalize_title(query)
    return [paper for paper in results if _normalize_title(paper.get("title")) == normalized_query]


def _is_frontiers_doi(paper_id: str) -> bool:
    return paper_id.upper().startswith("DOI:10.3389/")


def _is_openalex_id(paper_id: str) -> bool:
    return bool(OPENALEX_ID_PATTERN.match(paper_id.strip()))


def _should_prefer_openalex(paper_id: str) -> bool:
    normalized = paper_id.strip()
    return _is_openalex_id(normalized) or normalized.upper().startswith("DOI:")
