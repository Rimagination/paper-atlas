import { resolvePaperUrl } from "../utils/papers";
import { useLanguage } from "../i18n";

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

function formatAuthors(authors = [], fallback, limit = 3) {
  if (!authors.length) {
    return fallback;
  }

  if (authors.length <= limit) {
    return authors.join(", ");
  }

  return `${authors.slice(0, limit).join(", ")} +${authors.length - limit}`;
}

function sortNodes(nodes = [], seedPaperId) {
  return [...nodes].sort((left, right) => {
    if (left.id === seedPaperId) {
      return -1;
    }
    if (right.id === seedPaperId) {
      return 1;
    }
    return (right.citation_count || 0) - (left.citation_count || 0);
  });
}

function RailItem({ isActive, isSeed, node, index, onSelectPaper, t }) {
  const sourceUrl = resolvePaperUrl(node);

  return (
    <div
      className={`rounded-[18px] border ${
        isActive
          ? "border-slate-300 bg-slate-50 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={() => onSelectPaper(node.id, node)} className="min-w-0 flex-1 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  isSeed
                    ? "border border-amber-200 bg-amber-50 text-amber-800"
                    : "border border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {isSeed ? t("rail.origin") : `#${index}`}
              </span>
              {node.is_seed ? (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                  {t("rail.seed")}
                </span>
              ) : null}
            </div>

            <div className="shrink-0 text-right text-xs text-slate-400">
              <div>{node.year || t("rail.na")}</div>
              <div className="mt-1">{t("rail.cites", { count: node.citation_count || 0 })}</div>
            </div>
          </div>

          <div className="mt-3 line-clamp-3 text-[15px] font-medium leading-6 text-slate-900">{node.title}</div>
          <div className="mt-2 text-xs leading-5 text-slate-500">
            {formatAuthors(node.authors, t("rail.unknownAuthors"))}
          </div>
        </button>

        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            aria-label={t("rail.openSourceAria", { title: node.title })}
            title={t("rail.openSourceTitle")}
          >
            <ExternalLinkIcon />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DesktopRail({ data, onSelectPaper, seedPaperId, selectedPaperId, className = "", t }) {
  const nodes = sortNodes(data?.nodes || [], seedPaperId);

  return (
    <aside className={`paper-surface h-full min-h-0 flex-col rounded-[22px] p-4 ${className}`}>
      <div className="border-b border-slate-200 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
            {t("rail.paperCount", { count: nodes.length })}
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-3">
          {nodes.map((node, index) => (
            <RailItem
              key={node.id}
              index={index}
              isActive={node.id === selectedPaperId}
              isSeed={node.id === seedPaperId}
              node={node}
              onSelectPaper={onSelectPaper}
              t={t}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function CompactRail({ data, onSelectPaper, seedPaperId, selectedPaperId, t }) {
  const nodes = sortNodes(data?.nodes || [], seedPaperId);

  return (
    <div className="paper-surface overflow-hidden rounded-[20px] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-400">{t("rail.paperCount", { count: nodes.length })}</div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {nodes.map((node, index) => {
          const isActive = node.id === selectedPaperId;
          const sourceUrl = resolvePaperUrl(node);

          return (
            <div
              key={node.id}
              className={`min-w-[240px] rounded-[18px] border ${
                isActive ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <button type="button" onClick={() => onSelectPaper(node.id, node)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {node.id === seedPaperId ? t("rail.origin") : `#${index}`}
                    </span>
                    <span className="text-xs text-slate-400">{node.year || t("rail.na")}</span>
                  </div>
                  <div className="mt-3 line-clamp-3 text-sm font-medium leading-6 text-slate-900">{node.title}</div>
                  <div className="mt-3 text-xs text-slate-500">
                    {t("rail.citations", { count: node.citation_count || 0 })}
                  </div>
                </button>

                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
                    aria-label={t("rail.openSourceAria", { title: node.title })}
                    title={t("rail.openSourceTitle")}
                  >
                    <ExternalLinkIcon />
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PaperRail({
  className = "",
  compact = false,
  data,
  onSelectPaper,
  seedPaperId,
  selectedPaperId
}) {
  const { t } = useLanguage();

  if (!data?.nodes?.length) {
    return null;
  }

  if (compact) {
    return (
      <CompactRail
        data={data}
        onSelectPaper={onSelectPaper}
        seedPaperId={seedPaperId}
        selectedPaperId={selectedPaperId}
        t={t}
      />
    );
  }

  return (
    <DesktopRail
      className={className}
      data={data}
      onSelectPaper={onSelectPaper}
      seedPaperId={seedPaperId}
      selectedPaperId={selectedPaperId}
      t={t}
    />
  );
}
