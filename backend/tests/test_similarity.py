from __future__ import annotations

from backend.services.similarity import (
    bibliographic_coupling,
    build_graph_response,
    co_citation,
    combine_similarity,
)


def _paper(paper_id: str, references: list[str], citations: list[str], citation_count: int = 10):
    return {
        "paperId": paper_id,
        "title": paper_id,
        "authors": [{"name": paper_id}],
        "year": 2020,
        "citationCount": citation_count,
        "abstract": f"abstract-{paper_id}",
        "references": [{"paperId": item} for item in references],
        "citations": [{"paperId": item} for item in citations],
    }


def test_similarity_functions_return_expected_values():
    left_refs = {"a", "b", "c"}
    right_refs = {"b", "c", "d"}
    left_cites = {"x", "y"}
    right_cites = {"y", "z"}

    assert round(bibliographic_coupling(left_refs, right_refs), 4) == 0.6667
    assert round(co_citation(left_cites, right_cites), 4) == 0.5
    assert round(combine_similarity(left_refs, right_refs, left_cites, right_cites), 4) == 0.5833


def test_build_graph_response_prunes_dense_graph():
    paper_lookup = {"seed": _paper("seed", ["r1", "r2"], ["c1", "c2"], citation_count=100)}

    for index in range(1, 95):
        paper_lookup[f"paper-{index}"] = _paper(
            f"paper-{index}",
            ["r1", f"r{index + 2}"],
            ["c1", f"c{index + 2}"],
            citation_count=max(1, 100 - index),
        )

    response = build_graph_response(
        paper_lookup=paper_lookup,
        seed_paper_id="seed",
        threshold=0.05,
        node_max=80,
        edge_max=300,
    )

    assert len(response.nodes) <= 80
    assert len(response.edges) <= 300
    assert response.nodes[0].id == "seed"


def test_build_graph_response_returns_seed_when_graph_is_sparse():
    response = build_graph_response(
        paper_lookup={
            "seed": _paper("seed", ["r1"], ["c1"]),
            "other": _paper("other", ["r2"], ["c2"]),
        },
        seed_paper_id="seed",
        threshold=0.9,
        node_max=80,
        edge_max=300,
    )

    assert response.seed_paper_id == "seed"
    assert len(response.nodes) == 1
    assert response.edges == []
