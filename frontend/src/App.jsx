import { useDeferredValue } from "react";
import GraphCanvas from "./components/GraphCanvas";
import PaperPanel from "./components/PaperPanel";
import PaperRail from "./components/PaperRail";
import SearchBar from "./components/SearchBar";
import { useGraph } from "./hooks/useGraph";
import { useLanguage } from "./i18n";
import { useTheme } from "./theme";

const OTHER_APPS = [
  { name: "DataRaven", url: "https://dataset.scansci.com" },
  { name: "Journal Scout", url: "https://journal.scansci.com" },
  { name: "Citation Lab", url: "https://citation.scansci.com" },
];

function ScanSciGlobalNav() {
  return (
    <nav
      className="fixed left-0 right-0 top-0 z-[60] flex h-10 items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur-md sm:px-5"
      aria-label="ScanSci global navigation"
    >
      <a
        href="https://www.scansci.com"
        className="flex items-center gap-1.5 text-[12px] font-bold text-slate-700 transition-colors t-hover-text"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 flex-none" fill="currentColor" aria-hidden="true">
          <path d="M6.5 1.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10M0 6.5a6.5 6.5 0 1 1 11.598 4.036l3.433 3.433-1.06 1.06-3.434-3.432A6.5 6.5 0 0 1 0 6.5" />
        </svg>
        ScanSci
        <svg viewBox="0 0 16 16" className="h-3 w-3 flex-none text-slate-400" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
        </svg>
      </a>

      <div className="flex items-center gap-0.5">
        {OTHER_APPS.map((app) => (
          <a
            key={app.name}
            href={app.url}
            className="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors t-hover"
          >
            {app.name}
          </a>
        ))}
      </div>
    </nav>
  );
}

function StatusChip({ label, accent = false }) {
  const { theme } = useTheme();
  if (accent) {
    return (
      <span
        className="rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
        style={{
          borderColor: theme.colors[0] + "40",
          background: theme.colors[0] + "10",
          color: theme.colors[0],
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {label}
    </span>
  );
}

function MapToolbar({ graphData, selectedPaper, status, t }) {
  const seedNode = graphData?.nodes?.find((node) => node.id === graphData.seed_paper_id);
  const title = selectedPaper?.title || seedNode?.title || t("search.researchMap");
  const modeLabel = graphData?.mode === "topic_fallback" ? t("toolbar.topicFallback") : t("toolbar.citationMap");

  return (
    <section className="px-3 pb-3 sm:px-4">
      <div className="paper-surface rounded-[22px] px-5 py-4 sm:px-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <h1 className="text-[1.15rem] font-semibold leading-tight text-slate-950 xl:max-w-[52rem]">{title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusChip label={modeLabel} accent />
              <StatusChip label={t("status.nodes", { count: graphData?.nodes?.length || 0 })} />
              <StatusChip label={t("status.edges", { count: graphData?.edges?.length || 0 })} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <StatusChip label={status === "loadingGraph" ? t("status.updating") : t("status.ready")} />
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="paper-surface grid min-h-[680px] gap-3 rounded-[24px] p-4 xl:grid-cols-[280px_minmax(0,1fr)_320px] 2xl:grid-cols-[300px_minmax(0,1fr)_340px]">
      <div className="rounded-[20px] border border-slate-200 bg-white p-4">
        <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="h-3 w-12 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="h-4 w-52 animate-pulse rounded-full bg-slate-200" />
          <div className="h-8 w-40 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="mt-4 h-[560px] rounded-[18px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)]" />
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-4/5 animate-pulse rounded-[14px] bg-slate-200" />
        <div className="mt-3 grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-[16px] bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ t }) {
  return (
    <div className="paper-surface rounded-[24px] p-6">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-800">{t("empty.heading")}</h1>
      </div>
    </div>
  );
}

function ErrorState({ error, t }) {
  return (
    <div className="paper-surface flex min-h-[560px] flex-col justify-end rounded-[24px] p-8">
      <p className="panel-title text-rose-500">{t("errors.label")}</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900">{t("errors.graphTitle")}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{error}</p>
    </div>
  );
}

export default function App() {
  const { t } = useLanguage();
  const {
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
  } = useGraph();

  const deferredGraphData = useDeferredValue(graphData);
  const fallbackSelectedPaper =
    selectedPaper || deferredGraphData?.nodes?.find((node) => node.id === selectedPaperId) || null;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <ScanSciGlobalNav />
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col pt-10">
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSelectResult={(paper) => loadGraph(paper.paper_id, { title: paper.title })}
          results={searchResults}
          isSearching={status === "searching"}
          searchError={searchError}
          status={status}
        />

        <div className="flex-1 min-h-0 px-3 pb-3 sm:px-4">
          {status === "loadingGraph" && !deferredGraphData ? <LoadingSkeleton /> : null}
          {status === "error" && !deferredGraphData ? <ErrorState error={error} t={t} /> : null}
          {!deferredGraphData && status !== "loadingGraph" && status !== "error" ? <EmptyState t={t} /> : null}

          {deferredGraphData ? (
            <div className="grid min-h-0 gap-3 xl:h-[calc(100vh-170px)] xl:min-h-[620px] xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:overflow-hidden 2xl:grid-cols-[300px_minmax(0,1fr)_340px]">
              <PaperRail
                className="hidden xl:flex"
                data={deferredGraphData}
                seedPaperId={activeGraphSeedId}
                selectedPaperId={selectedPaperId}
                onSelectPaper={(paperId, fallbackNode) => selectPaper(paperId, fallbackNode)}
                priorDerivative={priorDerivative}
                isPriorDerivativeLoading={isPriorDerivativeLoading}
                onLoadPriorDerivative={loadPriorDerivative}
              />

              <main className="min-h-0 min-w-0">
                <div className="mb-3 xl:hidden">
                  <PaperRail
                    compact
                    data={deferredGraphData}
                    seedPaperId={activeGraphSeedId}
                    selectedPaperId={selectedPaperId}
                    onSelectPaper={(paperId, fallbackNode) => selectPaper(paperId, fallbackNode)}
                  />
                </div>

                <div className="relative h-[min(72vh,840px)] min-h-[520px] xl:h-full">
                  <GraphCanvas
                    data={deferredGraphData}
                    seedPaperId={activeGraphSeedId}
                    selectedPaperId={selectedPaperId}
                    onClearSelection={clearSelection}
                    onSelectPaper={(paperId, fallbackNode) => selectPaper(paperId, fallbackNode)}
                  />

                  {status === "loadingGraph" ? (
                    <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-white/55 backdrop-blur-[2px]">
                      <div className="absolute left-4 top-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                        {t("common.loadingGraph")}
                      </div>
                    </div>
                  ) : null}
                </div>
              </main>

              <PaperPanel
                isOpen={Boolean(selectedPaperId)}
                isLoading={isDetailLoading}
                onClose={clearSelection}
                onRecenter={recenter}
                paper={fallbackSelectedPaper}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
