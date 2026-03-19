import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "paper-atlas-language";

const messages = {
  en: {
    page: {
      title: "Paper Atlas | Research Map Workbench"
    },
    search: {
      tagline: "Research map workbench",
      placeholder: "Search by paper title or DOI",
      support: "Title / DOI",
      aria: "Search papers",
      searching: "Searching scholarly indexes...",
      noResults: "No matching papers found.",
      open: "Open",
      localMvp: "Local MVP",
      researchMap: "Research map",
      language: "Language"
    },
    language: {
      zh: "中文",
      en: "EN"
    },
    toolbar: {
      currentMap: "Current map",
      citationMap: "Citation map",
      topicFallback: "Topic fallback",
      citationDescription:
        "This map combines bibliographic coupling and co-citation to surface nearby papers quickly.",
      topicDescription:
        "Citation coverage is incomplete, so this workspace is showing a topic-similarity fallback graph.",
      paperCount: ({ count }) => `${count} papers`,
      linkCount: ({ count }) => `${count} links`
    },
    view: {
      map: "Map",
      list: "List",
      detail: "Detail",
      years: "Years"
    },
    status: {
      ready: "Ready",
      updating: "Updating",
      nodes: ({ count }) => `${count} nodes`,
      edges: ({ count }) => `${count} edges`
    },
    empty: {
      workspace: "Research workspace",
      heading: "Start from one paper and turn the surrounding literature into a readable map.",
      description:
        "Paper Atlas lays out the seed paper, nearby works, and metadata in one compact workbench for inspection.",
      titleSearch: "Title search",
      doi: "DOI",
      fallbackMap: "Fallback map",
      list: "List",
      seedPaper: "Seed paper",
      relatedPaper: "High-signal neighbor",
      anotherPaper: "Metadata panel",
      zoomHint: "Zoom, drag, inspect, and open the source",
      detail: "Detail",
      graphPreview: "Map preview",
      graphPreviewText: "Once a graph is ready, the canvas centers the seed and balances related papers by similarity.",
      detailPreviewTitle: "What you get",
      detailPreviewText: "Authors, venue, citations, abstract, DOI, and jump-out links all stay one click away."
    },
    errors: {
      label: "Error",
      graphTitle: "Unable to build the graph.",
      searchUnavailable: "Search is temporarily unavailable.",
      detailUnavailable: "Paper detail could not be loaded.",
      graphUnavailable: "Graph loading failed. Please try again shortly."
    },
    rail: {
      unknownAuthors: "Unknown authors",
      origin: "Origin",
      seed: "Seed",
      na: "N/A",
      cites: ({ count }) => `${count} cites`,
      paperList: "Paper list",
      originRelated: "Origin and related papers",
      paperCount: ({ count }) => `${count} papers`,
      instruction: "Select a paper to inspect it. Use the external-link button to open the source directly.",
      compactInstruction: "Scroll horizontally to skim the current map quickly.",
      citations: ({ count }) => `${count} citations`,
      openSourceAria: ({ title }) => `Open source for ${title}`,
      openSourceTitle: "Open source",
      tabSimilar: "Similar",
      tabPrior: "Prior works",
      tabDerivative: "Derivative works",
      priorDesc: "Papers cited by the origin paper — the foundational works it builds upon.",
      derivativeDesc: "Papers published after the origin that cite it — works it has influenced.",
      loadingWorks: "Loading...",
      emptyWorks: "No data available."
    },
    panel: {
      noAbstract: "No abstract is currently available.",
      unknownAuthors: "Unknown authors",
      authorOverflow: ({ count }) => `+${count} more`,
      selectPaper: "Select a paper",
      paperDetail: "Paper detail",
      loadingDetail: "Loading full detail...",
      detailHint: "Read metadata, abstract, and jump to the source.",
      originPaper: "Origin paper",
      doiLinked: "DOI linked",
      yearUnknown: "Year unknown",
      venueUnavailable: "Venue unavailable",
      openIn: "Open in",
      citations: "Citations",
      year: "Year",
      references: "References",
      abstract: "Abstract",
      showLess: "Show less",
      readMore: "Read more",
      useAsOrigin: "Use as origin",
      openOriginal: "Open original",
      emptyHint: "Select any paper from the graph or list to inspect its abstract, metadata, and source links.",
      close: "Close"
    },
    graph: {
      citationMap: "Citation map",
      topicFallback: "Topic fallback",
      inspectHint: "Click to inspect · double-click to open source",
      ariaLabel: "Paper relationship graph",
      yearPalette: "Year palette",
      topicFallbackWarning:
        "This paper does not have a complete citation network yet, so a topic-based fallback map is being shown."
    },
    links: {
      doi: "DOI",
      openSource: "Open source",
      openAlex: "OpenAlex",
      frontiers: "Frontiers",
      semanticScholar: "Semantic Scholar",
      googleScholar: "Google Scholar"
    },
    common: {
      separator: " · ",
      ellipsis: "...",
      loadingGraph: "Updating graph..."
    }
  },
  zh: {
    page: {
      title: "Paper Atlas | 研究图谱工作台"
    },
    search: {
      tagline: "研究图谱工作台",
      placeholder: "输入论文标题或 DOI",
      support: "标题 / DOI",
      aria: "搜索论文",
      searching: "正在检索学术索引...",
      noResults: "未找到匹配论文。",
      open: "打开",
      localMvp: "本地 MVP",
      researchMap: "研究图谱",
      language: "语言"
    },
    language: {
      zh: "中文",
      en: "EN"
    },
    toolbar: {
      currentMap: "当前图谱",
      citationMap: "引文图谱",
      topicFallback: "主题回退图",
      citationDescription: "当前图谱结合 bibliographic coupling 与 co-citation，用于快速定位相关工作。",
      topicDescription: "当前论文的引文覆盖还不完整，因此这里展示的是基于主题相似度生成的回退图谱。",
      paperCount: ({ count }) => `${count} 篇论文`,
      linkCount: ({ count }) => `${count} 条连线`
    },
    view: {
      map: "图谱",
      list: "列表",
      detail: "详情",
      years: "年份"
    },
    status: {
      ready: "就绪",
      updating: "更新中",
      nodes: ({ count }) => `${count} 个节点`,
      edges: ({ count }) => `${count} 条边`
    },
    empty: {
      workspace: "研究工作台",
      heading: "从一篇论文出发，把周边文献整理成清晰、可探索的研究地图。",
      description: "Paper Atlas 会把种子论文、邻近工作和元数据放进同一块工作台，方便你快速筛读与比较。",
      titleSearch: "标题搜索",
      doi: "DOI",
      fallbackMap: "回退图谱",
      list: "列表",
      seedPaper: "种子论文",
      relatedPaper: "高相关邻居",
      anotherPaper: "元数据侧栏",
      zoomHint: "缩放、拖拽、查看详情，并直接打开原文",
      detail: "详情",
      graphPreview: "图谱预览",
      graphPreviewText: "图谱生成后，画布会固定种子论文，并按相似度把相关工作组织到同一张图里。",
      detailPreviewTitle: "你会看到",
      detailPreviewText: "作者、来源、引用数、摘要、DOI 和外链入口都会保持在一屏内。"
    },
    errors: {
      label: "错误",
      graphTitle: "图谱暂时无法生成。",
      searchUnavailable: "搜索服务暂时不可用。",
      detailUnavailable: "论文详情加载失败。",
      graphUnavailable: "图谱加载失败，请稍后重试。"
    },
    rail: {
      unknownAuthors: "未知作者",
      origin: "原论文",
      seed: "种子",
      na: "未知",
      cites: ({ count }) => `${count} 次引用`,
      paperList: "论文列表",
      originRelated: "原论文与相关论文",
      paperCount: ({ count }) => `${count} 篇论文`,
      instruction: "点击论文查看详情，右侧外链按钮可直接打开原文。",
      compactInstruction: "横向滚动即可快速浏览当前图谱里的关键论文。",
      citations: ({ count }) => `${count} 次引用`,
      openSourceAria: ({ title }) => `打开《${title}》的原文`,
      openSourceTitle: "打开原文",
      tabSimilar: "相关论文",
      tabPrior: "前序工作",
      tabDerivative: "派生工作",
      priorDesc: "原论文引用的文献——它所站立的"前人肩膀"。",
      derivativeDesc: "发表于原论文之后并引用它的工作——它所影响的后继研究。",
      loadingWorks: "加载中...",
      emptyWorks: "暂无数据。"
    },
    panel: {
      noAbstract: "暂未提供摘要信息。",
      unknownAuthors: "未知作者",
      authorOverflow: ({ count }) => `+${count} 位作者`,
      selectPaper: "选择论文",
      paperDetail: "论文详情",
      loadingDetail: "正在加载完整详情...",
      detailHint: "在这里查看元数据、摘要和原文入口。",
      originPaper: "原论文",
      doiLinked: "已关联 DOI",
      yearUnknown: "年份未知",
      venueUnavailable: "来源未知",
      openIn: "打开方式",
      citations: "引用",
      year: "年份",
      references: "参考文献",
      abstract: "摘要",
      showLess: "收起",
      readMore: "展开",
      useAsOrigin: "以此为中心",
      openOriginal: "打开原文",
      emptyHint: "从图谱或列表中选择一篇论文，即可查看摘要、元数据和原文入口。",
      close: "关闭"
    },
    graph: {
      citationMap: "引文图谱",
      topicFallback: "主题回退图",
      inspectHint: "单击查看详情 · 双击打开原文",
      ariaLabel: "论文关系图谱",
      yearPalette: "年份色带",
      topicFallbackWarning: "当前论文尚未形成完整引文网络，因此这里展示的是基于主题相似度的回退图谱。"
    },
    links: {
      doi: "DOI",
      openSource: "原文",
      openAlex: "OpenAlex",
      frontiers: "Frontiers",
      semanticScholar: "Semantic Scholar",
      googleScholar: "谷歌学术"
    },
    common: {
      separator: " · ",
      ellipsis: "...",
      loadingGraph: "正在更新图谱..."
    }
  }
};

function getInitialLocale() {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh") {
    return stored;
  }

  // 默认中文，用户可通过切换更改
  return "zh";
}

function resolveMessage(locale, key) {
  return key.split(".").reduce((value, segment) => value?.[segment], messages[locale]);
}

function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, token) => `${params[token] ?? ""}`);
}

function translate(locale, key, params) {
  const value = resolveMessage(locale, key);

  if (typeof value === "function") {
    return value(params || {});
  }

  if (typeof value === "string") {
    return interpolate(value, params);
  }

  return key;
}

const LanguageContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: (key, params) => translate("en", key, params)
});

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(getInitialLocale);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }

    if (typeof document !== "undefined") {
      document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
      document.title = translate(locale, "page.title");
    }
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params)
    }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
