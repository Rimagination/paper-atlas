#!/usr/bin/env python3
"""启动检查脚本"""

import sys
import traceback

print("=" * 60)
print("Paper Atlas Startup Check")
print("=" * 60)
print(f"Python version: {sys.version}")
print(f"Python path: {sys.path}")
print()

try:
    print("[1/6] Importing FastAPI...")
    from fastapi import FastAPI
    print("  ✓ FastAPI imported")

    print("[2/6] Importing config...")
    from backend.config import get_settings
    settings = get_settings()
    print(f"  ✓ Config loaded, CORS: {settings.cors_origins}")

    print("[3/6] Importing cache service...")
    from backend.services.cache import CacheService
    print("  ✓ CacheService imported")

    print("[4/6] Importing data clients...")
    from backend.services.semantic_scholar import SemanticScholarClient
    from backend.services.openalex import OpenAlexClient
    from backend.services.frontiers import FrontiersClient
    from backend.services.dblp import DblpClient
    from backend.services.paper_data import PaperDataClient
    from backend.services.similarity import SimilarityEngine
    print("  ✓ All data clients imported")

    print("[5/6] Creating app...")
    from backend.main import create_app
    app = create_app(settings)
    print("  ✓ App created")

    print("[6/6] All checks passed!")
    print("=" * 60)
    sys.exit(0)

except Exception as e:
    print(f"\n[ERROR] {type(e).__name__}: {e}")
    print()
    traceback.print_exc()
    print("=" * 60)
    sys.exit(1)
