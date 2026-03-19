import { useState } from "react";
import { resolvePaperUrl } from "../utils/papers";
import { useLanguage } from "../i18n";
import { useTheme } from "../theme";

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

function formatAuthors(authors = [], fallback, limit = 2) {
  if (!authors.length) return fallback;
  if (authors.length <= limit) return authors.join(", ");
  return `${authors.slice(0, limit).join(", ")} +${authors.length - limit}`;
}

function sortNodes(nodes = [], seedPaperId) {
  return [...nodes].sort((left, right) => {
    if (left.id === seedPaperId) return -1;
    if (right.id === seedPaperId) return 1;
    return (right.citation_count || 0) - (left.citation_count || 0);
  });
}

function SimilarItem({ isActive, isSeed, node, index, onSelectPaper, t }) {
  const { theme } = useTheme();
  const sourceUrl = resolvePaperUrl(node);

  return (
    <div
      className="rounded-[14px] border transition"
      style={isActive ? {
        borderColor: theme.colors[0] + "50",
        background: theme.colors[0] + "08",
        boxShadow: `0 4px 12px ${theme.colors[0]}14`,
      } : { borderColor: "#e2e8f0", background: "#ffffff" }}
    >
      <div className="flex items-start gap-2 p-3">
        <button type="button" onClick={() => onSelectPaper(node.id, node)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                isSeed
                  ? "border border-amber-200 bg-amber-50 text-amber-800"
                  : "border border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {isSeed ? t("rail.origin") : `#${index}`}
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">{node.year || t("rail.na")}</span>
          </div>
          <div className="mt-2 line-clamp-2 text-[13px] font-medium leading-5 text-slate-900">{node.title}</div>
          <div className="mt-1 text-[11px] leading-4 text-slate-500">
            {formatAuthors(node.authors, t("rail.unknownAuthors"))}
            <span className="ml-2 text-slate-400">{t("rail.cites", { count: node.citation_count || 0 })}</span>
          </div>
        </button>

        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
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

function WorksItem({ item, onSelectPaper, t }) {
  const url = item.url || (item.doi ? `https://doi.org/${item.doi}` : null);

  return (
    <div className="rounded-[14px] border border-slate-200 bg-white">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => item.paper_id && onSelectPaper(item.paper_id, { id: item.paper_id, ...item })}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">{item.year || t("rail.na")}</span>
            <span className="shrink-0 text-[11px] text-slate-400">
              {t("rail.cites", { count: item.citation_count || 0 })}
            </span>
          </div>
          <div className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-5 text-slate-900">{item.title}</div>
          <div className="mt-1 text-[11px] leading-4 text-slate-500">
            {formatAuthors(item.authors || [], t("rail.unknownAuthors"))}
          </div>
        </button>

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
            title={t("rail.openSourceTitle")}
          >
            <ExternalLinkIcon />
          </a>
        ) : null}
      </div>
    </div>
  );
}

const TABS = ["similar", "prior", "derivative"];

function TabBar({ active, onChange, t }) {
  return (
    <div className="flex gap-1 rounded-[12px] border border-slate-200 bg-slate-100/70 p-1">
      {TABS.map((tab) => {
        const label = tab === "similar" ? t("rail.tabSimilar") : tab === "prior" ? t("rail.tabPrior") : t("rail.tabDerivative");
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => onChange(tab)}
            className={`flex-1 rounded-[9px] px-2 py-1.5 text-[11px] font-semibold transition ${
              active === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function WorksPane({ items, isLoading, onSelectPaper, t, descKey }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-slate-200 bg-white p-3">
            <div className="h-2.5 w-12 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-3.5 w-5/6 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-1.5 h-2.5 w-2/3 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || !items.length) {
    return (
      <div className="rounded-[14px] border border-dashed border-slate-200 p-4 text-center text-[12px] text-slate-400">
        {t("rail.emptyWorks")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11px] leading-5 text-slate-400">{t(descKey)}</p>
      {items.map((item) => (
        <WorksItem key={item.paper_id} item={item} onSelectPaper={onSelectPaper} t={t} />
      ))}
    </div>
  );
}

function DesktopRail({
  data,
  onSelectPaper,
  seedPaperId,
  selectedPaperId,
  priorDerivative,
  isPriorDerivativeLoading,
  onLoadPriorDerivative,
  className = "",
  t
}) {
  const [activeTab, setActiveTab] = useState("similar");
  const nodes = sortNodes(data?.nodes || [], seedPaperId);

  function handleTabChange(tab) {
    setActiveTab(tab);
    if ((tab === "prior" || tab === "derivative") && !priorDerivative && !isPriorDerivativeLoading) {
      onLoadPriorDerivative(seedPaperId);
    }
  }

  return (
    <aside className={`paper-surface h-full min-h-0 flex-col rounded-[22px] p-3 ${className}`}>
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3">
        <TabBar active={activeTab} onChange={handleTabChange} t={t} />
        <div className="text-[11px] text-slate-400">
          {activeTab === "similar"
            ? t("rail.paperCount", { count: nodes.length })
            : activeTab === "prior"
              ? priorDerivative
                ? t("rail.paperCount", { count: priorDerivative.prior_works.length })
                : "—"
              : priorDerivative
                ? t("rail.paperCount", { count: priorDerivative.derivative_works.length })
                : "—"}
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {activeTab === "similar" ? (
          <div className="flex flex-col gap-2">
            {nodes.map((node, index) => (
              <SimilarItem
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
        ) : activeTab === "prior" ? (
          <WorksPane
            items={priorDerivative?.prior_works}
            isLoading={isPriorDerivativeLoading}
            onSelectPaper={onSelectPaper}
            t={t}
            descKey="rail.priorDesc"
          />
        ) : (
          <WorksPane
            items={priorDerivative?.derivative_works}
            isLoading={isPriorDerivativeLoading}
            onSelectPaper={onSelectPaper}
            t={t}
            descKey="rail.derivativeDesc"
          />
        )}
      </div>
    </aside>
  );
}

function CompactRail({ data, onSelectPaper, seedPaperId, selectedPaperId, t }) {
  const nodes = sortNodes(data?.nodes || [], seedPaperId);

  return (
    <div className="paper-surface overflow-hidden rounded-[20px] p-3">
      <div className="mb-2 text-[11px] text-slate-400">{t("rail.paperCount", { count: nodes.length })}</div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {nodes.map((node, index) => {
          const isActive = node.id === selectedPaperId;
          const sourceUrl = resolvePaperUrl(node);

          return (
            <div
              key={node.id}
              className={`min-w-[200px] rounded-[14px] border ${
                isActive ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-2 p-3">
                <button type="button" onClick={() => onSelectPaper(node.id, node)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {node.id === seedPaperId ? t("rail.origin") : `#${index}`}
                    </span>
                    <span className="text-[11px] text-slate-400">{node.year || t("rail.na")}</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-[13px] font-medium leading-5 text-slate-900">{node.title}</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {t("rail.cites", { count: node.citation_count || 0 })}
                  </div>
                </button>

                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400"
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
  selectedPaperId,
  priorDerivative,
  isPriorDerivativeLoading,
  onLoadPriorDerivative
}) {
  const { t } = useLanguage();

  if (!data?.nodes?.length) return null;

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
      priorDerivative={priorDerivative}
      isPriorDerivativeLoading={isPriorDerivativeLoading}
      onLoadPriorDerivative={onLoadPriorDerivative}
      t={t}
    />
  );
}
