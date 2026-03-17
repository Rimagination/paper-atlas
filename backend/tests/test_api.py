from __future__ import annotations

import asyncio

import httpx
import respx

from backend.services.cache import CacheService
from backend.services.semantic_scholar import SemanticScholarClient


@respx.mock
def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@respx.mock
def test_search_returns_title_matches(client):
    route = respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {
                        "paperId": "paper-1",
                        "title": "Attention Is All You Need",
                        "authors": [{"name": "Ashish Vaswani"}],
                        "year": 2017,
                        "citationCount": 1000,
                        "abstract": "Transformer paper",
                    }
                ]
            },
        )
    )

    response = client.get("/search", params={"q": "attention"})

    assert response.status_code == 200
    assert route.called
    assert response.json()[0]["paper_id"] == "paper-1"


@respx.mock
def test_search_falls_back_when_doi_lookup_misses(client):
    doi_route = respx.get(
        "https://api.semanticscholar.org/graph/v1/paper/DOI%3A10.1000%2Fxyz123"
    ).mock(return_value=httpx.Response(404))
    openalex_route = respx.get("https://api.openalex.org/works").mock(
        return_value=httpx.Response(200, json={"results": []})
    )
    search_route = respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {
                        "paperId": "paper-2",
                        "title": "Fallback Search Result",
                        "authors": [{"name": "Jane Doe"}],
                        "year": 2021,
                        "citationCount": 24,
                        "abstract": "Fallback hit",
                    }
                ]
            },
        )
    )

    response = client.get("/search", params={"q": "10.1000/xyz123"})

    assert response.status_code == 200
    assert doi_route.called
    assert openalex_route.called
    assert search_route.called
    assert response.json()[0]["paper_id"] == "paper-2"


@respx.mock
def test_paper_detail_route_maps_fields_and_uses_cache(client):
    route = respx.post("https://api.semanticscholar.org/graph/v1/paper/batch").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "paperId": "paper-3",
                    "title": "Cached Detail Paper",
                    "authors": [{"name": "Ada Lovelace"}],
                    "year": 2020,
                    "citationCount": 42,
                    "abstract": "Detailed abstract",
                    "venue": "NeurIPS",
                    "externalIds": {"DOI": "10.1000/cache"},
                    "references": [{"paperId": "ref-1"}],
                }
            ],
        )
    )

    first = client.get("/paper/paper-3")
    second = client.get("/paper/paper-3")

    assert first.status_code == 200
    assert second.status_code == 200
    assert route.call_count == 1
    assert "fields=" in str(route.calls[0].request.url)
    assert first.json()["url"] == "https://doi.org/10.1000/cache"
    assert first.json()["venue"] == "NeurIPS"


@respx.mock
def test_paper_detail_route_retries_with_fresh_semantic_client_on_transient_failure(client):
    route = respx.post("https://api.semanticscholar.org/graph/v1/paper/batch").mock(
        side_effect=[
            httpx.Response(429, json={"error": "rate limited"}),
            httpx.Response(
                200,
                json=[
                    {
                        "paperId": "paper-4",
                        "title": "Recovered Detail Paper",
                        "authors": [{"name": "Grace Hopper"}],
                        "year": 2019,
                        "citationCount": 77,
                        "abstract": "Recovered after retry",
                        "venue": "Science",
                        "references": [{"paperId": "ref-1"}],
                    }
                ],
            ),
        ]
    )

    response = client.get("/paper/paper-4")

    assert response.status_code == 200
    assert route.call_count == 2
    assert response.json()["paper_id"] == "paper-4"
    assert response.json()["title"] == "Recovered Detail Paper"


@respx.mock
def test_graph_route_returns_graph_response(client):
    respx.get("https://api.semanticscholar.org/graph/v1/paper/seed").mock(
        return_value=httpx.Response(
            200,
            json={
                "paperId": "seed",
                "title": "Seed",
                "authors": [{"name": "Author Seed"}],
                "year": 2022,
                "citationCount": 100,
                "abstract": "Seed abstract",
                "references": [
                    {"paperId": "paper-a", "citationCount": 40},
                    {"paperId": "paper-b", "citationCount": 30},
                ],
                "citations": [
                    {"paperId": "paper-c", "citationCount": 20},
                ],
            },
        )
    )
    batch_route = respx.post("https://api.semanticscholar.org/graph/v1/paper/batch").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "paperId": "seed",
                    "title": "Seed",
                    "authors": [{"name": "Author Seed"}],
                    "year": 2022,
                    "citationCount": 100,
                    "abstract": "Seed abstract",
                    "references": [{"paperId": "r1"}, {"paperId": "r2"}],
                    "citations": [{"paperId": "c1"}, {"paperId": "c2"}],
                },
                {
                    "paperId": "paper-a",
                    "title": "Paper A",
                    "authors": [{"name": "Author A"}],
                    "year": 2021,
                    "citationCount": 40,
                    "abstract": "A",
                    "references": [{"paperId": "r1"}, {"paperId": "r2"}, {"paperId": "r3"}],
                    "citations": [{"paperId": "c1"}],
                },
                {
                    "paperId": "paper-b",
                    "title": "Paper B",
                    "authors": [{"name": "Author B"}],
                    "year": 2020,
                    "citationCount": 30,
                    "abstract": "B",
                    "references": [{"paperId": "r1"}, {"paperId": "r4"}],
                    "citations": [{"paperId": "c2"}],
                },
                {
                    "paperId": "paper-c",
                    "title": "Paper C",
                    "authors": [{"name": "Author C"}],
                    "year": 2019,
                    "citationCount": 20,
                    "abstract": "C",
                    "references": [{"paperId": "r5"}],
                    "citations": [{"paperId": "c1"}, {"paperId": "c2"}],
                },
            ],
        )
    )

    response = client.get("/graph/seed")

    assert response.status_code == 200
    assert batch_route.called
    payload = response.json()
    assert payload["seed_paper_id"] == "seed"
    assert any(node["is_seed"] for node in payload["nodes"])
    assert payload["edges"]


@respx.mock
def test_search_falls_back_to_openalex_on_rate_limit(client):
    respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    openalex_route = respx.get("https://api.openalex.org/works").mock(
        return_value=httpx.Response(
            200,
            json={
                "results": [
                    {
                        "id": "https://openalex.org/W7134227096",
                        "display_name": "OOA-LightGBM",
                        "publication_year": 2026,
                        "cited_by_count": 0,
                        "authorships": [{"author": {"display_name": "Ziheng Luo"}}],
                        "primary_location": {
                            "landing_page_url": "https://doi.org/10.1000/openalex",
                            "source": {"display_name": "Earth Systems and Environment"},
                        },
                        "doi": "https://doi.org/10.1000/openalex",
                        "referenced_works": [],
                        "related_works": [],
                    }
                ]
            },
        )
    )

    response = client.get("/search", params={"q": "OOA-LightGBM"})

    assert response.status_code == 200
    assert openalex_route.called
    assert response.json()[0]["paper_id"] == "W7134227096"


@respx.mock
def test_search_prefers_fresh_semantic_exact_match_for_full_title(client):
    query = "Attention Is All You Need"
    semantic_route = respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        side_effect=[
            httpx.Response(429, json={"error": "rate limited"}),
            httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "paperId": "semantic-attention",
                            "title": "Attention Is All You Need",
                            "authors": [{"name": "Ashish Vaswani"}],
                            "year": 2017,
                            "citationCount": 169377,
                            "abstract": "Transformer paper",
                            "venue": "NeurIPS",
                            "externalIds": {"ArXiv": "1706.03762"},
                            "url": "https://www.semanticscholar.org/paper/semantic-attention",
                        }
                    ]
                },
            ),
        ]
    )
    openalex_route = respx.get("https://api.openalex.org/works").mock(
        return_value=httpx.Response(200, json={"results": []})
    )

    response = client.get("/search", params={"q": query})

    assert response.status_code == 200
    assert semantic_route.call_count == 2
    assert not openalex_route.called
    assert response.json() == [
        {
            "paper_id": "semantic-attention",
            "title": "Attention Is All You Need",
            "authors": ["Ashish Vaswani"],
            "year": 2017,
            "citation_count": 169377,
            "abstract": "Transformer paper",
        }
    ]


@respx.mock
def test_openalex_exact_match_uses_semantic_arxiv_lookup(client):
    respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    respx.get("https://api.openalex.org/works").mock(
        return_value=httpx.Response(
            200,
            json={
                "results": [
                    {
                        "id": "https://openalex.org/W2626778328",
                        "display_name": "Attention Is All You Need",
                        "publication_year": 2025,
                        "cited_by_count": 6504,
                        "authorships": [{"author": {"display_name": "Ashish Vaswani"}}],
                        "primary_location": {
                            "landing_page_url": "https://doi.org/10.65215/2q58a426",
                            "source": None,
                        },
                        "ids": {
                            "openalex": "https://openalex.org/W2626778328",
                            "doi": "https://doi.org/10.48550/arXiv.1706.03762",
                        },
                        "doi": "https://doi.org/10.65215/2q58a426",
                        "referenced_works": [],
                        "related_works": [],
                    }
                ]
            },
        )
    )
    respx.get("https://api.openalex.org/works/W2626778328").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "https://openalex.org/W2626778328",
                "display_name": "Attention Is All You Need",
                "publication_year": 2025,
                "cited_by_count": 6504,
                "authorships": [{"author": {"display_name": "Ashish Vaswani"}}],
                "primary_location": {
                    "landing_page_url": "https://doi.org/10.65215/2q58a426",
                    "source": None,
                },
                "ids": {
                    "openalex": "https://openalex.org/W2626778328",
                    "doi": "https://doi.org/10.48550/arXiv.1706.03762",
                },
                "doi": "https://doi.org/10.65215/2q58a426",
                "referenced_works": [],
                "related_works": [],
            },
        )
    )
    semantic_arxiv_route = respx.get(
        "https://api.semanticscholar.org/graph/v1/paper/ARXIV%3A1706.03762"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "paperId": "204e3073870fae3d05bcbc2f6a8e263d9b72e776",
                "title": "Attention is All you Need",
                "authors": [{"name": "Ashish Vaswani"}],
                "year": 2017,
                "citationCount": 169377,
                "abstract": "Transformer paper",
                "venue": "Neural Information Processing Systems",
                "externalIds": {"ArXiv": "1706.03762"},
                "url": "https://www.semanticscholar.org/paper/204e3073870fae3d05bcbc2f6a8e263d9b72e776",
                "references": [{"paperId": "ref-1"}],
            },
        )
    )

    search_response = client.get("/search", params={"q": "Attention Is All You Need"})
    detail_response = client.get("/paper/W2626778328")

    assert search_response.status_code == 200
    assert detail_response.status_code == 200
    assert semantic_arxiv_route.called
    assert search_response.json()[0]["year"] == 2017
    assert search_response.json()[0]["citation_count"] == 169377
    assert detail_response.json()["year"] == 2017
    assert detail_response.json()["citation_count"] == 169377
    assert detail_response.json()["doi"] == "10.48550/arXiv.1706.03762"


@respx.mock
def test_search_returns_exact_frontiers_match_for_full_title(client):
    query = "A Multi-scale Feature Fusion Framework for Urban Functional Zone Identification Using Automatic Ensemble Learning Method"
    respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {
                        "paperId": "irrelevant-1",
                        "title": "Urban Functional Zone Mapping Review",
                        "authors": [{"name": "Reviewer"}],
                        "year": 2024,
                        "citationCount": 12,
                        "abstract": "Not the requested paper",
                    }
                ]
            },
        )
    )
    frontiers_route = respx.post("https://www.frontiersin.org/api/v2/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "TopResults": {
                    "Articles": [
                        {
                            "ArticleId": 1736773,
                            "Doi": "10.3389/frsc.2026.1736773",
                            "Title": query,
                            "Abstract": "Urban functional zone abstract",
                            "PublicUrl": "https://www.frontiersin.org/articles/10.3389/frsc.2026.1736773",
                            "Authors": [{"FullName": "Tianming Zhang"}],
                            "Journal": {"Title": "Frontiers in Sustainable Cities"},
                            "Impact": {"Citations": {"Count": 0}},
                        }
                    ]
                }
            },
        )
    )

    response = client.get("/search", params={"q": query})

    assert response.status_code == 200
    assert frontiers_route.called
    assert response.json()[0]["paper_id"] == "FRONTIERS:1736773"


@respx.mock
def test_graph_route_falls_back_to_openalex(client):
    respx.get("https://api.semanticscholar.org/graph/v1/paper/W7134227096").mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    respx.post("https://api.semanticscholar.org/graph/v1/paper/batch").mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    openalex_seed_route = respx.get("https://api.openalex.org/works/W7134227096").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "https://openalex.org/W7134227096",
                "display_name": "OOA-LightGBM",
                "publication_year": 2026,
                "cited_by_count": 0,
                "authorships": [{"author": {"display_name": "Ziheng Luo"}}],
                "primary_location": {
                    "landing_page_url": "https://doi.org/10.1000/openalex",
                    "source": {"display_name": "Earth Systems and Environment"},
                },
                "doi": "https://doi.org/10.1000/openalex",
                "referenced_works": [
                    "https://openalex.org/W1",
                    "https://openalex.org/W2",
                    "https://openalex.org/W3",
                ],
                "related_works": [],
            },
        )
    )
    openalex_batch_route = respx.get("https://api.openalex.org/works").mock(
        side_effect=[
            httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "id": "https://openalex.org/W7134227096",
                            "display_name": "OOA-LightGBM",
                            "publication_year": 2026,
                            "cited_by_count": 0,
                            "authorships": [{"author": {"display_name": "Ziheng Luo"}}],
                            "primary_location": {
                                "landing_page_url": "https://doi.org/10.1000/openalex",
                                "source": {"display_name": "Earth Systems and Environment"},
                            },
                            "doi": "https://doi.org/10.1000/openalex",
                            "referenced_works": [
                                "https://openalex.org/W1",
                                "https://openalex.org/W2",
                                "https://openalex.org/W3",
                            ],
                            "related_works": [],
                        },
                        {
                            "id": "https://openalex.org/W1",
                            "display_name": "Paper 1",
                            "publication_year": 2023,
                            "cited_by_count": 5,
                            "authorships": [{"author": {"display_name": "A1"}}],
                            "primary_location": {"source": {"display_name": "Journal 1"}},
                            "referenced_works": [
                                "https://openalex.org/R1",
                                "https://openalex.org/R2",
                            ],
                            "related_works": ["https://openalex.org/C1"],
                        },
                        {
                            "id": "https://openalex.org/W2",
                            "display_name": "Paper 2",
                            "publication_year": 2022,
                            "cited_by_count": 8,
                            "authorships": [{"author": {"display_name": "A2"}}],
                            "primary_location": {"source": {"display_name": "Journal 2"}},
                            "referenced_works": [
                                "https://openalex.org/R1",
                                "https://openalex.org/R3",
                            ],
                            "related_works": ["https://openalex.org/C1"],
                        },
                        {
                            "id": "https://openalex.org/W3",
                            "display_name": "Paper 3",
                            "publication_year": 2021,
                            "cited_by_count": 3,
                            "authorships": [{"author": {"display_name": "A3"}}],
                            "primary_location": {"source": {"display_name": "Journal 3"}},
                            "referenced_works": ["https://openalex.org/R8"],
                            "related_works": [],
                        },
                    ]
                },
            )
        ]
    )

    response = client.get("/graph/W7134227096")

    assert response.status_code == 200
    assert openalex_seed_route.called
    assert openalex_batch_route.called
    payload = response.json()
    assert payload["seed_paper_id"] == "W7134227096"
    assert len(payload["nodes"]) >= 2
    assert payload["edges"]


@respx.mock
def test_openalex_exact_match_is_repaired_with_dblp_when_semantic_is_unavailable(client):
    semantic_route = respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    semantic_arxiv_route = respx.get(
        "https://api.semanticscholar.org/graph/v1/paper/ARXIV%3A1706.03762"
    ).mock(return_value=httpx.Response(429, json={"error": "rate limited"}))
    openalex_route = respx.get("https://api.openalex.org/works").mock(
        return_value=httpx.Response(
            200,
            json={
                "results": [
                    {
                        "id": "https://openalex.org/W2626778328",
                        "display_name": "Attention Is All You Need",
                        "publication_year": 2025,
                        "cited_by_count": 6504,
                        "authorships": [{"author": {"display_name": "Ashish Vaswani"}}],
                        "primary_location": {
                            "landing_page_url": "https://doi.org/10.65215/2q58a426",
                            "source": None,
                        },
                        "ids": {
                            "openalex": "https://openalex.org/W2626778328",
                            "doi": "https://doi.org/10.48550/arXiv.1706.03762",
                        },
                        "doi": "https://doi.org/10.65215/2q58a426",
                        "referenced_works": [],
                        "related_works": [],
                    }
                ]
            },
        )
    )
    openalex_detail_route = respx.get("https://api.openalex.org/works/W2626778328").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "https://openalex.org/W2626778328",
                "display_name": "Attention Is All You Need",
                "publication_year": 2025,
                "cited_by_count": 6504,
                "authorships": [{"author": {"display_name": "Ashish Vaswani"}}],
                "primary_location": {
                    "landing_page_url": "https://doi.org/10.65215/2q58a426",
                    "source": None,
                },
                "ids": {
                    "openalex": "https://openalex.org/W2626778328",
                    "doi": "https://doi.org/10.48550/arXiv.1706.03762",
                },
                "doi": "https://doi.org/10.65215/2q58a426",
                "referenced_works": [],
                "related_works": [],
            },
        )
    )
    dblp_route = respx.get("https://dblp.org/search/publ/api").mock(
        return_value=httpx.Response(
            200,
            json={
                "result": {
                    "hits": {
                        "hit": [
                            {
                                "info": {
                                    "title": "Attention is All you Need.",
                                    "venue": "NIPS",
                                    "year": "2017",
                                    "type": "Conference and Workshop Papers",
                                    "ee": "https://proceedings.neurips.cc/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html",
                                    "authors": {
                                        "author": [
                                            {"text": "Ashish Vaswani"},
                                            {"text": "Noam Shazeer"},
                                        ]
                                    },
                                }
                            }
                        ]
                    }
                }
            },
        )
    )

    search_response = client.get("/search", params={"q": "Attention Is All You Need"})
    detail_response = client.get("/paper/W2626778328")

    assert search_response.status_code == 200
    assert detail_response.status_code == 200
    assert semantic_route.call_count >= 2
    assert semantic_arxiv_route.called
    assert openalex_route.called
    assert openalex_detail_route.called
    assert dblp_route.called
    assert search_response.json()[0]["year"] == 2017
    assert detail_response.json()["year"] == 2017
    assert detail_response.json()["venue"] == "NIPS"
    assert detail_response.json()["url"] == "https://doi.org/10.48550/arXiv.1706.03762"
    assert detail_response.json()["doi"] == "10.48550/arXiv.1706.03762"


@respx.mock
def test_graph_route_builds_topic_fallback_for_frontiers_only_paper(client):
    frontiers_route = respx.post("https://www.frontiersin.org/api/v2/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "TopResults": {
                    "Articles": [
                        {
                            "ArticleId": 1736773,
                            "Doi": "10.3389/frsc.2026.1736773",
                            "Title": "A Multi-scale Feature Fusion Framework for Urban Functional Zone Identification Using Automatic Ensemble Learning Method",
                            "Abstract": "Urban functional zone identification with remote sensing data.",
                            "PublicUrl": "https://www.frontiersin.org/articles/10.3389/frsc.2026.1736773",
                            "Authors": [{"FullName": "Tianming Zhang"}],
                            "Journal": {"Title": "Frontiers in Sustainable Cities"},
                            "Impact": {"Citations": {"Count": 0}},
                        }
                    ]
                }
            },
        )
    )
    search_route = respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {
                        "paperId": "cand-1",
                        "title": "Urban Functional Zone Identification Based on Multimodal Data Fusion",
                        "authors": [{"name": "Author 1"}],
                        "year": 2025,
                        "citationCount": 7,
                        "abstract": "Urban functional zone identification with multimodal remote sensing data.",
                    },
                    {
                        "paperId": "cand-2",
                        "title": "Distance Weight-Graph Attention Model-Based High-Resolution Remote Sensing Urban Functional Zone Identification",
                        "authors": [{"name": "Author 2"}],
                        "year": 2021,
                        "citationCount": 26,
                        "abstract": "Urban functional zone identification using high-resolution remote sensing.",
                    },
                ]
            },
        )
    )
    batch_route = respx.post("https://api.semanticscholar.org/graph/v1/paper/batch").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "paperId": "cand-1",
                    "title": "Urban Functional Zone Identification Based on Multimodal Data Fusion",
                    "authors": [{"name": "Author 1"}],
                    "year": 2025,
                    "citationCount": 7,
                    "abstract": "Urban functional zone identification with multimodal remote sensing data.",
                    "references": [{"paperId": "r1"}, {"paperId": "r2"}],
                    "citations": [{"paperId": "c1"}],
                },
                {
                    "paperId": "cand-2",
                    "title": "Distance Weight-Graph Attention Model-Based High-Resolution Remote Sensing Urban Functional Zone Identification",
                    "authors": [{"name": "Author 2"}],
                    "year": 2021,
                    "citationCount": 26,
                    "abstract": "Urban functional zone identification using high-resolution remote sensing.",
                    "references": [{"paperId": "r1"}, {"paperId": "r3"}],
                    "citations": [{"paperId": "c1"}],
                },
            ],
        )
    )

    response = client.get("/graph/FRONTIERS:1736773")

    assert response.status_code == 200
    assert frontiers_route.called
    assert search_route.called
    assert batch_route.called
    payload = response.json()
    assert payload["mode"] == "topic_fallback"
    assert payload["warning"]
    assert payload["seed_paper_id"] == "FRONTIERS:1736773"
    assert len(payload["nodes"]) == 3
    assert payload["edges"]


@respx.mock
def test_semantic_scholar_retries_on_429(settings):
    route = respx.get("https://api.semanticscholar.org/graph/v1/paper/search").mock(
        side_effect=[
            httpx.Response(429, json={"error": "rate limited"}),
            httpx.Response(200, json={"data": []}),
        ]
    )

    async def runner():
        client = SemanticScholarClient(settings)
        try:
            await client.search_papers("rate limited")
        finally:
            await client.close()

    asyncio.run(runner())
    assert route.call_count == 2


def test_cache_service_respects_ttl():
    async def runner():
        cache = CacheService(None)
        await cache.connect()
        await cache.set_json("ttl-key", {"ok": True}, ttl=1)
        assert await cache.get_json("ttl-key") == {"ok": True}
        await cache.client.expire("ttl-key", 0)
        assert await cache.get_json("ttl-key") is None
        await cache.close()

    asyncio.run(runner())
