from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PaperSummary(BaseModel):
    paper_id: str
    title: str
    authors: list[str]
    year: Optional[int] = None
    citation_count: int = 0
    abstract: Optional[str] = None


class SourceLink(BaseModel):
    kind: str
    href: str
    primary: bool = False


class PaperDetail(PaperSummary):
    venue: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    reference_count: Optional[int] = None
    external_ids: dict[str, str] = Field(default_factory=dict)
    source_links: list[SourceLink] = Field(default_factory=list)


class GraphNode(BaseModel):
    id: str
    title: str
    year: Optional[int] = None
    citation_count: int = 0
    abstract: Optional[str] = None
    authors: list[str]
    url: Optional[str] = None
    is_seed: bool = False


class GraphEdge(BaseModel):
    source: str
    target: str
    weight: float


class WorkItem(BaseModel):
    paper_id: str
    title: str
    year: Optional[int] = None
    citation_count: int = 0
    authors: list[str] = []
    doi: Optional[str] = None
    url: Optional[str] = None


class PriorDerivativeResponse(BaseModel):
    prior_works: list[WorkItem]
    derivative_works: list[WorkItem]


class GraphResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    nodes: list[GraphNode]
    edges: list[GraphEdge]
    seed_paper_id: str
    mode: str = "citation"
    warning: Optional[str] = None
    prior_works: list[WorkItem] = []
    derivative_works: list[WorkItem] = []
