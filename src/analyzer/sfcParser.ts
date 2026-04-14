import * as fs from "fs";
import * as path from "path";
import { parse } from "@vue/compiler-sfc";
import type { ComponentNode } from "../types";

export function parseSFC(
  filePath: string,
  workspaceRoot?: string,
): Omit<ComponentNode, "id" | "label" | "filePath"> & { imports: string[] } {
  const source = fs.readFileSync(filePath, "utf-8");

  if (!filePath.endsWith(".vue")) {
    return {
      props: [],
      emits: [],
      imports: parseImports(source, workspaceRoot),
    };
  }

  const { descriptor } = parse(source);

  console.log(
    "scriptSetup content length:",
    descriptor.scriptSetup?.content?.length,
  );
  console.log("script content length:", descriptor.script?.content?.length);

  const scriptContent =
    descriptor.scriptSetup?.content ?? descriptor.script?.content ?? "";

  console.log("scriptContent preview:", scriptContent.slice(0, 200));

  return {
    props: parseProps(scriptContent),
    emits: parseEmits(scriptContent),
    imports: parseImports(scriptContent, workspaceRoot),
  };
}

function parseProps(script: string) {
  const props: { name: string; type: string; required: boolean }[] = [];

  // defineProps<{ foo: string; bar?: number }>() format
  const genericMatch = script.match(/defineProps<\{([^}]+)\}>/s);

  if (genericMatch) {
    const inner = genericMatch[1];
    const lines = inner
      .split("\n")
      .map((li) => li.trim())
      .filter(Boolean);

    for (const line of lines) {
      const lineMatcher = line.match(/^(\w+)(\?)?:\s*(.+?);?$/);
      if (lineMatcher) {
        props.push({
          name: lineMatcher[1],
          type: lineMatcher[3].trim(),
          required: !lineMatcher[2],
        });
      }
    }
    return props;
  }

  // defineProps({ foo: { type: String, required: true } }) format
  const objectMatch = script.match(/defineProps\(\{([^}]+)\}\)/s);

  if (objectMatch) {
    const inner = objectMatch[1];
    const propNames = [...inner.matchAll(/(\w+)\s*:/g)].map((m) => m[1]);

    for (const name of propNames) {
      const isRequired = new RegExp(`${name}[^}]+required:\\s*true`).test(
        inner,
      );
      const typeMatch = inner.match(new RegExp(`${name}[^}]+type:\\s*(\\w+)`));
      props.push({
        name,
        type: typeMatch?.[1] ?? "unknown",
        required: isRequired,
      });
    }
  }
  return props;
}

function parseEmits(script: string): string[] {
  // defineEmits<{ (e: 'click'): void; (e: 'update'): void }>() format
  const genericMatch = script.match(/defineEmits<\{([^}]+)\}>/s);

  if (genericMatch) {
    return [...genericMatch[1].matchAll(/e:\s*'(\w+)'/g)].map((m) => m[1]);
  }

  // defineEmits(['click', 'update']) format
  const arrayMatch = script.match(/defineEmits\(\[([^\]]+)\]\)/);

  if (arrayMatch) {
    return [...arrayMatch[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
  }

  return [];
}

function parseImports(script: string, workspaceRoot?: string): string[] {
  const imports: string[] = [];
  const re = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(script)) !== null) {
    const p = m[1];
    if (p.startsWith(".")) {
      imports.push(p);
      continue;
    }
    if (workspaceRoot) {
      const nodeModulePath = path.join(
        workspaceRoot,
        "node_modules",
        p.split("/")[0],
      );
      if (!fs.existsSync(nodeModulePath)) {
        imports.push(p);
      }
    }
  }
  return imports;
}
