from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query, Request

from backend.models.schemas import GraphResponse, PaperDetail, PaperSummary
from backend.services.paper_data import PaperDataError, PaperDataNotFoundError
from backend.services.semantic_scholar import paper_to_detail, paper_to_summary

router = APIRouter()

DOI_PATTERN = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)


@router.get("/search", response_model=list[PaperSummary])
async def search_papers(request: Request, q: str = Query(..., min_length=1)) -> list[PaperSummary]:
    cache_service = request.app.state.cache
    settings = request.app.state.settings
    paper_client = request.app.state.paper_client
    query = q.strip()
    if not query:
        return []

    cache_key = f"search:{query.casefold()}"
    cached_results = await cache_service.get_json(cache_key)
    if cached_results:
        return [PaperSummary.model_validate(item) for item in cached_results]

    doi_match = DOI_PATTERN.search(query)
    if doi_match:
        doi = doi_match.group(0)
        try:
            paper = await paper_client.get_paper(f"DOI:{doi}")
        except PaperDataNotFoundError:
            pass
        except PaperDataError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        else:
            summaries = [paper_to_summary(paper)]
            await cache_service.set_json(
                cache_key,
                [summary.model_dump(mode="json") for summary in summaries],
                settings.cache_ttl_search,
            )
            return summaries

    if len(query) < 3:
        return []

    try:
        results = await paper_client.search_papers(query, limit=10)
    except PaperDataError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    summaries = [paper_to_summary(paper) for paper in results]
    await cache_service.set_json(
        cache_key,
        [summary.model_dump(mode="json") for summary in summaries],
        settings.cache_ttl_search,
    )
    return summaries


@router.get("/graph/{paper_id}", response_model=GraphResponse)
async def get_graph(request: Request, paper_id: str) -> GraphResponse:
    similarity_engine = request.app.state.similarity_engine
    try:
        return await similarity_engine.build_graph(paper_id)
    except PaperDataNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PaperDataError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/paper/{paper_id}", response_model=PaperDetail)
async def get_paper(request: Request, paper_id: str) -> PaperDetail:
    cache_service = request.app.state.cache
    paper_client = request.app.state.paper_client
    settings = request.app.state.settings
    cache_key = f"paper_detail:{paper_id}"

    cached_paper = await cache_service.get_json(cache_key)
    if cached_paper:
        return PaperDetail.model_validate(cached_paper)

    try:
        paper = await paper_client.get_paper(paper_id)
    except PaperDataNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PaperDataError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    detail = paper_to_detail(paper)
    await cache_service.set_json(cache_key, detail.model_dump(mode="json"), settings.cache_ttl_paper)
    return detail
