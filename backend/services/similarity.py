from __future__ import annotations

import itertools
import math
import re
from collections.abc import Iterable
from typing import Any

import networkx as nx

from backend.config import Settings
from backend.models.schemas import GraphEdge, GraphResponse
from backend.services.cache import CacheService
from backend.services.paper_data import PaperDataClient, PaperDataError
from backend.services.semantic_scholar import paper_to_graph_node, paper_to_work_item

TOPIC_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
TOPIC_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "to",
    "using",
    "with",
}
TOPIC_GENERIC_TERMS = {
    "approach",
    "automatic",
    "based",
    "data",
    "deep",
    "ensemble",
    "feature",
    "features",
    "framework",
    "fusion",
    "image",
    "imagery",
    "images",
    "learning",
    "method",
    "methods",
    "model",
    "models",
    "multi",
    "network",
    "scale",
    "study",
    "system",
}


def bibliographic_coupling(reference_ids_a: set[str], reference_ids_b: set[str]) -> float:
    return _cosine_overlap(reference_ids_a, reference_ids_b)


def co_citation(citation_ids_a: set[str], citation_ids_b: set[str]) -> float:
    return _cosine_overlap(citation_ids_a, citation_ids_b)


def combine_similarity(
    reference_ids_a: set[str],
    reference_ids_b: set[str],
    citation_ids_a: set[str],
    citation_ids_b: set[str],
) -> float:
    return 0.5 * bibliographic_coupling(reference_ids_a, reference_ids_b) + 0.5 * co_citation(
        citation_ids_a, citation_ids_b
    )


def build_graph_response(
    paper_lookup: dict[str, dict[str, Any]],
    seed_paper_id: str,
    threshold: float,
    node_max: int,
    edge_max: int,
) -> GraphResponse:
    paper_ids = [
        paper_id for paper_id in paper_lookup
        if paper_id and (
            paper_id == seed_paper_id
            or _real_title(paper_lookup[paper_id].get("title"))
        )
    ]
    similarity_edges: list[GraphEdge] = []

    ref_sets = {paper_id: _extract_linked_ids(paper_lookup[paper_id].get("references")) for paper_id in paper_ids}
    cite_sets = {paper_id: _extract_linked_ids(paper_lookup[paper_id].get("citations")) for paper_id in paper_ids}

    for source_id, target_id in itertools.combinations(paper_ids, 2):
        weight = combine_similarity(ref_sets[source_id], ref_sets[target_id], cite_sets[source_id], cite_sets[target_id])
        if weight >= threshold:
            similarity_edges.append(
                GraphEdge(source=source_id, target=target_id, weight=round(weight, 4))
            )

    if not similarity_edges:
        seed_only = paper_lookup[seed_paper_id]
        return GraphResponse(nodes=[paper_to_graph_node(seed_only, seed_paper_id)], edges=[], seed_paper_id=seed_paper_id)

    graph = nx.Graph()
    for edge in similarity_edges:
        graph.add_edge(edge.source, edge.target, weight=edge.weight)

    if seed_paper_id not in graph:
        graph.add_node(seed_paper_id)

    if graph.number_of_nodes() > node_max:
        degree_rank = sorted(graph.degree(weight="weight"), key=lambda item: item[1], reverse=True)
        keep_nodes = [seed_paper_id]
        keep_nodes.extend(node_id for node_id, _ in degree_rank if node_id != seed_paper_id)
        graph = graph.subgraph(keep_nodes[:node_max]).copy()

    if graph.number_of_edges() > edge_max:
        top_edges = sorted(graph.edges(data=True), key=lambda item: item[2]["weight"], reverse=True)[:edge_max]
        trimmed_graph = nx.Graph()
        trimmed_graph.add_nodes_from(graph.nodes(data=True))
        trimmed_graph.add_weighted_edges_from((source, target, data["weight"]) for source, target, data in top_edges)
        graph = trimmed_graph

    isolated_nodes = [node_id for node_id in graph.nodes if graph.degree(node_id) == 0 and node_id != seed_paper_id]
    if isolated_nodes:
        graph.remove_nodes_from(isolated_nodes)

    ordered_node_ids = _ordered_nodes(graph, seed_paper_id)
    nodes = [paper_to_graph_node(paper_lookup[node_id], seed_paper_id) for node_id in ordered_node_ids]
    edges = [
        GraphEdge(source=source, target=target, weight=round(data["weight"], 4))
        for source, target, data in sorted(
            graph.edges(data=True), key=lambda item: item[2]["weight"], reverse=True
        )
    ]

    return GraphResponse(nodes=nodes, edges=edges, seed_paper_id=seed_paper_id)


class SimilarityEngine:
    def __init__(
        self,
        settings: Settings,
        paper_client: PaperDataClient,
        cache_service: CacheService,
    ) -> None:
        self.settings = settings
        self.paper_client = paper_client
        self.cache_service = cache_service

    async def build_graph(self, seed_paper_id: str) -> GraphResponse:
        cache_key = f"paper_graph:{seed_paper_id}"
        cached_graph = await self.cache_service.get_json(cache_key)
        if cached_graph:
            return GraphResponse.model_validate(cached_graph)

        seed_paper = await self.paper_client.get_paper(seed_paper_id)
        if _should_use_topic_fallback(seed_paper):
            graph_response = await self._build_topic_fallback_graph(seed_paper_id, seed_paper)
            await self.cache_service.set_json(
                cache_key,
                graph_response.model_dump(mode="json"),
                self.settings.cache_ttl_graph,
            )
            return graph_response

        candidate_limit = min(self.settings.max_candidates, self.settings.graph_node_max + 12)
        candidates = _collect_candidates(seed_paper)[:candidate_limit]
        candidate_ids = [seed_paper_id, *[paper["paperId"] for paper in candidates]]

        papers = await self.paper_client.get_papers_batch(candidate_ids)
        paper_lookup = {
            paper["paperId"]: paper
            for paper in papers
            if paper.get("paperId") and _real_title(paper.get("title"))
        }
        paper_lookup[seed_paper_id] = _merge_seed_details(seed_paper, paper_lookup.get(seed_paper_id))

        graph_response = build_graph_response(
            paper_lookup=paper_lookup,
            seed_paper_id=seed_paper_id,
            threshold=self.settings.similarity_threshold,
            node_max=self.settings.graph_node_max,
            edge_max=self.settings.graph_edge_max,
        )

        if len(graph_response.nodes) < self.settings.graph_node_min and len(candidate_ids) >= self.settings.graph_node_min:
            relaxed_response = build_graph_response(
                paper_lookup=paper_lookup,
                seed_paper_id=seed_paper_id,
                threshold=self.settings.fallback_threshold,
                node_max=self.settings.graph_node_max,
                edge_max=self.settings.graph_edge_max,
            )
            if len(relaxed_response.nodes) > len(graph_response.nodes):
                graph_response = relaxed_response

        prior_works, derivative_works = _extract_prior_derivative(seed_paper, paper_lookup, seed_paper_id)
        graph_response = graph_response.model_copy(
            update={"prior_works": prior_works, "derivative_works": derivative_works}
        )

        await self.cache_service.set_json(
            cache_key,
            graph_response.model_dump(mode="json"),
            self.settings.cache_ttl_graph,
        )
        return graph_response

    async def _build_topic_fallback_graph(self, seed_paper_id: str, seed_paper: dict[str, Any]) -> GraphResponse:
        queries = _topic_queries(seed_paper)
        candidate_limit = min(self.settings.graph_node_max - 1, 24)
        source: str | None = None
        candidate_ids: list[str] = []
        candidate_summaries: dict[str, dict[str, Any]] = {}
        seen_candidate_ids: set[str] = set()

        for query in queries:
            if not query:
                continue

            try:
                next_source, results = await self.paper_client.search_indexed_papers(query, limit=max(candidate_limit, 12))
            except PaperDataError:
                continue

            if not results:
                continue

            if source is None:
                source = next_source

            if source != next_source:
                continue

            for paper in results:
                paper_id = paper.get("paperId")
                if not paper_id or paper_id in seen_candidate_ids or _is_same_paper(seed_paper, paper):
                    continue
                seen_candidate_ids.add(paper_id)
                candidate_ids.append(paper_id)
                candidate_summaries[paper_id] = paper
                if len(candidate_ids) >= candidate_limit:
                    break

            if len(candidate_ids) >= self.settings.graph_node_min - 1:
                break

        if not source or not candidate_ids:
            return GraphResponse(
                nodes=[paper_to_graph_node(seed_paper, seed_paper_id)],
                edges=[],
                seed_paper_id=seed_paper_id,
                mode="topic_fallback",
                warning="该论文尚未进入引文索引，暂时无法生成真实引用图谱。",
            )

        detailed_papers = await self.paper_client.get_papers_batch_from_source(source, candidate_ids)
        detailed_lookup = {paper["paperId"]: paper for paper in detailed_papers if paper.get("paperId")}
        paper_lookup: dict[str, dict[str, Any]] = {}
        for paper_id in candidate_ids:
            merged_paper = _merge_paper_data(candidate_summaries.get(paper_id), detailed_lookup.get(paper_id))
            if merged_paper and _real_title(merged_paper.get("title")):
                paper_lookup[paper_id] = merged_paper
        seed_tokens = _topic_tokens(seed_paper)
        scored_candidates: list[tuple[str, float]] = []

        for paper_id in candidate_ids:
            paper = paper_lookup.get(paper_id)
            if not paper:
                continue
            score = _topic_similarity(seed_tokens, _topic_tokens(paper))
            if score <= 0:
                continue
            scored_candidates.append((paper_id, score))

        scored_candidates.sort(
            key=lambda item: (item[1], paper_lookup[item[0]].get("citationCount") or 0),
            reverse=True,
        )
        kept_candidates = scored_candidates[:candidate_limit]

        if not kept_candidates:
            return GraphResponse(
                nodes=[paper_to_graph_node(seed_paper, seed_paper_id)],
                edges=[],
                seed_paper_id=seed_paper_id,
                mode="topic_fallback",
                warning="该论文已定位，但相关索引还不足以构建主题相似图。",
            )

        graph = nx.Graph()
        graph.add_node(seed_paper_id)
        kept_ids = [paper_id for paper_id, _ in kept_candidates]
        for paper_id, score in kept_candidates:
            graph.add_node(paper_id)
            graph.add_edge(seed_paper_id, paper_id, weight=round(max(score, self.settings.similarity_threshold), 4))

        ref_sets = {paper_id: _extract_linked_ids(paper_lookup[paper_id].get("references")) for paper_id in kept_ids}
        cite_sets = {paper_id: _extract_linked_ids(paper_lookup[paper_id].get("citations")) for paper_id in kept_ids}
        for source_id, target_id in itertools.combinations(kept_ids, 2):
            weight = combine_similarity(ref_sets[source_id], ref_sets[target_id], cite_sets[source_id], cite_sets[target_id])
            if weight >= self.settings.similarity_threshold:
                graph.add_edge(source_id, target_id, weight=round(weight, 4))

        ordered_node_ids = _ordered_nodes(graph, seed_paper_id)
        response_lookup = {paper_id: paper_lookup[paper_id] for paper_id in kept_ids if paper_id in paper_lookup}
        response_lookup[seed_paper_id] = seed_paper

        return GraphResponse(
            nodes=[paper_to_graph_node(response_lookup[node_id], seed_paper_id) for node_id in ordered_node_ids],
            edges=[
                GraphEdge(source=source, target=target, weight=round(data["weight"], 4))
                for source, target, data in sorted(
                    graph.edges(data=True), key=lambda item: item[2]["weight"], reverse=True
                )
            ],
            seed_paper_id=seed_paper_id,
            mode="topic_fallback",
            warning="该论文尚未进入 Semantic Scholar/OpenAlex，引文图谱已切换为主题相似回退图。",
        )


def _extract_prior_derivative(
    seed_paper: dict[str, Any],
    paper_lookup: dict[str, dict[str, Any]],
    seed_paper_id: str,
) -> tuple[list, list]:
    """Return (prior_works, derivative_works) WorkItems from already-fetched paper_lookup."""
    from backend.models.schemas import WorkItem  # local import avoids circular

    seed_year: int | None = seed_paper.get("year")
    ref_ids = {r["paperId"] for r in (seed_paper.get("references") or []) if r.get("paperId")}
    cite_ids = {c["paperId"] for c in (seed_paper.get("citations") or []) if c.get("paperId")}

    prior: list[WorkItem] = []
    derivative: list[WorkItem] = []
    for pid, paper in paper_lookup.items():
        if pid == seed_paper_id or not pid or not _real_title(paper.get("title")):
            continue
        paper_year: int | None = paper.get("year")
        if pid in ref_ids:
            if seed_year and paper_year and paper_year > seed_year:
                continue
            item = paper_to_work_item(paper)
            if item:
                prior.append(item)
        elif pid in cite_ids:
            if seed_year and paper_year and paper_year < seed_year:
                continue
            item = paper_to_work_item(paper)
            if item:
                derivative.append(item)

    prior.sort(key=lambda x: x.citation_count, reverse=True)
    derivative.sort(key=lambda x: x.citation_count, reverse=True)
    return prior, derivative


def _cosine_overlap(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    shared = len(left & right)
    denominator = math.sqrt(len(left) * len(right))
    if denominator == 0:
        return 0.0
    return shared / denominator


def _real_title(title: str | None) -> bool:
    """Return True only if title is a non-empty, non-placeholder string."""
    t = (title or "").strip()
    return bool(t) and t.lower() not in {"untitled paper", "untitled"}


def _extract_linked_ids(items: Iterable[dict[str, Any]] | None) -> set[str]:
    return {item["paperId"] for item in (items or []) if item and item.get("paperId")}


def _collect_candidates(seed_paper: dict[str, Any]) -> list[dict[str, Any]]:
    candidate_map: dict[str, dict[str, Any]] = {}

    for paper in (seed_paper.get("references") or []) + (seed_paper.get("citations") or []):
        paper_id = paper.get("paperId")
        if not paper_id:
            continue

        existing = candidate_map.get(paper_id)
        citation_count = paper.get("citationCount") or 0
        if existing is None or citation_count > (existing.get("citationCount") or 0):
            candidate_map[paper_id] = paper

    ranked_candidates = sorted(
        candidate_map.values(),
        key=lambda item: item.get("citationCount") or 0,
        reverse=True,
    )
    return ranked_candidates


def _merge_seed_details(seed_paper: dict[str, Any], batch_paper: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(batch_paper or {})
    merged.update(seed_paper)
    return merged


def _ordered_nodes(graph: nx.Graph, seed_paper_id: str) -> list[str]:
    ranked = sorted(graph.degree(weight="weight"), key=lambda item: item[1], reverse=True)
    ordered = [seed_paper_id] if seed_paper_id in graph else []
    ordered.extend(node_id for node_id, _ in ranked if node_id != seed_paper_id)
    return ordered


def _should_use_topic_fallback(seed_paper: dict[str, Any]) -> bool:
    return (
        seed_paper.get("source") == "frontiers"
        or (not seed_paper.get("references") and not seed_paper.get("citations"))
    )


def _topic_queries(seed_paper: dict[str, Any]) -> list[str]:
    terms = _core_topic_terms(seed_paper)
    queries: list[str] = []
    if len(terms) >= 3:
        queries.append(" ".join(terms[:4]))

    seed_text = f"{seed_paper.get('title') or ''} {seed_paper.get('abstract') or ''}".lower()
    if "remote sensing" in seed_text and len(terms) >= 2:
        queries.append(" ".join([*terms[:4], "remote", "sensing"]))

    title = (seed_paper.get("title") or "").strip()
    if title:
        queries.append(title)

    deduped_queries: list[str] = []
    for query in queries:
        if query and query not in deduped_queries:
            deduped_queries.append(query)
    return deduped_queries


def _core_topic_terms(seed_paper: dict[str, Any]) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for token in TOPIC_TOKEN_PATTERN.findall((seed_paper.get("title") or "").lower()):
        if token in TOPIC_STOPWORDS or token in TOPIC_GENERIC_TERMS or len(token) < 4:
            continue
        if token not in seen:
            seen.add(token)
            terms.append(token)

    if len(terms) >= 3:
        return terms

    for token in TOPIC_TOKEN_PATTERN.findall((seed_paper.get("abstract") or "").lower()):
        if token in TOPIC_STOPWORDS or token in TOPIC_GENERIC_TERMS or len(token) < 4:
            continue
        if token not in seen:
            seen.add(token)
            terms.append(token)
        if len(terms) >= 6:
            break
    return terms


def _topic_tokens(paper: dict[str, Any]) -> set[str]:
    tokens: set[str] = set()
    for field in ("title", "abstract"):
        for token in TOPIC_TOKEN_PATTERN.findall((paper.get(field) or "").lower()):
            if token in TOPIC_STOPWORDS or token in TOPIC_GENERIC_TERMS or len(token) < 4:
                continue
            tokens.add(token)
    return tokens


def _topic_similarity(seed_tokens: set[str], candidate_tokens: set[str]) -> float:
    return _cosine_overlap(seed_tokens, candidate_tokens)


def _is_same_paper(left: dict[str, Any], right: dict[str, Any]) -> bool:
    if left.get("paperId") and left.get("paperId") == right.get("paperId"):
        return True

    left_doi = ((left.get("externalIds") or {}).get("DOI") or "").lower()
    right_doi = ((right.get("externalIds") or {}).get("DOI") or "").lower()
    if left_doi and right_doi and left_doi == right_doi:
        return True

    return _normalize_title(left.get("title")) == _normalize_title(right.get("title"))


def _normalize_title(title: str | None) -> str:
    return " ".join(TOPIC_TOKEN_PATTERN.findall((title or "").lower()))


def _merge_paper_data(summary_paper: dict[str, Any] | None, detail_paper: dict[str, Any] | None) -> dict[str, Any] | None:
    if not summary_paper and not detail_paper:
        return None

    merged = dict(summary_paper or {})
    for key, value in (detail_paper or {}).items():
        if key in {"references", "citations"}:
            merged[key] = value
            continue
        if value not in (None, "", [], {}):
            merged[key] = value
    return merged
