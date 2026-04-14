import * as vscode from "vscode";
import { buildGraph } from "./analyzer/graphBuilder";
import { GraphPanel } from "./webview/panel";
import { loadAliases } from "./analyzer/importResolver";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "tree-of-vue" is now active!');

  const disposable = vscode.commands.registerCommand(
    "tree-of-vue.showGraph",
    () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage("There are no open files.");
        return;
      }

      if (!editor.document.fileName.endsWith(".vue")) {
        vscode.window.showWarningMessage("Please run it in the .vue file.");
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      if (!workspaceRoot) {
        vscode.window.showWarningMessage("Please open the workspace.");
        return;
      }

      const entryFile = editor.document.fileName;

      try {
        const aliases = loadAliases(workspaceRoot);
        console.log("aliases:", JSON.stringify(aliases, null, 2));
        const graphData = buildGraph(entryFile, workspaceRoot);
        console.log(
          "nodes:",
          graphData.nodes.map((n) => n.label),
        );
        console.log("edges:", graphData.edges.length);
        const panel = GraphPanel.createOrShow(context.extensionUri);
        panel.update(graphData);
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to create graph: ${e}`);
      }
    },
  );
  context.subscriptions.push(disposable);
}

export function deactivate() {}
