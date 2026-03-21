---
title: Paper Atlas
emoji: "🗺️"
colorFrom: teal
colorTo: blue
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# Paper Atlas

Paper Atlas is the literature-graph application behind `https://paperatlas.scansci.com/`.

This repository is the application itself:

- Frontend: React + Vite + D3
- Backend: FastAPI
- Production host: Hugging Face Space
- Custom domain: `paperatlas.scansci.com` via Cloudflare Worker reverse proxy

## Repository Roles

- `D:\VSP\cp`
  - The Paper Atlas app source code
  - Builds the frontend and backend into one Docker image for Hugging Face Spaces
- `D:\VSP\scansci-portal-repo`
  - The `www.scansci.com` portal
  - Owns the Cloudflare Worker proxy config for `paperatlas.scansci.com`

If Paper Atlas UI or API changes, this repository is the source of truth.
If custom domain routing changes, check `D:\VSP\scansci-portal-repo`.

## Runtime Architecture

Production request flow:

1. User opens `https://paperatlas.scansci.com`
2. Cloudflare Worker proxies traffic to the Hugging Face Space
3. Nginx serves the built frontend on port `7860`
4. Nginx forwards `/api/*` and `/health` to FastAPI on port `8000`

Relevant files:

- `D:\VSP\cp\Dockerfile`
- `D:\VSP\cp\nginx-hf.conf`
- `D:\VSP\cp\start.sh`
- `D:\VSP\scansci-portal-repo\worker\paper-atlas-proxy.js`
- `D:\VSP\scansci-portal-repo\worker\wrangler.paper-atlas.toml`

## Local Development

### Backend

```powershell
cd D:\VSP\cp
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python -m backend.run_server
```

Backend health:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health
```

### Frontend

```powershell
cd D:\VSP\cp\frontend
npm install
npm run dev
```

Frontend dev URL:

```text
http://127.0.0.1:5173
```

In development, the frontend now targets `http://127.0.0.1:8000/api` by default.
In production, the frontend targets `/api`.

## Local Docker

```powershell
cd D:\VSP\cp
docker compose up --build
```

This starts:

- Redis on `6379`
- FastAPI on `8000`
- Vite dev server on `5173`

## Production Deployment

### Canonical path

Use one source of truth:

1. Push application changes to GitHub
2. Mirror the deploy branch to Hugging Face `main`
3. Let Hugging Face rebuild the Docker app
4. Keep Cloudflare proxy config in `scansci-portal-repo`

The workflow watches both `main` and `clean-main`, then syncs the selected GitHub branch state into Hugging Face `main`.

### Hugging Face

The Hugging Face Space is configured as a Docker Space using this repository layout.

Required runtime env vars usually include:

- `SEMANTIC_SCHOLAR_API_KEY` (optional but recommended)
- `OPENALEX_EMAIL` (optional but recommended)
- `REDIS_URL` (optional; app falls back to in-memory cache)

### Cloudflare

`paperatlas.scansci.com` should continue to be routed by the Worker defined in:

- `D:\VSP\scansci-portal-repo\worker\paper-atlas-proxy.js`

## Deployment Policy

The old `Cloudflare Pages` workflow does not match the actual production topology.
Paper Atlas is not a Cloudflare Pages app. It is a Hugging Face Space behind a Cloudflare Worker.

The GitHub Actions workflow in this repository should therefore mirror GitHub to Hugging Face, not deploy frontend-only assets to Cloudflare Pages.

Required GitHub Actions secret:

- `HF_SPACE_TOKEN`

## Validation Checklist

Before pushing:

- Frontend loads in Chinese and English
- `/health` returns `{"status":"ok"}`
- `/api/search`, `/api/graph/{paper_id}`, `/api/paper/{paper_id}` respond correctly
- Graph canvas stays below the graph toolbar
- External paper links open correctly

## Notes

- Production is currently known to work through the custom domain.
- GitHub and Hugging Face can drift if only one remote is pushed.
- The repository currently has active work on both `main` and `clean-main`, so the workflow accepts both.
