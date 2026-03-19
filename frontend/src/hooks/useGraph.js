import { startTransition, useEffect, useRef, useState } from "react";
import { getGraph, getPaperDetail, getPriorDerivative, searchPapers } from "../api/client";
import { useLanguage } from "../i18n";

function extractApiMessage(error, fallback) {
  if (error?.code === "ERR_CANCELED") {
    return null;
  }

  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }

  if (error?.message && error.message !== "Network Error") {
    return error.message;
  }

  return fallback;
}

function findNode(graphData, paperId) {
  return graphData?.nodes?.find((node) => node.id === paperId) || null;
}

export function useGraph() {
  const { t } = useLanguage();
  const [status, setStatus] = useState("idle");
  const [query, setQuery] = useState("Attention is All You Need");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [graphData, setGraphData] = useState(null);
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [activeGraphSeedId, setActiveGraphSeedId] = useState(null);
  const [error, setError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [priorDerivative, setPriorDerivative] = useState(null);
  const [isPriorDerivativeLoading, setIsPriorDerivativeLoading] = useState(false);

  const detailCacheRef = useRef(new Map());
  const priorDerivativeCacheRef = useRef(new Map());
  const priorDerivativeAbortRef = useRef(null);
  const graphCacheRef = useRef(new Map());
  const searchCacheRef = useRef(new Map());
  const graphAbortRef = useRef(null);
  const detailAbortRef = useRef(null);
  const selectedPaperIdRef = useRef(selectedPaperId);
  const skipNextSearchRef = useRef(false);
  const searchUnavailable = t("errors.searchUnavailable");
  const detailUnavailable = t("errors.detailUnavailable");
  const graphUnavailable = t("errors.graphUnavailable");

  useEffect(() => {
    selectedPaperIdRef.current = selectedPaperId;
  }, [selectedPaperId]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const allowShortDoi = trimmedQuery.includes("10.");

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return undefined;
    }

    if (!trimmedQuery || (trimmedQuery.length < 3 && !allowShortDoi)) {
      setSearchResults([]);
      setSearchError("");
      setStatus((current) => (current === "searching" ? (graphData ? "ready" : "idle") : current));
      return undefined;
    }

    const cacheKey = trimmedQuery.toLowerCase();
    const cachedResults = searchCacheRef.current.get(cacheKey);
    if (cachedResults) {
      setSearchError("");
      setSearchResults(cachedResults);
      setStatus((current) => (current === "searching" ? (graphData ? "ready" : "idle") : current));
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchError("");
      setStatus("searching");

      try {
        const results = await searchPapers(trimmedQuery, controller.signal);
        searchCacheRef.current.set(cacheKey, results);
        startTransition(() => {
          setSearchResults(results);
          setStatus(graphData ? "ready" : "idle");
        });
      } catch (requestError) {
        const message = extractApiMessage(requestError, searchUnavailable);
        if (!message) {
          return;
        }
        startTransition(() => {
          setSearchResults([]);
          setSearchError(message);
          setStatus(graphData ? "ready" : "error");
        });
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [graphData, query, searchUnavailable]);

  async function hydratePaperDetail(paperId, fallbackNode = null) {
    const cachedDetail = detailCacheRef.current.get(paperId);
    if (cachedDetail) {
      startTransition(() => {
        if (selectedPaperIdRef.current === paperId) {
          setSelectedPaper(cachedDetail);
          setIsDetailLoading(false);
        }
      });
      return cachedDetail;
    }

    if (detailAbortRef.current) {
      detailAbortRef.current.abort();
    }

    const controller = new AbortController();
    detailAbortRef.current = controller;
    setIsDetailLoading(true);
    if (fallbackNode) {
      setSelectedPaper(fallbackNode);
    }

    try {
      const detail = await getPaperDetail(paperId, controller.signal);
      detailCacheRef.current.set(paperId, detail);
      startTransition(() => {
        if (selectedPaperIdRef.current === paperId) {
          setSelectedPaper(detail);
        }
      });
      return detail;
    } catch (requestError) {
      const message = extractApiMessage(requestError, detailUnavailable);
      if (message && selectedPaperIdRef.current === paperId) {
        setError(message);
      }
      return fallbackNode;
    } finally {
      if (selectedPaperIdRef.current === paperId) {
        setIsDetailLoading(false);
      }
    }
  }

  async function loadGraph(paperId, options = {}) {
    const { title = "" } = options;

    if (graphAbortRef.current) {
      graphAbortRef.current.abort();
    }

    const controller = new AbortController();
    graphAbortRef.current = controller;

    setError("");
    setSearchError("");
    setSearchResults([]);
    setStatus("loadingGraph");

    if (title) {
      skipNextSearchRef.current = true;
      setQuery(title);
    }

    // Reset prior/derivative when loading a new graph (force fresh fetch from API)
    setPriorDerivative(null);
    priorDerivativeCacheRef.current.clear();

    const cachedGraph = graphCacheRef.current.get(paperId);
    if (cachedGraph) {
      const seedNode = findNode(cachedGraph, cachedGraph.seed_paper_id);
      selectedPaperIdRef.current = cachedGraph.seed_paper_id;
      startTransition(() => {
        setGraphData(cachedGraph);
        setActiveGraphSeedId(cachedGraph.seed_paper_id);
        setSelectedPaperId(cachedGraph.seed_paper_id);
        setSelectedPaper(seedNode);
        setStatus("ready");
        // Seed priorDerivative from the embedded graph data if available
        if (cachedGraph.prior_works?.length || cachedGraph.derivative_works?.length) {
          const embedded = { prior_works: cachedGraph.prior_works ?? [], derivative_works: cachedGraph.derivative_works ?? [] };
          setPriorDerivative(embedded);
          priorDerivativeCacheRef.current.set(cachedGraph.seed_paper_id, embedded);
        }
      });
      await hydratePaperDetail(cachedGraph.seed_paper_id, seedNode);
      return cachedGraph;
    }

    try {
      const nextGraph = await getGraph(paperId, controller.signal);
      const seedNode = findNode(nextGraph, nextGraph.seed_paper_id);
      selectedPaperIdRef.current = nextGraph.seed_paper_id;
      graphCacheRef.current.set(paperId, nextGraph);
      graphCacheRef.current.set(nextGraph.seed_paper_id, nextGraph);

      startTransition(() => {
        setGraphData(nextGraph);
        setActiveGraphSeedId(nextGraph.seed_paper_id);
        setSelectedPaperId(nextGraph.seed_paper_id);
        setSelectedPaper(seedNode);
        setStatus("ready");
        // Seed priorDerivative from the embedded graph data if available
        if (nextGraph.prior_works?.length || nextGraph.derivative_works?.length) {
          const embedded = { prior_works: nextGraph.prior_works ?? [], derivative_works: nextGraph.derivative_works ?? [] };
          setPriorDerivative(embedded);
          priorDerivativeCacheRef.current.set(nextGraph.seed_paper_id, embedded);
        }
      });

      await hydratePaperDetail(nextGraph.seed_paper_id, seedNode);
      return nextGraph;
    } catch (requestError) {
      const message = extractApiMessage(requestError, graphUnavailable);
      if (!message) {
        return null;
      }
      startTransition(() => {
        setError(message);
        setStatus("error");
      });
      return null;
    }
  }

  async function selectPaper(paperId, fallbackNode = null) {
    selectedPaperIdRef.current = paperId;
    setSelectedPaperId(paperId);
    setError("");
    await hydratePaperDetail(paperId, fallbackNode || findNode(graphData, paperId));
  }

  function clearSelection() {
    selectedPaperIdRef.current = null;
    if (detailAbortRef.current) {
      detailAbortRef.current.abort();
    }
    setSelectedPaperId(null);
    setSelectedPaper(null);
    setIsDetailLoading(false);
  }

  async function recenter(paperId) {
    return loadGraph(paperId);
  }

  async function loadPriorDerivative(seedPaperId) {
    const cached = priorDerivativeCacheRef.current.get(seedPaperId);
    if (cached) {
      startTransition(() => setPriorDerivative(cached));
      return cached;
    }

    if (priorDerivativeAbortRef.current) {
      priorDerivativeAbortRef.current.abort();
    }
    const controller = new AbortController();
    priorDerivativeAbortRef.current = controller;

    setIsPriorDerivativeLoading(true);
    try {
      const data = await getPriorDerivative(seedPaperId, controller.signal);
      priorDerivativeCacheRef.current.set(seedPaperId, data);
      startTransition(() => {
        setPriorDerivative(data);
        setIsPriorDerivativeLoading(false);
      });
      return data;
    } catch (err) {
      if (err?.code !== "ERR_CANCELED") {
        startTransition(() => setIsPriorDerivativeLoading(false));
      }
      return null;
    }
  }

  return {
    activeGraphSeedId,
    clearSelection,
    error,
    graphData,
    isDetailLoading,
    isPriorDerivativeLoading,
    loadGraph,
    loadPriorDerivative,
    priorDerivative,
    query,
    recenter,
    searchError,
    searchResults,
    selectPaper,
    selectedPaper,
    selectedPaperId,
    setQuery,
    status
  };
}
