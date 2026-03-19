import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { resolvePaperUrl } from "../utils/papers";
import { useLanguage } from "../i18n";

function createNodeRadiusScale(nodes = []) {
  const counts = nodes
    .map((node) => Math.max(node.citation_count || 0, 0))
    .filter((count) => count > 0)
    .sort((left, right) => left - right);

  if (!counts.length) {
    return (node) => (node.is_seed ? 20 : 12);
  }

  const minCount = Math.max(1, counts[0]);
  const maxCount = counts[counts.length - 1];
  const p90Count = d3.quantileSorted(counts, 0.9) ?? maxCount;
  const visualMax = Math.max(minCount + 1, p90Count);
  const radiusScale =
    visualMax > minCount ? d3.scaleLog().domain([minCount, visualMax]).range([8, 44]).clamp(true) : () => 24;

  return (node) => {
    const count = Math.max(node.citation_count || 0, minCount);
    const baseRadius = radiusScale(count);
    return node.is_seed ? Math.max(baseRadius + 4, 24) : baseRadius;
  };
}

function edgeWidth(edge) {
  return 0.8 + edge.weight * 2.8;
}

function edgeOpacity(edge) {
  return 0.1 + edge.weight * 0.32;
}

function trimTitle(title, maxLength = 28) {
  if (!title || title.length <= maxLength) {
    return title;
  }
  return `${title.slice(0, maxLength - 1)}...`;
}

function resolveYearRange(nodes = []) {
  const years = nodes.map((node) => node.year).filter(Boolean);
  if (!years.length) {
    return { minYear: null, maxYear: null };
  }
  return {
    minYear: Math.min(...years),
    maxYear: Math.max(...years)
  };
}

export default function GraphCanvas({
  data,
  onClearSelection,
  onSelectPaper,
  seedPaperId,
  selectedPaperId
}) {
  const { t } = useLanguage();
  const frameRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { minYear, maxYear } = resolveYearRange(data?.nodes);

  useEffect(() => {
    if (!frameRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(entry.contentRect.width, 320);
      const height = Math.max(entry.contentRect.height, 520);
      setDimensions({ width, height });
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data || !dimensions.width || !dimensions.height) return undefined;

    const width = dimensions.width;
    const height = dimensions.height;
    const nodes = data.nodes.map((node) => ({ ...node }));
    const links = data.edges.map((edge) => ({ ...edge }));
    const nodeRadius = createNodeRadiusScale(nodes);
    const linkedById = new Set();
    const yearDomainMin = minYear ?? 2015;
    const yearDomainMax = maxYear ?? yearDomainMin + 8;
    const midYear = (yearDomainMin + yearDomainMax) / 2;

    // Dreamy spectrum on bright background: indigo → violet → rose
    const yearScale = d3
      .scaleLinear()
      .domain(
        yearDomainMin === yearDomainMax
          ? [yearDomainMin - 1, yearDomainMin, yearDomainMax + 1]
          : [yearDomainMin, midYear, yearDomainMax]
      )
      .range(["#4f46e5", "#9333ea", "#ec4899"]);

    links.forEach((edge) => {
      linkedById.add(`${edge.source}|${edge.target}`);
      linkedById.add(`${edge.target}|${edge.source}`);
    });

    const isNeighbor = (s, t) => s === t || linkedById.has(`${s}|${t}`);
    const nodeColor = (node) => (node.year ? yearScale(node.year) : "#818cf8");

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height]).style("cursor", "grab");

    // ── SVG defs: soft glow filters ──────────────────────────────────────
    const defs = svg.append("defs");

    // Dreamy halo for regular nodes — on light bg this produces a soft
    // coloured aura that looks like watercolour bleeding
    const starFilter = defs.append("filter")
      .attr("id", "star-glow")
      .attr("x", "-80%").attr("y", "-80%")
      .attr("width", "260%").attr("height", "260%");
    starFilter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "5")
      .attr("result", "blur");
    const sm = starFilter.append("feMerge");
    sm.append("feMergeNode").attr("in", "blur");
    sm.append("feMergeNode").attr("in", "SourceGraphic");

    // Stronger halo for seed node
    const seedFilter = defs.append("filter")
      .attr("id", "seed-glow")
      .attr("x", "-110%").attr("y", "-110%")
      .attr("width", "320%").attr("height", "320%");
    seedFilter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "10")
      .attr("result", "blur");
    const sdm = seedFilter.append("feMerge");
    sdm.append("feMergeNode").attr("in", "blur");
    sdm.append("feMergeNode").attr("in", "SourceGraphic");

    // ── Viewport & zoom ───────────────────────────────────────────────────
    const viewport = svg.append("g");
    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 3.4])
      .on("zoom", (event) => viewport.attr("transform", event.transform));

    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("click", (event) => {
      if (event.target === svg.node()) onClearSelection();
    });

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink(links).id((n) => n.id).distance((e) => Math.max(54, 120 - e.weight * 66))
      )
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((n) => nodeRadius(n) + 8));

    const seedNode = nodes.find((n) => n.id === seedPaperId);
    if (seedNode) {
      seedNode.fx = width / 2;
      seedNode.fy = height / 2;
      seedNode.x  = width / 2;
      seedNode.y  = height / 2;
    }

    const edgeLayer = viewport.append("g").attr("stroke-linecap", "round");
    const nodeLayer = viewport.append("g");

    // ── Edges: translucent violet ─────────────────────────────────────────
    const edgeSelection = edgeLayer
      .selectAll("line").data(links).join("line")
      .attr("stroke", "rgba(139,92,246,0.45)")
      .attr("stroke-width", (e) => edgeWidth(e))
      .attr("stroke-opacity", (e) => edgeOpacity(e));

    const nodeSelection = nodeLayer
      .selectAll("g").data(nodes).join("g")
      .style("cursor", "pointer");

    // ── Nodes: jewel-toned with watercolour glow ──────────────────────────
    const circleSelection = nodeSelection
      .append("circle")
      .attr("r", (n) => nodeRadius(n))
      .attr("fill", (n) => nodeColor(n))
      .attr("stroke", (n) => (n.is_seed ? "#f472b6" : "rgba(255,255,255,0.55)"))
      .attr("stroke-width", (n) => (n.is_seed ? 2.5 : 1.5))
      .attr("filter", (n) => (n.is_seed ? "url(#seed-glow)" : "url(#star-glow)"))
      .attr("opacity", 0.88);

    // ── Labels: dark for readability on light bg ──────────────────────────
    const labelSelection = nodeSelection
      .append("text")
      .text((n) => trimTitle(n.title))
      .attr("text-anchor", "middle")
      .attr("dy", (n) => nodeRadius(n) + 14)
      .attr("fill", "#3b1f6e")
      .attr("font-size", 10.5)
      .attr("font-family", "IBM Plex Sans, Noto Sans SC, sans-serif")
      .attr("font-weight", 500)
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(255,255,255,0.97)")
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round")
      .attr("opacity", (n) => (n.is_seed || nodeRadius(n) >= 16 ? 0.9 : 0));

    // Native SVG title is skipped in favour of the custom HTML tooltip below

    function updateVisualState(hoveredId = null) {
      const focusId = hoveredId || selectedPaperId;
      const hasHover = Boolean(hoveredId);

      circleSelection
        .attr("opacity", (n) => {
          if (!hasHover) return 0.88;
          return isNeighbor(focusId, n.id) ? 1 : 0.13;
        })
        .attr("stroke", (n) => {
          if (n.id === selectedPaperId) return "#7c3aed";
          if (n.is_seed) return "#f472b6";
          return "rgba(255,255,255,0.55)";
        })
        .attr("stroke-width", (n) => {
          if (n.id === selectedPaperId || n.is_seed) return 2.5;
          return 1.5;
        });

      edgeSelection.attr("stroke-opacity", (e) => {
        if (!hasHover) return edgeOpacity(e);
        return e.source.id === focusId || e.target.id === focusId
          ? Math.min(edgeOpacity(e) + 0.2, 1)
          : 0.03;
      });

      labelSelection.attr("opacity", (n) => {
        if (n.id === selectedPaperId || n.id === seedPaperId || n.id === hoveredId) return 1;
        if (hasHover && isNeighbor(focusId, n.id) && nodeRadius(n) >= 13) return 0.88;
        return nodeRadius(n) >= 16 ? 0.68 : 0;
      });
    }

    const dragBehaviour = d3.drag()
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.25).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event) => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      });

    nodeSelection
      .on("mouseover", (event, n) => {
        updateVisualState(n.id);
        const tip = tooltipRef.current;
        if (!tip) return;
        tip.querySelector(".tip-title").textContent = n.title || "";
        tip.querySelector(".tip-year").textContent = n.year ? String(n.year) : "";
        tip.querySelector(".tip-cites").textContent = `${(n.citation_count || 0).toLocaleString()} ${t("rail.citationsSuffix")}`;
        tip.style.display = "block";
        tip.style.left = `${event.clientX + 14}px`;
        tip.style.top  = `${event.clientY - 52}px`;
      })
      .on("mousemove", (event) => {
        const tip = tooltipRef.current;
        if (tip) { tip.style.left = `${event.clientX + 14}px`; tip.style.top = `${event.clientY - 52}px`; }
      })
      .on("mouseout", () => {
        updateVisualState();
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
      })
      .on("click", (event, n) => { event.stopPropagation(); onSelectPaper(n.id, n); })
      .on("dblclick", (event, n) => {
        event.preventDefault(); event.stopPropagation();
        const url = resolvePaperUrl(n);
        if (url && typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      })
      .call(dragBehaviour);

    function renderFrame() {
      edgeSelection
        .attr("x1", (e) => e.source.x).attr("y1", (e) => e.source.y)
        .attr("x2", (e) => e.target.x).attr("y2", (e) => e.target.y);
      nodeSelection.attr("transform", (n) => `translate(${n.x}, ${n.y})`);
    }

    const warmupTicks = Math.min(160, 36 + nodes.length * 2);
    simulation.stop();
    for (let i = 0; i < warmupTicks; i++) simulation.tick();
    renderFrame();

    const bounds = nodes.reduce(
      (acc, n) => ({
        minX: Math.min(acc.minX, (n.x ?? width / 2) - nodeRadius(n)),
        maxX: Math.max(acc.maxX, (n.x ?? width / 2) + nodeRadius(n)),
        minY: Math.min(acc.minY, (n.y ?? height / 2) - nodeRadius(n)),
        maxY: Math.max(acc.maxY, (n.y ?? height / 2) + nodeRadius(n))
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    if (Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY)) {
      const paddingX = 64, paddingTop = 40, paddingBottom = 68;
      const graphWidth  = Math.max(bounds.maxX - bounds.minX, 1);
      const graphHeight = Math.max(bounds.maxY - bounds.minY, 1);
      const scale = Math.max(0.72, Math.min(1.12,
        Math.min((width - paddingX * 2) / graphWidth, (height - paddingTop - paddingBottom) / graphHeight)
      ));
      // Centre viewport on the seed node, not the bounding-box centre,
      // so the seed is always in the middle of the screen.
      const focusX = seedNode ? seedNode.x : (bounds.minX + bounds.maxX) / 2;
      const focusY = seedNode ? seedNode.y : (bounds.minY + bounds.maxY) / 2;
      const targetCenterY = paddingTop + (height - paddingTop - paddingBottom) / 2;
      svg.call(zoom.transform,
        d3.zoomIdentity.translate(width / 2 - focusX * scale, targetCenterY - focusY * scale).scale(scale)
      );
    }

    simulation.on("tick", renderFrame);
    updateVisualState();

    return () => { simulation.stop(); svg.on(".zoom", null); };
  }, [data, dimensions.height, dimensions.width, maxYear, minYear, onClearSelection, onSelectPaper, seedPaperId, selectedPaperId, t]);

  const warningText = data?.mode === "topic_fallback" ? t("graph.topicFallbackWarning") : data?.warning;

  return (
    <div className="paper-surface flex h-full min-h-[520px] flex-col overflow-hidden rounded-[22px]">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-violet-100/80 bg-white/80 px-4 py-3 backdrop-blur-sm">
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
          {data.mode === "topic_fallback" ? t("graph.topicFallback") : t("graph.citationMap")}
        </span>
        <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs text-slate-400">
          {t("status.nodes", { count: data.nodes.length })}
        </span>
        <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs text-slate-400">
          {t("status.edges", { count: data.edges.length })}
        </span>
      </div>

      {/* ── Graph stage ── */}
      <div ref={frameRef} className="graph-stage relative min-h-0 flex-1 overflow-hidden">

        {/* Dreamy bright background */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(160deg, #f5f3ff 0%, #fdf4ff 55%, #fef9f0 100%)" }} />

        {/* Soft aurora washes */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: [
            "radial-gradient(ellipse 50% 40% at 12% 18%, rgba(167,139,250,0.14) 0%, transparent 60%)",
            "radial-gradient(ellipse 42% 32% at 88% 22%, rgba(244,114,182,0.1) 0%, transparent 55%)",
            "radial-gradient(ellipse 38% 48% at 55% 92%, rgba(99,102,241,0.08) 0%, transparent 50%)"
          ].join(", ")
        }} />

        <svg ref={svgRef} className="relative z-[1] h-full w-full" role="img" aria-label={t("graph.ariaLabel")} />

        {/* Hover tooltip – positioned via direct DOM in d3 handlers */}
        <div
          ref={tooltipRef}
          className="pointer-events-none fixed z-50 hidden max-w-[260px] rounded-xl border border-violet-100 bg-white/95 px-3 py-2 shadow-[0_8px_28px_rgba(109,40,217,0.13)] backdrop-blur-md"
        >
          <div className="tip-title text-[13px] font-medium leading-snug text-slate-800" />
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="tip-year font-semibold text-violet-500" />
            <span className="tip-cites" />
          </div>
        </div>

        {/* Warning */}
        {warningText && (
          <div className="pointer-events-none absolute bottom-20 left-4 z-10 max-w-xl rounded-[16px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs leading-6 text-amber-700 shadow-[0_8px_24px_rgba(251,191,36,0.15)] backdrop-blur-sm">
            {warningText}
          </div>
        )}

        {/* Year-palette legend */}
        {minYear && maxYear && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-[16px] border border-violet-100 bg-white/80 px-4 py-3 shadow-[0_8px_28px_rgba(109,40,217,0.1)] backdrop-blur-md">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{t("graph.yearPalette")}</div>
            <div className="mt-2 h-2.5 w-[200px] rounded-full"
              style={{ background: "linear-gradient(90deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)" }} />
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{minYear}</span>
              <span>{maxYear}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
