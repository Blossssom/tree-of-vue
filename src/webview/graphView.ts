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
  const EXPANDED_ITEM_H = 18;
  const EXPANDED_PADDING = 24;

  const expandedSet = new Set<string>();

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

  const zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on("zoom", (event) => container.attr("transform", event.transform));

  svg.call(zoomBehavior);

  const container = svg.append("g");

  svg
    .append("defs")
    .append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("class", "link-arrow")
    .attr("d", "M0,-5L10,0L0,5");

  const linkGroup = container.append("g");
  const nodeGroup = container.append("g");
  const tooltip = d3.select<HTMLDivElement, unknown>("#tooltip");

  function edgePath(source: LayoutNode, target: LayoutNode): string {
    const sx = source.x;
    const sy = source.y + NODE_H / 2;
    const tx = target.x;
    const ty = target.y - NODE_H / 2;
    const my = (sy + ty) / 2;
    return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
  }

  function getExpandedHeight(d: LayoutNode): number {
    if (!expandedSet.has(d.id)) {
      return NODE_H;
    }
    const itemCount =
      (d.props.length ? d.props.length + 1 : 0) +
      (d.emits.length ? d.emits.length + 1 : 0) +
      (!d.props.length && !d.emits.length ? 1 : 0);
    return NODE_H + EXPANDED_PADDING + itemCount * EXPANDED_ITEM_H;
  }

  function renderEdges() {
    linkGroup
      .selectAll<SVGPathElement, (typeof layoutEdges)[0]>("path")
      .data(layoutEdges)
      .join("path")
      .attr("class", "link")
      .attr("marker-end", "url(#arrow)")
      .attr("d", (d) => edgePath(d.source, d.target));
  }

  function renderNodes() {
    const node = nodeGroup
      .selectAll<SVGGElement, LayoutNode>("g.node-group")
      .data(layoutNodes, (d) => d.id)
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
            linkGroup
              .selectAll<SVGPathElement, (typeof layoutEdges)[0]>("path")
              .filter((e) => e.source.id === d.id || e.target.id === d.id)
              .attr("d", (e) => edgePath(e.source, e.target));
          })
          .on("end", function () {
            d3.select(this).style("cursor", "grab");
          }),
      );

    node
      .selectAll<SVGRectElement, LayoutNode>("rect.node-rect")
      .data((d) => [d])
      .join("rect")
      .attr("class", (d) => {
        const isEntry = layoutNodes.indexOf(d) === 0;
        return "node-rect" + (isEntry ? " entry" : "");
      })
      .attr("width", NODE_W)
      .attr("height", (d) => getExpandedHeight(d))
      .attr("rx", 8)
      .on("click", (_event, d) => {
        if (expandedSet.has(d.id)) {
          expandedSet.delete(d.id);
        } else {
          expandedSet.add(d.id);
        }
        renderNodes();
      });

    node
      .selectAll<SVGTextElement, LayoutNode>("text.node-label")
      .data((d) => [d])
      .join("text")
      .attr("class", "node-label")
      .attr("x", NODE_W / 2)
      .attr("y", NODE_H / 2 - 6)
      .text((d) => d.label);

    node
      .selectAll<SVGTextElement, LayoutNode>("text.node-meta")
      .data((d) => [d])
      .join("text")
      .attr("class", "node-meta")
      .attr("x", NODE_W / 2)
      .attr("y", NODE_H / 2 + 10)
      .text((d) => {
        const parts: string[] = [];
        if (d.props.length) {
          parts.push(`props:${d.props.length}`);
        }
        if (d.emits.length) {
          parts.push(`emits:${d.emits.length}`);
        }
        return parts.join("  ");
      });

    node
      .selectAll<SVGGElement, LayoutNode>("g.expanded-content")
      .data((d) => (expandedSet.has(d.id) ? [d] : []))
      .join("g")
      .attr("class", "expanded-content")
      .each(function (d) {
        const g = d3.select(this);
        g.selectAll("*").remove();

        let y = NODE_H + 8;

        const renderSection = (
          title: string,
          items: { text: string; cls: string }[],
        ) => {
          g.append("text")
            .attr("x", 12)
            .attr("y", y)
            .attr("class", "node-section-title")
            .text(title);
          y += EXPANDED_ITEM_H;

          items.forEach((item) => {
            g.append("text")
              .attr("x", 18)
              .attr("y", y)
              .attr("class", `node-item ${item.cls}`)
              .text(item.text);
            y += EXPANDED_ITEM_H;
          });
        };

        if (d.props.length) {
          renderSection(
            "Props",
            d.props.map((p) => ({
              text: `${p.name}${p.required ? "" : "?"}: ${p.type}`,
              cls: p.required ? "prop-required" : "prop-optional",
            })),
          );
        }

        if (d.emits.length) {
          renderSection(
            "Emits",
            d.emits.map((e) => ({
              text: `@${e}`,
              cls: "emit-item",
            })),
          );
        }

        if (!d.props.length && !d.emits.length) {
          g.append("text")
            .attr("x", 12)
            .attr("y", y)
            .attr("class", "node-item")
            .style("fill", "#6c7086")
            .text("인터페이스 없음");
        }
      });

    node
      .on("mouseover", (_event, d) => {
        if (expandedSet.has(d.id)) {
          return;
        }
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
          html += `<div class="tooltip-item" style="color:#6c7086">인터페이스 없음</div>`;
        }
        tooltip.html(html).style("opacity", "1");
      })
      .on("mousemove", (event: MouseEvent) => {
        if (
          expandedSet.has(
            (
              d3
                .select(event.currentTarget as SVGGElement)
                .datum() as LayoutNode
            ).id,
          )
        ) {
          return;
        }

        tooltip
          .style("left", `${event.clientX + 14}px`)
          .style("top", `${event.clientY - 10}px`);
      })
      .on("mouseout", () => tooltip.style("opacity", "0"));
  }

  renderEdges();
  renderNodes();

  const graphWidth = (g.graph().width ?? 0) + 80;
  const graphHeight = (g.graph().height ?? 0) + 80;
  const scale = Math.min(width / graphWidth, height / graphHeight, 1);
  const tx = (width - graphWidth * scale) / 2;
  const ty = (height - graphHeight * scale) / 2;

  svg.call(
    zoomBehavior.transform as any,
    d3.zoomIdentity.translate(tx, ty).scale(scale),
  );

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    svg.attr("viewBox", [0, 0, w, h].join(" "));
  });
}
