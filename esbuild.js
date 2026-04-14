const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`,
        );
      });
      console.log("[watch] build finished");
    });
  },
};

const copyWebviewAssetsPlugin = {
  name: "copy-webview-assets",
  setup(build) {
    build.onEnd(() => {
      const srcDir = path.join(__dirname, "src", "webview");
      const distDir = path.join(__dirname, "dist", "webview");

      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }

      fs.readdirSync(srcDir)
        .filter((f) => f.endsWith(".html") || f.endsWith(".css"))
        .forEach((f) => {
          fs.copyFileSync(path.join(srcDir, f), path.join(distDir, f));
          console.log(`[webview] copied ${f}`);
        });
    });
  },
};

async function main() {
  const extensionCtx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode", "@vue/compiler-sfc"],
    logLevel: "info",
    plugins: [esbuildProblemMatcherPlugin, copyWebviewAssetsPlugin],
  });

  const webviewCtx = await esbuild.context({
    entryPoints: ["src/webview/graphView.ts"],
    bundle: true,
    format: "iife",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "browser",
    outfile: "dist/webview/graphView.js",
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
    await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
