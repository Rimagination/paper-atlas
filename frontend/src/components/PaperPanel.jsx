import { useEffect, useState } from "react";
import { buildPaperLinks, resolvePaperUrl } from "../utils/papers";
import { useLanguage } from "../i18n";

function truncateAbstract(abstract, expanded, fallback, ellipsis) {
  if (!abstract) {
    return fallback;
  }

  if (expanded || abstract.length <= 300) {
    return abstract;
  }

  return `${abstract.slice(0, 300).trim()}${ellipsis}`;
}

function formatAuthors(authors = [], t) {
  if (!authors.length) {
    return t("panel.unknownAuthors");
  }

  if (authors.length <= 5) {
    return authors.join(", ");
  }

  return `${authors.slice(0, 5).join(", ")} ${t("panel.authorOverflow", { count: authors.length - 5 })}`;
}

function Metric({ label, value, accent = false }) {
  return (
    <div
      className={`rounded-[14px] border px-3 py-3 ${
        accent ? "border-violet-200 bg-violet-50 text-violet-900" : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

export default function PaperPanel({ isOpen, isLoading, onClose, onRecenter, paper }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [paper?.id, paper?.paper_id]);

  const paperId = paper?.paper_id || paper?.id;
  const title = paper?.title || t("panel.selectPaper");
  const authors = formatAuthors(paper?.authors, t);
  const abstract = truncateAbstract(paper?.abstract, expanded, t("panel.noAbstract"), t("common.ellipsis"));
  const primaryUrl = resolvePaperUrl(paper);
  const sourceLinks = buildPaperLinks(paper, {
    doi: t("links.doi"),
    openSource: t("links.openSource"),
    openAlex: t("links.openAlex"),
    frontiers: t("links.frontiers"),
    semanticScholar: t("links.semanticScholar")
  });

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[2px] transition xl:hidden ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`paper-surface fixed inset-x-3 bottom-3 z-40 max-h-[82vh] rounded-[22px] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)] transition duration-300 xl:static xl:block xl:h-full xl:max-h-none xl:min-h-0 xl:rounded-[22px] xl:translate-y-0 xl:opacity-100 ${
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 xl:pointer-events-auto"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-end gap-4 border-b border-slate-200 pb-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 xl:hidden"
            >
              {t("panel.close")}
            </button>
          </div>

          {paper ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="rounded-[18px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {paper?.is_seed ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                      {t("panel.originPaper")}
                    </span>
                  ) : null}
                  {paper?.doi ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
                      {t("panel.doiLinked")}
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-3 text-[1.55rem] font-semibold leading-tight text-slate-950">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{authors}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {paper.year || t("panel.yearUnknown")}
                  {t("common.separator")}
                  {paper.venue || t("panel.venueUnavailable")}
                </p>

                {sourceLinks.length ? (
                  <div className="mt-4">
                    <p className="panel-title">{t("panel.openIn")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sourceLinks.map((link) => (
                        <a
                          key={`${link.label}-${link.href}`}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                            link.primary
                              ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                          }`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Metric label={t("panel.citations")} value={`${paper.citation_count || 0}`} accent />
                <Metric label={t("panel.year")} value={paper.year || t("rail.na")} />
                <Metric label={t("panel.references")} value={paper.reference_count || t("rail.na")} />
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white p-5">
                <p className="panel-title">{t("panel.abstract")}</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-700">{abstract}</p>
                {paper?.abstract?.length > 300 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    className="mt-4 text-sm font-medium text-slate-700 transition hover:text-slate-950"
                  >
                    {expanded ? t("panel.showLess") : t("panel.readMore")}
                  </button>
                ) : null}
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => paperId && onRecenter(paperId)}
                  className="rounded-[16px] border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  {t("panel.useAsOrigin")}
                </button>
                {primaryUrl ? (
                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {t("panel.openOriginal")}
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-dashed border-slate-200 bg-white/70 p-6 text-sm leading-8 text-slate-500">
              {t("panel.emptyHint")}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
