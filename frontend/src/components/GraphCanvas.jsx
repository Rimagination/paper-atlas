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
  return 0.08 + edge.weight * 0.36;
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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { minYear, maxYear } = resolveYearRange(data?.nodes);

  useEffect(() => {
    if (!frameRef.current) {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(entry.contentRect.width, 320);
      const height = Math.max(entry.contentRect.height, 520);
      setDimensions({ width, height });
    });

    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data || !dimensions.width || !dimensions.height) {
      return undefined;
    }

    const width = dimensions.width;
    const height = dimensions.height;
    const nodes = data.nodes.map((node) => ({ ...node }));
    const links = data.edges.map((edge) => ({ ...edge }));
    const nodeRadius = createNodeRadiusScale(nodes);
    const linkedById = new Set();
    const yearDomainMin = minYear ?? 2015;
    const yearDomainMax = maxYear ?? yearDomainMin + 8;
    const midYear = (yearDomainMin + yearDomainMax) / 2;

    // Aurora colour scale: deep ocean → violet → aurora pink
    const yearScale = d3
      .scaleLinear()
      .domain(
        yearDomainMin === yearDomainMax
          ? [yearDomainMin - 1, yearDomainMin, yearDomainMax + 1]
          : [yearDomainMin, midYear, yearDomainMax]
      )
      .range(["#1e3a6e", "#7c3aed", "#e879f9"]);

    links.forEach((edge) => {
      linkedById.add(`${edge.source}|${edge.target}`);
      linkedById.add(`${edge.target}|${edge.source}`);
    });

    const isNeighbor = (sourceId, targetId) => sourceId === targetId || linkedById.has(`${sourceId}|${targetId}`);
    const nodeColor = (node) => (node.year ? yearScale(node.year) : "#2a1f6e");
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height]).style("cursor", "grab");

    // ── SVG defs: glow filters ────────────────────────────────────────────
    const defs = svg.append("defs");

    // Subtle star-glow for regular nodes
    const starFilter = defs.append("filter")
      .attr("id", "star-glow")
      .attr("x", "-70%").attr("y", "-70%")
      .attr("width", "240%").attr("height", "240%");
    starFilter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "4")
      .attr("result", "blur");
    const starMerge = starFilter.append("feMerge");
    starMerge.append("feMergeNode").attr("in", "blur");
    starMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Stronger halo for seed node
    const seedFilter = defs.append("filter")
      .attr("id", "seed-glow")
      .attr("x", "-100%").attr("y", "-100%")
      .attr("width", "300%").attr("height", "300%");
    seedFilter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "9")
      .attr("result", "blur");
    const seedMerge = seedFilter.append("feMerge");
    seedMerge.append("feMergeNode").attr("in", "blur");
    seedMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // ── Viewport & zoom ───────────────────────────────────────────────────
    const viewport = svg.append("g");

    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 3.4])
      .on("zoom", (event) => {
        viewport.attr("transform", event.transform);
      });

    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("click", (event) => {
      if (event.target === svg.node()) {
        onClearSelection();
      }
    });

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((node) => node.id)
          .distance((edge) => Math.max(54, 120 - edge.weight * 66))
      )
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((node) => nodeRadius(node) + 8));

    const seedNode = nodes.find((node) => node.id === seedPaperId);
    if (seedNode) {
      seedNode.fx = width / 2;
      seedNode.fy = height / 2;
      seedNode.x = width / 2;
      seedNode.y = height / 2;
    }

    const edgeLayer = viewport.append("g").attr("stroke-linecap", "round");
    const nodeLayer = viewport.append("g");

    // ── Edges: soft violet glow lines ────────────────────────────────────
    const edgeSelection = edgeLayer
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "rgba(139,92,246,0.55)")
      .attr("stroke-width", (edge) => edgeWidth(edge))
      .attr("stroke-opacity", (edge) => edgeOpacity(edge));

    const nodeSelection = nodeLayer
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer");

    // ── Nodes: glowing stars ──────────────────────────────────────────────
    const circleSelection = nodeSelection
      .append("circle")
      .attr("r", (node) => nodeRadius(node))
      .attr("fill", (node) => nodeColor(node))
      .attr("stroke", (node) => (node.is_seed ? "#f0abfc" : "rgba(167,139,250,0.4)"))
      .attr("stroke-width", (node) => (node.is_seed ? 2.5 : 1.1))
      .attr("filter", (node) => (node.is_seed ? "url(#seed-glow)" : "url(#star-glow)"))
      .attr("opacity", 0.92);

    // ── Labels: light violet on dark bg ──────────────────────────────────
    const labelSelection = nodeSelection
      .append("text")
      .text((node) => trimTitle(node.title))
      .attr("text-anchor", "middle")
      .attr("dy", (node) => nodeRadius(node) + 14)
      .attr("fill", "#ddd6fe")
      .attr("font-size", 10.5)
      .attr("font-family", "IBM Plex Sans, Noto Sans SC, sans-serif")
      .attr("font-weight", 500)
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(7,8,24,0.94)")
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round")
      .attr("opacity", (node) => (node.is_seed || nodeRadius(node) >= 16 ? 0.9 : 0));

    nodeSelection.append("title").text((node) => `${node.title}\n${t("rail.citations", { count: node.citation_count || 0 })}`);

    function updateVisualState(hoveredId = null) {
      const focusId = hoveredId || selectedPaperId;
      const hasHover = Boolean(hoveredId);

      circleSelection
        .attr("opacity", (node) => {
          if (!hasHover) {
            return 0.92;
          }

          return isNeighbor(focusId, node.id) ? 1 : 0.1;
        })
        .attr("stroke", (node) => {
          if (node.id === selectedPaperId) {
            return "#67e8f9";      // cyan ring for selected
          }
          if (node.is_seed) {
            return "#f0abfc";      // aurora pink ring for seed
          }
          return "rgba(167,139,250,0.4)";
        })
        .attr("stroke-width", (node) => {
          if (node.id === selectedPaperId) {
            return 2.5;
          }
          if (node.is_seed) {
            return 2.5;
          }
          return 1.1;
        });

      edgeSelection.attr("stroke-opacity", (edge) => {
        if (!hasHover) {
          return edgeOpacity(edge);
        }

        return edge.source.id === focusId || edge.target.id === focusId
          ? Math.min(edgeOpacity(edge) + 0.22, 1)
          : 0.025;
      });

      labelSelection.attr("opacity", (node) => {
        if (node.id === selectedPaperId || node.id === seedPaperId || node.id === hoveredId) {
          return 1;
        }

        if (hasHover && isNeighbor(focusId, node.id) && nodeRadius(node) >= 13) {
          return 0.88;
        }

        return nodeRadius(node) >= 16 ? 0.72 : 0;
      });
    }

    const dragBehaviour = d3
      .drag()
      .on("start", (event) => {
        if (!event.active) {
          simulation.alphaTarget(0.25).restart();
        }
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event) => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on("end", (event) => {
        if (!event.active) {
          simulation.alphaTarget(0);
        }
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      });

    nodeSelection
      .on("mouseover", (_, node) => updateVisualState(node.id))
      .on("mouseout", () => updateVisualState())
      .on("click", (event, node) => {
        event.stopPropagation();
        onSelectPaper(node.id, node);
      })
      .on("dblclick", (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        const paperUrl = resolvePaperUrl(node);
        if (paperUrl && typeof window !== "undefined") {
          window.open(paperUrl, "_blank", "noopener,noreferrer");
        }
      })
      .call(dragBehaviour);

    function renderFrame() {
      edgeSelection
        .attr("x1", (edge) => edge.source.x)
        .attr("y1", (edge) => edge.source.y)
        .attr("x2", (edge) => edge.target.x)
        .attr("y2", (edge) => edge.target.y);

      nodeSelection.attr("transform", (node) => `translate(${node.x}, ${node.y})`);
    }

    const warmupTicks = Math.min(160, 36 + nodes.length * 2);
    simulation.stop();
    for (let index = 0; index < warmupTicks; index += 1) {
      simulation.tick();
    }
    renderFrame();

    const bounds = nodes.reduce(
      (accumulator, node) => ({
        minX: Math.min(accumulator.minX, (node.x ?? width / 2) - nodeRadius(node)),
        maxX: Math.max(accumulator.maxX, (node.x ?? width / 2) + nodeRadius(node)),
        minY: Math.min(accumulator.minY, (node.y ?? height / 2) - nodeRadius(node)),
        maxY: Math.max(accumulator.maxY, (node.y ?? height / 2) + nodeRadius(node))
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    );

    if (Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY)) {
      const paddingX = 64;
      const paddingTop = 40;
      const paddingBottom = 68;
      const graphWidth = Math.max(bounds.maxX - bounds.minX, 1);
      const graphHeight = Math.max(bounds.maxY - bounds.minY, 1);
      const scale = Math.max(
        0.72,
        Math.min(
          1.12,
          Math.min((width - paddingX * 2) / graphWidth, (height - paddingTop - paddingBottom) / graphHeight)
        )
      );
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const targetCenterY = paddingTop + (height - paddingTop - paddingBottom) / 2;

      svg.call(
        zoom.transform,
        d3.zoomIdentity
          .translate(width / 2 - centerX * scale, targetCenterY - centerY * scale)
          .scale(scale)
      );
    }

    simulation.on("tick", renderFrame);
    updateVisualState();

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [data, dimensions.height, dimensions.width, maxYear, minYear, onClearSelection, onSelectPaper, seedPaperId, selectedPaperId, t]);

  const warningText = data?.mode === "topic_fallback" ? t("graph.topicFallbackWarning") : data?.warning;

  return (
    <div className="paper-surface flex h-full min-h-[520px] flex-col overflow-hidden rounded-[22px]">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-3"
        style={{ background: "linear-gradient(90deg, rgba(15,12,40,0.85) 0%, rgba(20,14,50,0.88) 100%)" }}>
        <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300">
          {data.mode === "topic_fallback" ? t("graph.topicFallback") : t("graph.citationMap")}
        </span>
        <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs text-white/40">
          {t("status.nodes", { count: data.nodes.length })}
        </span>
        <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs text-white/40">
          {t("status.edges", { count: data.edges.length })}
        </span>
      </div>

      {/* ── Graph stage ── */}
      <div ref={frameRef} className="graph-stage relative min-h-0 flex-1 overflow-hidden">
        {/* Deep-space background */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, #07081a 0%, #0c0d22 100%)" }} />
        {/* Aurora nebula blobs */}
        <div className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 55% 35% at 18% 22%, rgba(120,60,220,0.2) 0%, transparent 60%)",
              "radial-gradient(ellipse 45% 28% at 82% 28%, rgba(236,72,153,0.13) 0%, transparent 55%)",
              "radial-gradient(ellipse 40% 50% at 50% 88%, rgba(56,189,248,0.08) 0%, transparent 50%)"
            ].join(", ")
          }} />

        <svg ref={svgRef} className="relative z-[1] h-full w-full" role="img" aria-label={t("graph.ariaLabel")} />

        {/* Warning badge */}
        {warningText ? (
          <div className="pointer-events-none absolute bottom-20 left-4 z-10 max-w-xl rounded-[16px] border border-amber-500/20 px-4 py-3 text-xs leading-6 text-amber-200/75 backdrop-blur-md"
            style={{ background: "rgba(30,15,5,0.7)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            {warningText}
          </div>
        ) : null}

        {/* Year-palette legend */}
        {minYear && maxYear ? (
          <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-[16px] border border-white/[0.09] px-4 py-3 backdrop-blur-md"
            style={{ background: "rgba(8,8,24,0.65)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/28">{t("graph.yearPalette")}</div>
            <div
              className="mt-2 h-2.5 w-[200px] rounded-full"
              style={{ background: "linear-gradient(90deg, #1e3a6e 0%, #7c3aed 50%, #e879f9 100%)" }}
            />
            <div className="mt-2 flex justify-between text-xs text-white/35">
              <span>{minYear}</span>
              <span>{maxYear}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
