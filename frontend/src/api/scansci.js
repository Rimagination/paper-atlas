import axios from "axios";

function ensureApiSuffix(url) {
  const normalized = url.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

function resolveScanSciApiBaseUrl() {
  if (import.meta.env.VITE_SCANSCI_API_BASE_URL) {
    return ensureApiSuffix(import.meta.env.VITE_SCANSCI_API_BASE_URL);
  }

  return "https://www.scansci.com/api";
}

const scansciClient = axios.create({
  baseURL: resolveScanSciApiBaseUrl(),
  timeout: 15000,
  withCredentials: true,
});

export function buildPaperFavoriteId(paper) {
  const identifier = paper?.paper_id || paper?.id || paper?.doi || paper?.title;
  if (!identifier) {
    return null;
  }
  return `paperatlas:paper:${String(identifier).trim()}`;
}

export function buildFavoritePayload(paper) {
  return {
    paper_id: paper?.paper_id || paper?.id || null,
    title: paper?.title || "",
    authors: Array.isArray(paper?.authors) ? paper.authors : [],
    year: paper?.year ?? null,
    venue: paper?.venue || null,
    doi: paper?.doi || null,
    url: paper?.url || null,
    citation_count: paper?.citation_count ?? 0,
    source: "paper_atlas",
  };
}

export function buildScanSciLoginUrl(returnTo) {
  const url = new URL("/api/auth/github/start", resolveScanSciApiBaseUrl());
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}

export async function getScanSciMe() {
  const response = await scansciClient.get("/me");
  return response.data;
}

export async function toggleScanSciFavorite(appId, payload) {
  const response = await scansciClient.post("/actions", {
    app_id: appId,
    action_type: "favorite_toggle",
    payload,
  });
  return response.data;
}

export default scansciClient;
