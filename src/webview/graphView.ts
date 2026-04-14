import * as d3 from "d3";
import dagre from "dagre";
import type { GraphData, ComponentNode } from "../types";

declare const __GRAPH_DATA__: GraphData;

const graphData: GraphData = __GRAPH_DATA__;

if (!graphData.nodes.length) {
  const el = document.getElementById("empty");
  if (el) {
    el.style.display = "block";
  }
} else {
  renderGraph(graphData);
}

function renderGraph({ nodes, edges }: GraphData) {
  const NODE_W = 140;
  const NODE_H = 52;
  const RANK_SEP = 80;
  const NODE_SEP = 40;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40,
  });

  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_W, height: NODE_H, ...node });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  type LayoutNode = ComponentNode & { x: number; y: number };

  const layoutNodes: LayoutNode[] = nodes.map((node) => {
    const n = g.node(node.id);
    return { ...node, x: n.x, y: n.y };
  });

  const layoutEdges = edges
    .map((edge) => ({
      source: layoutNodes.find((n) => n.id === edge.source)!,
      target: layoutNodes.find((n) => n.id === edge.target)!,
    }))
    .filter((e) => e.source && e.target);

  const svg = d3.select<SVGSVGElement, unknown>("#graph");
  const width = window.innerWidth;
  const height = window.innerHeight;

  svg.attr("viewBox", [0, 0, width, height].join(" "));

  const container = svg.append("g");

  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => container.attr("transform", event.transform)),
  );

  svg
    .append("defs")
    .append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0, -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("class", "link-arrow")
    .attr("d", "M0,-5L10,0L0,5");

  const linkGroup = container.append("g");
  linkGroup
    .selectAll<SVGPathElement, (typeof layoutEdges)[0]>("path")
    .data(layoutEdges)
    .join("path")
    .attr("class", "link")
    .attr("marker-end", "url(#arrow)")
    .attr("d", (d) => {
      const sx = d.source.x;
      const sy = d.source.y + NODE_H / 2;
      const tx = d.target.x;
      const ty = d.target.y - NODE_H / 2;
      const my = (sy + ty) / 2;
      return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
    });

  const nodeGroup = container.append("g");
  const node = nodeGroup
    .selectAll<SVGGElement, LayoutNode>("g")
    .data(layoutNodes)
    .join("g")
    .attr("class", "node-group")
    .attr(
      "transform",
      (d) => `translate(${d.x - NODE_W / 2}, ${d.y - NODE_H / 2})`,
    )
    .style("cursor", "grab")
    .call(
      d3
        .drag<SVGGElement, LayoutNode>()
        .on("start", function () {
          d3.select(this).style("cursor", "grabbing");
        })
        .on("drag", function (event, d) {
          d.x += event.dx;
          d.y += event.dy;
          d3.select(this).attr(
            "transform",
            `translate(${d.x - NODE_W / 2}, ${d.y - NODE_H / 2})`,
          );

          // 연결된 엣지 업데이트
          linkGroup
            .selectAll<SVGPathElement, (typeof layoutEdges)[0]>("path")
            .filter((e) => e.source.id === d.id || e.target.id === d.id)
            .attr("d", (e) => {
              const sx = e.source.x;
              const sy = e.source.y + NODE_H / 2;
              const tx = e.target.x;
              const ty = e.target.y - NODE_H / 2;
              const my = (sy + ty) / 2;
              return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
            });
        })
        .on("end", function () {
          d3.select(this).style("cursor", "grab");
        }),
    );

  node
    .append("rect")
    .attr("class", (_, i) => "node-rect" + (i === 0 ? " entry" : ""))
    .attr("width", NODE_W)
    .attr("height", NODE_H)
    .attr("rx", 8);

  node
    .append("text")
    .attr("class", "node-label")
    .attr("x", NODE_W / 2)
    .attr("y", NODE_H / 2 - 6)
    .text((d) => d.label);

  node
    .append("text")
    .attr("class", "node-meta")
    .attr("x", NODE_W / 2)
    .attr("y", NODE_H / 2 + 10)
    .text((d) => {
      const parts: string[] = [];
      if (d.props.length) {
        parts.push(`props:${d.props.length}`);
      }
      if (d.emits.length) {
        parts.push(`emits:${d.props.length}`);
      }
      return parts.join("  ");
    });

  const tooltip = d3.select<HTMLDivElement, unknown>("#tooltip");

  node
    .on("mouseover", (_event, d) => {
      let html = `<div class="tooltip-title">${d.label}</div>`;

      if (d.props.length) {
        html += `<div class="tooltip-section">Props</div>`;
        d.props.forEach((p) => {
          const cls = p.required ? "prop-required" : "prop-optional";
          html += `<div class="tooltip-item"><span class="${cls}">${p.name}</span>: ${p.type}${p.required ? "" : "?"}</div>`;
        });
      }

      if (d.emits.length) {
        html += `<div class="tooltip-section">Emits</div>`;
        d.emits.forEach((e) => {
          html += `<div class="tooltip-item emit-item">@${e}</div>`;
        });
      }

      if (!d.props.length && !d.emits.length) {
        html += `<div class="tooltip-item" style="color:#6c7086">No interface</div>`;
      }

      tooltip.html(html).style("opacity", "1");
    })
    .on("mousemove", (event: MouseEvent) => {
      tooltip
        .style("left", `${event.clientX + 14}px`)
        .style("top", `${event.clientY - 10}px`);
    })
    .on("mouseout", () => tooltip.style("opacity", "0"));

  const graphWidth = (g.graph().width ?? 0) + 80;
  const graphHeight = (g.graph().height ?? 0) + 80;
  const scale = Math.min(width / graphWidth, height / graphHeight, 1);
  const tx = (width - graphWidth * scale) / 2;
  const ty = (height - graphHeight * scale) / 2;

  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => container.attr("transform", event.transform))
      .transform as any,
    d3.zoomIdentity.translate(tx, ty).scale(scale),
  );

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    svg.attr("viewBox", [0, 0, w, h].join(" "));
  });
}
