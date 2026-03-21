import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  buildFavoritePayload,
  buildPaperFavoriteId,
  buildScanSciLoginUrl,
  getScanSciFavoriteItems,
  getScanSciMe,
  toggleScanSciFavorite,
} from "./api/scansci";

const ScanSciAuthContext = createContext({
  status: "loading",
  user: null,
  favorites: new Set(),
  favoriteItems: [],
  favoriteItemsStatus: "idle",
  refresh: async () => null,
  loadFavoriteItems: async () => [],
  startLogin: () => {},
  isFavorite: () => false,
  toggleFavorite: async () => ({ ok: false, requiresAuth: false }),
});

function normalizeFavorites(favorites) {
  return new Set(
    (Array.isArray(favorites) ? favorites : [])
      .map((item) => String(item?.app_id || "").trim())
      .filter(Boolean)
  );
}

export function ScanSciAuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState(() => new Set());
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [favoriteItemsStatus, setFavoriteItemsStatus] = useState("idle");

  function normalizeFavoriteItems(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      app_id: item?.app_id || "",
      created_at: item?.created_at || "",
      payload: item?.payload || {},
    }));
  }

  async function refresh() {
    try {
      const payload = await getScanSciMe();
      setUser(payload?.user || null);
      setFavorites(normalizeFavorites(payload?.favorites));
      setStatus(payload?.user ? "authenticated" : "guest");
      return payload;
    } catch (error) {
      if (error?.response?.status === 401) {
        setUser(null);
        setFavorites(new Set());
        setFavoriteItems([]);
        setFavoriteItemsStatus("idle");
        setStatus("guest");
        return null;
      }
      setStatus("guest");
      return null;
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startLogin() {
    if (typeof window === "undefined") {
      return;
    }
    window.location.assign(buildScanSciLoginUrl(window.location.href));
  }

  function isFavorite(paperOrId) {
    const appId = typeof paperOrId === "string" ? paperOrId : buildPaperFavoriteId(paperOrId);
    return appId ? favorites.has(appId) : false;
  }

  async function loadFavoriteItems(force = false) {
    if (status !== "authenticated") {
      setFavoriteItems([]);
      setFavoriteItemsStatus("idle");
      return [];
    }

    if (!force && favoriteItemsStatus === "ready") {
      return favoriteItems;
    }

    setFavoriteItemsStatus("loading");
    try {
      const payload = await getScanSciFavoriteItems();
      const nextItems = normalizeFavoriteItems(payload?.items);
      setFavoriteItems(nextItems);
      setFavoriteItemsStatus("ready");
      return nextItems;
    } catch (_) {
      setFavoriteItemsStatus("error");
      return [];
    }
  }

  async function toggleFavorite(paper) {
    const appId = buildPaperFavoriteId(paper);
    if (!appId) {
      return { ok: false, requiresAuth: false };
    }

    if (status !== "authenticated") {
      return { ok: false, requiresAuth: true };
    }

    const result = await toggleScanSciFavorite(appId, buildFavoritePayload(paper));
    setFavorites((current) => {
      const next = new Set(current);
      if (result?.is_favorite) {
        next.add(appId);
      } else {
        next.delete(appId);
      }
      return next;
    });
    setFavoriteItems((current) => {
      if (result?.is_favorite) {
        const nextItem = {
          app_id: appId,
          created_at: new Date().toISOString(),
          payload: buildFavoritePayload(paper),
        };
        return [nextItem, ...current.filter((item) => item.app_id !== appId)];
      }
      return current.filter((item) => item.app_id !== appId);
    });
    setFavoriteItemsStatus("ready");
    return { ok: true, isFavorite: Boolean(result?.is_favorite) };
  }

  const value = useMemo(
    () => ({
      status,
      user,
      favorites,
      favoriteItems,
      favoriteItemsStatus,
      refresh,
      loadFavoriteItems,
      startLogin,
      isFavorite,
      toggleFavorite,
    }),
    [favoriteItems, favoriteItemsStatus, favorites, status, user]
  );

  return <ScanSciAuthContext.Provider value={value}>{children}</ScanSciAuthContext.Provider>;
}

export function useScanSciAuth() {
  return useContext(ScanSciAuthContext);
}
