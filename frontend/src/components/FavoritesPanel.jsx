import { resolvePaperUrl } from "../utils/papers";
import { useLanguage } from "../i18n";
import { useTheme } from "../theme";

function readLabel(value, fallback) {
  return typeof value === "string" && value.includes(".") ? fallback : value;
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11 3h6v6h-1.6V5.7l-6.2 6.2l-1.1-1.1l6.2-6.2H11V3ZM5 5h4v1.6H6.6v6.8h6.8V11H15v4H5V5Z"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3.5h8a1 1 0 0 1 1 1V17l-5-3-5 3V4.5a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FavoriteItem({ item, onOpenMap, t }) {
  const payload = item?.payload || {};
  const sourceUrl = resolvePaperUrl(payload);
  const title = payload?.title || item?.app_id;
  const paperId = payload?.paper_id || payload?.id || null;
  const authors = Array.isArray(payload?.authors) ? payload.authors.slice(0, 3).join(", ") : "";

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => paperId && onOpenMap(paperId, title)} className="min-w-0 flex-1 text-left">
          <div className="line-clamp-2 text-[14px] font-medium leading-6 text-slate-900">{title}</div>
          <div className="mt-1 text-[12px] leading-5 text-slate-500">{authors || t("rail.unknownAuthors")}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>{payload?.year || t("panel.yearUnknown")}</span>
            {payload?.venue ? <span>{payload.venue}</span> : null}
            <span>{t("rail.citations", { count: payload?.citation_count || 0 })}</span>
          </div>
        </button>

        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
            title={readLabel(t("rail.openSourceTitle"), "打开原文")}
          >
            <ExternalLinkIcon />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function FavoritesPanel({
  isOpen,
  isLoading,
  items,
  authStatus,
  onClose,
  onLogin,
  onOpenMap,
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const titleLabel = readLabel(t("favorites.title"), "收藏论文");
  const hintLabel = readLabel(t("favorites.hint"), "收藏的论文会保存在这里，方便你回到图谱或直接打开原文。");
  const signInLabel = readLabel(t("favorites.signIn"), "登录后查看收藏");
  const emptyLabel = readLabel(t("favorites.empty"), "还没有收藏论文。");
  const openMapLabel = readLabel(t("favorites.openMap"), "打开图谱");

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/18 backdrop-blur-[2px] transition ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`paper-surface fixed right-3 top-[4.75rem] z-50 flex h-[calc(100vh-5.5rem)] w-[min(420px,calc(100vw-1.5rem))] flex-col rounded-[24px] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.18)] transition duration-300 ${
          isOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[110%] opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: theme.colors[0] + "33", color: theme.colors[0], background: theme.colors[0] + "0f" }}>
              <BookmarkIcon />
              {titleLabel}
            </div>
            <p className="mt-3 max-w-[20rem] text-[12px] leading-6 text-slate-500">{hintLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300"
          >
            {t("panel.close")}
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {authStatus !== "authenticated" ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-white/80 p-5 text-center">
              <p className="text-sm leading-7 text-slate-500">{signInLabel}</p>
              <button
                type="button"
                onClick={onLogin}
                className="mt-4 rounded-[14px] border border-slate-900 bg-slate-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-slate-800"
              >
                {readLabel(t("auth.signIn"), "登录")}
              </button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[16px] border border-slate-200 bg-white p-3">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          ) : items.length ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={`${item.app_id}-${item.created_at}`} className="space-y-2">
                  <FavoriteItem item={item} onOpenMap={onOpenMap} t={t} />
                  {item?.payload?.paper_id ? (
                    <button
                      type="button"
                      onClick={() => onOpenMap(item.payload.paper_id, item.payload.title)}
                      className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      {openMapLabel}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-white/80 p-5 text-center text-sm leading-7 text-slate-500">
              {emptyLabel}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
