import { useEffect, useState } from "react";
import { buildPaperLinks, resolvePaperUrl } from "../utils/papers";
import { useLanguage } from "../i18n";

function truncateAbstract(abstract, expanded, fallback, ellipsis) {
  if (!abstract) return fallback;
  if (expanded || abstract.length <= 320) return abstract;
  return `${abstract.slice(0, 320).trim()}${ellipsis}`;
}

function formatAuthors(authors = [], t) {
  if (!authors.length) return t("panel.unknownAuthors");
  if (authors.length <= 5) return authors.join(", ");
  return `${authors.slice(0, 5).join(", ")} ${t("panel.authorOverflow", { count: authors.length - 5 })}`;
}

function CitationIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.5 8.9-3 2.7a.75.75 0 0 1-1-.02l-3-2.7A.75.75 0 1 1 5.5 7.8L8 10.06l2.5-2.26a.75.75 0 1 1 1 1.1Z" />
    </svg>
  );
}

/* Source link icons */
function IconDOI() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="2" />
      <line x1="7" y1="7" x2="13" y2="7" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="13" x2="11" y2="13" />
    </svg>
  );
}

function IconSemantic() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm0 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm.7 2.5H8.5l-1.3 5h1.5l.2-1h1.8l.3 1h1.5L10.7 7Zm-.3 1.5.6 2.5H9.8l.6-2.5Z" />
    </svg>
  );
}

function IconScholar() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M10 2 2 6.5l2.5 1.4V13l5.5 3 5.5-3V7.9L17.5 7V13h1.5V6.5L10 2ZM5 13.2V9.2l5 2.7 5-2.7v4l-5 2.7-5-2.7Z" />
    </svg>
  );
}

function IconOpenAlex() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5v10M5 10h10" strokeLinecap="round" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M7.5 12.5 12.5 7.5M8.5 6H6A3.5 3.5 0 0 0 6 13h2.5M11.5 14H14A3.5 3.5 0 0 0 14 7h-2.5" strokeLinecap="round" />
    </svg>
  );
}

const ICON_MAP = {
  doi: <IconDOI />,
  semantic: <IconSemantic />,
  scholar: <IconScholar />,
  openalex: <IconOpenAlex />,
  link: <IconLink />
};

const SOURCE_COLORS = {
  doi:      "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
  semantic: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
  scholar:  "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
  openalex: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
  link:     "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
};

function SourceLink({ link }) {
  const icon = ICON_MAP[link.icon] || <IconLink />;
  const colors = SOURCE_COLORS[link.icon] || SOURCE_COLORS.link;
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      title={link.label}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${colors}`}
    >
      {icon}
      {link.label}
    </a>
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
  const authors = formatAuthors(paper?.authors || [], t);
  const abstract = truncateAbstract(paper?.abstract, expanded, t("panel.noAbstract"), t("common.ellipsis"));
  const sourceLinks = buildPaperLinks(paper, {
    doi: t("links.doi"),
    openSource: t("links.openSource"),
    openAlex: t("links.openAlex"),
    frontiers: t("links.frontiers"),
    semanticScholar: t("links.semanticScholar"),
    googleScholar: t("links.googleScholar")
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
        className={`paper-surface fixed inset-x-3 bottom-3 z-40 max-h-[82vh] rounded-[22px] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)] transition duration-300 xl:static xl:block xl:h-full xl:max-h-none xl:min-h-0 xl:rounded-[22px] xl:translate-y-0 xl:opacity-100 ${
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 xl:pointer-events-auto"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col gap-3">
          {/* Close (mobile only) */}
          <div className="flex items-center justify-between xl:hidden">
            <span className="text-[11px] uppercase tracking-[0.15em] text-slate-400">{t("panel.paperDetail")}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300"
            >
              {t("panel.close")}
            </button>
          </div>

          {paper ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">

              {/* ── Header card ── */}
              <div className="rounded-[18px] border border-slate-200 bg-white p-4">

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {paper?.is_seed ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                      {t("panel.originPaper")}
                    </span>
                  ) : null}
                  {paper?.doi ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      DOI
                    </span>
                  ) : null}
                </div>

                {/* Title */}
                <h2 className="mt-2 text-[1.1rem] font-semibold leading-snug text-slate-950">{title}</h2>

                {/* Authors */}
                <p className="mt-1.5 text-[12px] leading-5 text-slate-500">{authors}</p>

                {/* Meta row: year · venue · citations */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                  <span>{paper?.year || t("panel.yearUnknown")}</span>
                  {paper?.venue ? <span className="text-slate-400">·</span> : null}
                  {paper?.venue ? <span className="truncate max-w-[14rem]">{paper.venue}</span> : null}
                  <span className="text-slate-400">·</span>
                  <span className="flex items-center gap-1 text-violet-700">
                    <CitationIcon />
                    {(paper?.citation_count || 0).toLocaleString()} {t("panel.citations")}
                  </span>
                  {paper?.reference_count != null ? (
                    <>
                      <span className="text-slate-400">·</span>
                      <span>{paper.reference_count} refs</span>
                    </>
                  ) : null}
                </div>

                {/* Source links */}
                {sourceLinks.length ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">{t("panel.openIn")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sourceLinks.map((link) => (
                        <SourceLink key={`${link.icon}-${link.href}`} link={link} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* ── Abstract card ── */}
              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <p className="panel-title">{t("panel.abstract")}</p>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.85] text-slate-700">{abstract}</p>
                {paper?.abstract?.length > 320 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((c) => !c)}
                    className="mt-3 text-[12px] font-medium text-violet-600 transition hover:text-violet-800"
                  >
                    {expanded ? t("panel.showLess") : t("panel.readMore")}
                  </button>
                ) : null}
              </div>

              {/* ── Actions ── */}
              <button
                type="button"
                onClick={() => paperId && onRecenter(paperId)}
                className="rounded-[16px] border border-slate-900 bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800"
              >
                {t("panel.useAsOrigin")}
              </button>
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
