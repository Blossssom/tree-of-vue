import * as path from "path";
import * as fs from "fs";

const VUE_EXTENSIONS = [".vue", ".ts", ".js"];

// format alias '@'
interface AliasMap {
  [alias: string]: string;
}

export function loadAliases(workspaceRoot: string): AliasMap {
  const aliases: AliasMap = {};

  // tsconfig.json, tsconfig.app.json
  const tsconfigCandidates = ["tsconfig.app.json", "tsconfig.json"].map((f) =>
    path.join(workspaceRoot, f),
  );

  for (const tsconfigPath of tsconfigCandidates) {
    if (!fs.existsSync(tsconfigPath)) {
      continue;
    }

    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
      const paths: Record<string, string[]> =
        tsconfig.compilerOptions?.paths ?? {};

      const baseUrl: string = tsconfig.compilerOptions?.baseUrl ?? ".";
      const base = path.resolve(workspaceRoot, baseUrl);

      if (Object.keys(paths).length === 0) {
        continue;
      }

      let found = false;

      for (const [alias, targets] of Object.entries(paths)) {
        if (!targets[0]) {
          continue;
        }

        const cleanTarget = targets[0].replace(/\/\*$/, "");

        if (!cleanTarget || cleanTarget === "*") {
          continue;
        }

        const cleanAlias = alias.replace(/\/\*$/, "");
        aliases[cleanAlias] = path.resolve(base, cleanTarget);
        found = true;
      }

      if (found) {
        break;
      }
    } catch {}
  }

  // vite.config.ts alias parsing
  if (Object.keys(aliases).length === 0) {
    const viteConfigCandidates = ["vite.config.ts", "vite.config.js"].map((f) =>
      path.join(workspaceRoot, f),
    );

    for (const configPath of viteConfigCandidates) {
      if (!fs.existsSync(configPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(configPath, "utf-8");
        const aliasBlockMatch = content.match(/alias\s*:\s*\{([^}]+)\}/s);
        if (!aliasBlockMatch) {
          continue;
        }

        const block = aliasBlockMatch[1];

        // path.resolve(__dirname, './src') format
        const resolveRe =
          /['"]?(@[\w/]*|\w+)['"]?\s*:\s*path\.resolve\([^,)]+,\s*['"]([^'"]+)['"]\)/g;
        let m;
        while ((m = resolveRe.exec(block)) !== null) {
          aliases[m[1]] = path.resolve(workspaceRoot, m[2]);
        }

        // fileURLToPath(new URL('./src', import.meta.url)) format
        const urlRe =
          /['"]?(@[\w/]*|\w+)['"]?\s*:.*?new URL\(['"]([^'"]+)['"]/g;
        while ((m = urlRe.exec(block)) !== null) {
          if (!aliases[m[1]]) {
            aliases[m[1]] = path.resolve(workspaceRoot, m[2]);
          }
        }
      } catch {}
      break;
    }
  }

  return aliases;
}

export function resolveImport(
  importPath: string,
  fromFile: string,
  aliases: AliasMap = {},
): string | null {
  let targetPath = importPath;

  for (const [alias, aliasTarget] of Object.entries(aliases)) {
    if (importPath === alias || importPath.startsWith(alias + "/")) {
      targetPath = aliasTarget + importPath.slice(alias.length);
      break;
    }
  }

  const resolved = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(path.dirname(fromFile), targetPath);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }

  for (const ext of VUE_EXTENSIONS) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const ext of VUE_EXTENSIONS) {
    const candidate = path.join(resolved, "index" + ext);
    console.log("trying index:", candidate, fs.existsSync(candidate));

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
