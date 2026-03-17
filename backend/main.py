from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import Settings, get_settings
from backend.routers.papers import router as papers_router
from backend.services.cache import CacheService
from backend.services.dblp import DblpClient
from backend.services.frontiers import FrontiersClient
from backend.services.openalex import OpenAlexClient
from backend.services.paper_data import PaperDataClient
from backend.services.semantic_scholar import SemanticScholarClient
from backend.services.similarity import SimilarityEngine


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        cache_service = CacheService(app_settings.redis_url)
        await cache_service.connect()

        semantic_client = SemanticScholarClient(app_settings)
        openalex_client = OpenAlexClient(app_settings)
        frontiers_client = FrontiersClient(app_settings)
        dblp_client = DblpClient(app_settings)
        paper_client = PaperDataClient(
            app_settings,
            semantic_client,
            openalex_client,
            frontiers_client,
            dblp_client,
        )
        similarity_engine = SimilarityEngine(app_settings, paper_client, cache_service)

        app.state.settings = app_settings
        app.state.cache = cache_service
        app.state.paper_client = paper_client
        app.state.similarity_engine = similarity_engine

        yield

        await paper_client.close()
        await cache_service.close()

    app = FastAPI(
        title="Paper Atlas API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(papers_router, prefix="/api")
    return app


app = create_app()
