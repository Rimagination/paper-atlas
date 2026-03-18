from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    semantic_scholar_api_key: str | None = None
    redis_url: str | None = None
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "*"]
    max_candidates: int = 150
    similarity_threshold: float = 0.05
    cache_ttl_graph: int = 86_400
    cache_ttl_paper: int = 604_800
    cache_ttl_search: int = 86_400
    semantic_scholar_base_url: str = "https://api.semanticscholar.org/graph/v1"
    semantic_scholar_timeout: float = 12.0
    request_concurrency: int = 4
    request_max_retries: int = 1
    request_backoff_base: float = 0.2
    source_cooldown_seconds: int = 300
    graph_node_min: int = 20
    graph_node_max: int = 80
    graph_edge_max: int = 300
    fallback_threshold: float = 0.03
    user_agent: str = "PaperAtlas/1.0"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value):
        if value is None:
            return ["*"]
        if isinstance(value, str):
            # Handle empty string
            if not value.strip():
                return ["*"]
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, list):
            return value
        return ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
