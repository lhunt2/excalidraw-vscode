import * as vscode from "vscode";
import * as path from "path";
import { compressToBase64 } from "lz-string";
import { EMPTY_SCENE as EMPTY_SCENE_JSON } from "./markdown-adapter";

export function getActiveWorkspace() {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const doc = activeEditor.document;
    const ws = vscode.workspace.getWorkspaceFolder(doc.uri);
    return ws;
  }

  const wsf = vscode.workspace.workspaceFolders;
  if (wsf && wsf.length > 0) {
    const ws = wsf[0];
    return ws;
  }
  return undefined;
}

let runningCounter = 0;

export async function newExcalidrawMarkdownDocument() {
  runningCounter += 1;
  const ws = getActiveWorkspace();
  let fileName = `Untitled-${runningCounter}.excalidraw.md`;
  if (ws) { fileName = path.join(ws.uri.fsPath, fileName); }
  const compressedScene = compressToBase64(EMPTY_SCENE_JSON);
  const template = ["---", "", "excalidraw-plugin: parsed", "tags: [excalidraw]", "", "---", "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==", "", "", "# Excalidraw Data", "", "## Text Elements", "", "%%", "## Drawing", "```compressed-json", compressedScene, "```", "%%", ""].join("\n");
  const uri = vscode.Uri.file(fileName);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(template));
  await vscode.commands.executeCommand("vscode.openWith", uri, "editor.excalidraw");
}

export async function newUntitledExcalidrawDocument() {
  runningCounter += 1;
  const ws = getActiveWorkspace();
  let fileName = `Untitled-${runningCounter}.excalidraw`;
  if (ws) {
    fileName = path.join(ws.uri.fsPath, fileName);
  }
  const uri = vscode.Uri.parse(`untitled:${fileName}`);
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "editor.excalidraw"
  );
}
