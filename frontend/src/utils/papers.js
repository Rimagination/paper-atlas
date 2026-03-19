const OPENALEX_ID_PATTERN = /^W\d+$/i;

function resolvePaperId(paper) {
  return paper?.paper_id || paper?.paperId || paper?.id || null;
}

function normalizeDoi(rawDoi) {
  if (!rawDoi) {
    return null;
  }

  return rawDoi.replace(/^https?:\/\/doi\.org\//i, "").replace(/^doi:/i, "").trim();
}

export function resolveDoiUrl(paper) {
  const doi =
    normalizeDoi(paper?.doi) ||
    normalizeDoi(paper?.externalIds?.DOI) ||
    normalizeDoi(paper?.externalIds?.doi);

  return doi ? `https://doi.org/${doi}` : null;
}

export function resolvePaperUrl(paper) {
  const doiUrl = resolveDoiUrl(paper);
  if (doiUrl) {
    return doiUrl;
  }

  if (paper?.url) {
    return paper.url;
  }

  const paperId = resolvePaperId(paper);
  if (!paperId) {
    return null;
  }

  if (OPENALEX_ID_PATTERN.test(paperId)) {
    return `https://openalex.org/${paperId}`;
  }

  if (paperId.startsWith("FRONTIERS:")) {
    return `https://www.frontiersin.org/search?query=${encodeURIComponent(paper?.title || paperId)}`;
  }

  return `https://www.semanticscholar.org/paper/${paperId}`;
}

export function resolveReferenceUrl(paper) {
  const paperId = resolvePaperId(paper);
  if (!paperId) {
    return null;
  }

  if (OPENALEX_ID_PATTERN.test(paperId)) {
    return `https://openalex.org/${paperId}`;
  }

  if (paperId.startsWith("FRONTIERS:")) {
    return paper?.url || `https://www.frontiersin.org/search?query=${encodeURIComponent(paper?.title || paperId)}`;
  }

  return `https://www.semanticscholar.org/paper/${paperId}`;
}

export function buildPaperLinks(paper, labels = {}) {
  const {
    doi = "DOI",
    openSource = "Open source",
    openAlex = "OpenAlex",
    frontiers = "Frontiers",
    semanticScholar = "Semantic Scholar",
    googleScholar = "Google Scholar"
  } = labels;
  const primaryUrl = resolvePaperUrl(paper);
  const referenceUrl = resolveReferenceUrl(paper);
  const links = [];

  if (primaryUrl) {
    links.push({
      href: primaryUrl,
      label: resolveDoiUrl(paper) ? doi : openSource,
      icon: resolveDoiUrl(paper) ? "doi" : "link",
      primary: true
    });
  }

  if (referenceUrl && referenceUrl !== primaryUrl) {
    const paperId = resolvePaperId(paper) || "";
    links.push({
      href: referenceUrl,
      label: OPENALEX_ID_PATTERN.test(paperId)
        ? openAlex
        : paperId.startsWith("FRONTIERS:")
          ? frontiers
          : semanticScholar,
      icon: OPENALEX_ID_PATTERN.test(paperId) ? "openalex" : "semantic",
      primary: false
    });
  }

  if (paper?.title) {
    links.push({
      href: `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`,
      label: googleScholar,
      icon: "scholar",
      primary: false
    });
  }

  return links;
}
