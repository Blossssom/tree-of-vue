import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { GraphData } from "../types";

export class GraphPanel {
  public static currentPanel: GraphPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (GraphPanel.currentPanel) {
      GraphPanel.currentPanel._panel.reveal(column);
      return GraphPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "treeOfVue",
      "Tree of Vue",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    GraphPanel.currentPanel = new GraphPanel(panel, extensionUri);
    return GraphPanel.currentPanel;
  }

  public update(graphData: GraphData) {
    this._panel.webview.html = this._getHtml(graphData);
  }

  public dispose() {
    GraphPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _getHtml(graphData: GraphData): string {
    const htmlPath = path.join(
      this._extensionUri.fsPath,
      "src",
      "webview",
      "graphView.html",
    );

    const cssUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "dist",
        "webview",
        "graphView.css",
      ),
    );

    const scriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "dist",
        "webview",
        "graphView.js",
      ),
    );

    const template = fs.readFileSync(htmlPath, "utf-8");

    return template
      .replace("__CSS_URI__", cssUri.toString())
      .replace("__SCRIPT_URI__", scriptUri.toString())
      .replace("__GRAPH_DATA_PLACEHOLDER__", JSON.stringify(graphData));
  }
}
