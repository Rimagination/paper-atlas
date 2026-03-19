import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "paper-atlas-theme";

export const THEMES = {
  aurora: {
    label: "Aurora",
    swatch: "#9333ea",
    colors: ["#4f46e5", "#9333ea", "#ec4899"],
    edge: "rgba(139,92,246,0.45)",
    seedStroke: "#f472b6",
    selectedStroke: "#7c3aed",
    labelColor: "#3b1f6e",
    noYear: "#818cf8",
    bg: "linear-gradient(160deg, #f5f3ff 0%, #fdf4ff 55%, #fef9f0 100%)",
    blobs: [
      "radial-gradient(ellipse 50% 40% at 12% 18%, rgba(167,139,250,0.14) 0%, transparent 60%)",
      "radial-gradient(ellipse 42% 32% at 88% 22%, rgba(244,114,182,0.1) 0%, transparent 55%)",
      "radial-gradient(ellipse 38% 48% at 55% 92%, rgba(99,102,241,0.08) 0%, transparent 50%)",
    ],
    legendGradient: "linear-gradient(90deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)",
    bodyBg:
      "radial-gradient(circle at top left, rgba(79,70,229,0.08), transparent 24%), radial-gradient(circle at top right, rgba(236,72,153,0.06), transparent 22%), linear-gradient(180deg, #faf9fc 0%, #f3f1f7 100%)",
  },
  ocean: {
    label: "Ocean",
    swatch: "#06b6d4",
    colors: ["#2563eb", "#06b6d4", "#10b981"],
    edge: "rgba(6,182,212,0.4)",
    seedStroke: "#34d399",
    selectedStroke: "#1d4ed8",
    labelColor: "#0c4a6e",
    noYear: "#38bdf8",
    bg: "linear-gradient(160deg, #eff6ff 0%, #ecfeff 55%, #f0fdf4 100%)",
    blobs: [
      "radial-gradient(ellipse 50% 40% at 12% 18%, rgba(14,165,233,0.13) 0%, transparent 60%)",
      "radial-gradient(ellipse 42% 32% at 88% 22%, rgba(16,185,129,0.1) 0%, transparent 55%)",
      "radial-gradient(ellipse 38% 48% at 55% 92%, rgba(37,99,235,0.08) 0%, transparent 50%)",
    ],
    legendGradient: "linear-gradient(90deg, #2563eb 0%, #06b6d4 50%, #10b981 100%)",
    bodyBg:
      "radial-gradient(circle at top left, rgba(37,99,235,0.08), transparent 24%), radial-gradient(circle at top right, rgba(16,185,129,0.06), transparent 22%), linear-gradient(180deg, #f8fbff 0%, #effaf6 100%)",
  },
  sunset: {
    label: "Sunset",
    swatch: "#f97316",
    colors: ["#f59e0b", "#f97316", "#ef4444"],
    edge: "rgba(249,115,22,0.4)",
    seedStroke: "#fca5a5",
    selectedStroke: "#b45309",
    labelColor: "#7c2d12",
    noYear: "#fcd34d",
    bg: "linear-gradient(160deg, #fffbeb 0%, #fff7ed 55%, #fff1f2 100%)",
    blobs: [
      "radial-gradient(ellipse 50% 40% at 12% 18%, rgba(245,158,11,0.13) 0%, transparent 60%)",
      "radial-gradient(ellipse 42% 32% at 88% 22%, rgba(239,68,68,0.1) 0%, transparent 55%)",
      "radial-gradient(ellipse 38% 48% at 55% 92%, rgba(249,115,22,0.08) 0%, transparent 50%)",
    ],
    legendGradient: "linear-gradient(90deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)",
    bodyBg:
      "radial-gradient(circle at top left, rgba(245,158,11,0.08), transparent 24%), radial-gradient(circle at top right, rgba(239,68,68,0.06), transparent 22%), linear-gradient(180deg, #fdfbf5 0%, #faf5f0 100%)",
  },
  forest: {
    label: "Forest",
    swatch: "#16a34a",
    colors: ["#059669", "#16a34a", "#84cc16"],
    edge: "rgba(22,163,74,0.4)",
    seedStroke: "#86efac",
    selectedStroke: "#065f46",
    labelColor: "#14532d",
    noYear: "#6ee7b7",
    bg: "linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 55%, #f7fee7 100%)",
    blobs: [
      "radial-gradient(ellipse 50% 40% at 12% 18%, rgba(5,150,105,0.13) 0%, transparent 60%)",
      "radial-gradient(ellipse 42% 32% at 88% 22%, rgba(132,204,22,0.1) 0%, transparent 55%)",
      "radial-gradient(ellipse 38% 48% at 55% 92%, rgba(22,163,74,0.08) 0%, transparent 50%)",
    ],
    legendGradient: "linear-gradient(90deg, #059669 0%, #16a34a 50%, #84cc16 100%)",
    bodyBg:
      "radial-gradient(circle at top left, rgba(5,150,105,0.08), transparent 24%), radial-gradient(circle at top right, rgba(132,204,22,0.06), transparent 22%), linear-gradient(180deg, #f7fdf9 0%, #f0f8f2 100%)",
  },
  mono: {
    label: "Mono",
    swatch: "#64748b",
    colors: ["#334155", "#64748b", "#94a3b8"],
    edge: "rgba(100,116,139,0.4)",
    seedStroke: "#94a3b8",
    selectedStroke: "#1e293b",
    labelColor: "#1e293b",
    noYear: "#94a3b8",
    bg: "linear-gradient(160deg, #f8fafc 0%, #f1f5f9 55%, #f8fafc 100%)",
    blobs: [
      "radial-gradient(ellipse 50% 40% at 12% 18%, rgba(100,116,139,0.1) 0%, transparent 60%)",
      "radial-gradient(ellipse 42% 32% at 88% 22%, rgba(148,163,184,0.08) 0%, transparent 55%)",
      "radial-gradient(ellipse 38% 48% at 55% 92%, rgba(51,65,85,0.06) 0%, transparent 50%)",
    ],
    legendGradient: "linear-gradient(90deg, #334155 0%, #64748b 50%, #94a3b8 100%)",
    bodyBg:
      "radial-gradient(circle at top left, rgba(100,116,139,0.06), transparent 24%), radial-gradient(circle at top right, rgba(148,163,184,0.04), transparent 22%), linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)",
  },
};

function getInitialThemeKey() {
  try {
    const stored = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES[stored]) return stored;
  } catch (_) { /* ignore */ }
  return "aurora";
}

function applyCssVars(theme) {
  const r = document.documentElement;
  r.style.setProperty("--t-0", theme.colors[0]);
  r.style.setProperty("--t-1", theme.colors[1]);
  r.style.setProperty("--t-2", theme.colors[2]);
  // Pre-computed alpha variants for CSS hover/focus rules
  r.style.setProperty("--t-0-bg", theme.colors[0] + "12");   // ~7% alpha
  r.style.setProperty("--t-0-border", theme.colors[0] + "26"); // ~15% alpha
  r.style.setProperty("--t-sel", theme.colors[1] + "33");      // 20% alpha – text selection
  r.style.setProperty("--t-scroll", theme.colors[1] + "44");   // 27% alpha – scrollbar
  r.style.setProperty("--t-body-bg", theme.bodyBg);
}

const ThemeContext = createContext({
  themeKey: "aurora",
  theme: THEMES.aurora,
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(getInitialThemeKey);

  useEffect(() => {
    applyCssVars(THEMES[themeKey]);
    try { window.localStorage.setItem(STORAGE_KEY, themeKey); } catch (_) { /* ignore */ }
  }, [themeKey]);

  // Apply on mount (SSR-safe)
  useEffect(() => { applyCssVars(THEMES[themeKey]); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setTheme(key) {
    if (THEMES[key]) setThemeKey(key);
  }

  return (
    <ThemeContext.Provider value={{ themeKey, theme: THEMES[themeKey], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
