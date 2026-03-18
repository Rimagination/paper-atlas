import { useState } from "react";
import { useLanguage } from "../i18n";

function AtlasLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
      {/* 外圈 */}
      <circle cx="24" cy="24" r="20" fill="none" stroke="#6D28D9" strokeWidth="2.5" opacity="0.3" />
      {/* 内圈 */}
      <circle cx="24" cy="24" r="14" fill="none" stroke="#6D28D9" strokeWidth="2" opacity="0.5" />
      {/* 指南针指针 - 北 */}
      <path d="M24 6 L28 24 L24 20 L20 24 Z" fill="#6D28D9" />
      {/* 指南针指针 - 南 */}
      <path d="M24 42 L20 24 L24 28 L28 24 Z" fill="#F97316" opacity="0.8" />
      {/* 中心点 */}
      <circle cx="24" cy="24" r="3" fill="#6D28D9" />
      {/* 方位标记 */}
      <circle cx="24" cy="8" r="2" fill="#6D28D9" />
      <circle cx="24" cy="40" r="1.5" fill="#F97316" opacity="0.6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-slate-400" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15m0-2a9.5 9.5 0 1 0 5.92 16.93l4.32 4.32l1.41-1.41l-4.32-4.32A9.5 9.5 0 0 0 10.5 1"
      />
    </svg>
  );
}

function LanguageSwitch() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1"
      aria-label={t("search.language")}
      role="group"
    >
      {["zh", "en"].map((option) => {
        const active = locale === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
              active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
            aria-pressed={active}
          >
            {t(`language.${option}`)}
          </button>
        );
      })}
    </div>
  );
}

function MetaDot() {
  return (
    <span aria-hidden="true" className="text-slate-300">
      ·
    </span>
  );
}

function formatAuthors(authors, t) {
  if (!authors?.length) {
    return t("rail.unknownAuthors");
  }

  return authors.slice(0, 2).join(", ");
}

export default function SearchBar({
  query,
  onQueryChange,
  onSelectResult,
  results,
  isSearching,
  searchError,
  status
}) {
  const { t } = useLanguage();
  const [isFocused, setIsFocused] = useState(false);

  const showDropdown =
    isFocused &&
    (query.trim().length >= 3 || query.includes("10.")) &&
    (results.length > 0 || isSearching || searchError);

  return (
    <header className="sticky top-10 z-50 px-3 pt-3 sm:px-4">
      <div className="paper-surface relative overflow-visible rounded-[24px] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-5">
          <div className="flex shrink-0 items-center gap-3 xl:w-[250px]">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8f7fc_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <AtlasLogo />
            </div>

            <div className="min-w-0">
              <div className="font-heading text-[1.2rem] font-semibold tracking-[-0.04em] text-slate-950">Paper Atlas</div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{t("search.tagline")}</div>
            </div>
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white/94 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <SearchIcon />

              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
                placeholder={t("search.placeholder")}
                className="w-full bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
                aria-label={t("search.aria")}
              />

              <span className="hidden whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 sm:block">
                {t("search.support")}
              </span>
            </div>

            {showDropdown ? (
              <div className="paper-surface absolute left-0 right-0 top-[calc(100%+12px)] z-30 overflow-hidden rounded-[20px] shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                {isSearching ? (
                  <div className="flex items-center gap-3 px-5 py-5 text-sm text-slate-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
                    {t("search.searching")}
                  </div>
                ) : null}

                {!isSearching && searchError ? <div className="px-5 py-5 text-sm text-rose-600">{searchError}</div> : null}

                {!isSearching && !searchError && results.length === 0 ? (
                  <div className="px-5 py-5 text-sm text-slate-500">{t("search.noResults")}</div>
                ) : null}

                {results.length > 0 ? (
                  <ul className="max-h-[420px] overflow-y-auto py-2">
                    {results.map((paper) => (
                      <li key={paper.paper_id} className="px-2">
                        <button
                          type="button"
                          onMouseDown={() => onSelectResult(paper)}
                          className="w-full rounded-[16px] border border-transparent px-4 py-4 text-left transition hover:border-slate-200 hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-[15px] font-medium leading-6 text-slate-900">{paper.title}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{formatAuthors(paper.authors, t)}</span>
                                <MetaDot />
                                <span>{paper.year || t("panel.yearUnknown")}</span>
                                <MetaDot />
                                <span>{t("rail.citations", { count: paper.citation_count || 0 })}</span>
                              </div>
                            </div>

                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {t("search.open")}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </header>
  );
}
