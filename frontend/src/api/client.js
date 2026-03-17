import axios from "axios";

function resolveBaseUrl() {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 生产环境：直接调用 Render 后端
  if (import.meta.env.PROD) {
    return "https://paper-atlas-backend.onrender.com/api";
  }

  // 开发环境：使用本地后端
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return "http://localhost:8000";
}

const client = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 30000
});

export async function searchPapers(query, signal) {
  const response = await client.get("/search", {
    params: { q: query },
    signal
  });
  return response.data;
}

export async function getGraph(paperId, signal) {
  const response = await client.get(`/graph/${encodeURIComponent(paperId)}`, { signal });
  return response.data;
}

export async function getPaperDetail(paperId, signal) {
  const response = await client.get(`/paper/${encodeURIComponent(paperId)}`, { signal });
  return response.data;
}

export default client;
