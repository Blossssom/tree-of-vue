import * as path from "path";
import { parseSFC } from "./sfcParser";
import { loadAliases, resolveImport } from "./importResolver";
import type { GraphData, ComponentNode, ComponentEdge } from "../types";

export function buildGraph(
  entryFile: string,
  workspaceRoot: string,
): GraphData {
  const aliases = loadAliases(workspaceRoot);
  const nodes = new Map<string, ComponentNode>();
  const edges: ComponentEdge[] = [];
  const visited = new Set<string>();

  function walk(filePath: string, parentVue?: string) {
    if (visited.has(filePath)) {
      if (parentVue && filePath.endsWith(".vue")) {
        edges.push({ source: parentVue, target: filePath });
      }
      return;
    }
    visited.add(filePath);
    console.log("walking:", path.basename(filePath));

    // only parse .vue
    if (
      !filePath.endsWith(".vue") &&
      !filePath.endsWith(".ts") &&
      !filePath.endsWith(".js")
    ) {
      return;
    }

    let parsed;

    try {
      parsed = parseSFC(filePath, workspaceRoot);
      console.log(
        "parsed imports from",
        path.basename(filePath),
        ":",
        parsed.imports,
      );
    } catch (e) {
      console.log("parseSFC error:", filePath, e);
      return;
    }

    if (filePath.endsWith(".vue")) {
      const node: ComponentNode = {
        id: filePath,
        label: path.basename(filePath, ".vue"),
        filePath,
        props: parsed.props,
        emits: parsed.emits,
      };
      nodes.set(filePath, node);

      if (parentVue) {
        edges.push({ source: parentVue, target: filePath });
      }

      for (const importPath of parsed.imports) {
        const resolved = resolveImport(importPath, filePath, aliases);
        if (!resolved) {
          continue;
        }
        walk(resolved, filePath);
      }
    } else {
      for (const importPath of parsed.imports) {
        const resolved = resolveImport(importPath, filePath, aliases);
        if (!resolved) {
          continue;
        }
        walk(resolved, parentVue);
      }
    }
  }

  walk(entryFile);

  return { nodes: [...nodes.values()], edges };
}
