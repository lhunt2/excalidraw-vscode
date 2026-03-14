import * as vscode from "vscode";
import * as path from "path";
import { MarkdownExcalidrawAdapter } from "./markdown-adapter";

const adapter = new MarkdownExcalidrawAdapter();

/**
 * Parse an .excalidraw.md string and return the bare Excalidraw JSON string.
 * Handles both compressed-json and json formats.
 * Throws on corrupted or invalid data, or if no Drawing section is found.
 */
export function convertMarkdownToExcalidrawJson(markdownContent: string): string {
  if (!markdownContent.includes("## Drawing")) {
    throw new Error("No Drawing section found in the .excalidraw.md file.");
  }
  const result = adapter.parse(markdownContent);
  return result.json;
}

/**
 * Convert an .excalidraw.md filename to .excalidraw by stripping the trailing .md.
 * If the filename doesn't end in .excalidraw.md, returns it unchanged.
 */
export function excalidrawMdToExcalidrawFilename(filename: string): string {
  if (filename.endsWith(".excalidraw.md")) {
    return filename.slice(0, -3); // strip ".md"
  }
  return filename;
}

/**
 * Shared conversion logic: read .excalidraw.md, write .excalidraw, auto-open.
 */
async function convertAndOpen(
  sourceUri: vscode.Uri,
  destinationDir: vscode.Uri,
  deleteSource: boolean
): Promise<void> {
  const sourceFilename = path.basename(sourceUri.fsPath);
  const targetFilename = excalidrawMdToExcalidrawFilename(sourceFilename);
  const targetUri = vscode.Uri.joinPath(destinationDir, targetFilename);

  // Overwrite protection
  try {
    await vscode.workspace.fs.stat(targetUri);
    const answer = await vscode.window.showWarningMessage(
      `${targetFilename} already exists. Overwrite?`,
      "Overwrite",
      "Cancel"
    );
    if (answer !== "Overwrite") {
      return;
    }
  } catch {
    // File doesn't exist — good
  }

  const rawBytes = await vscode.workspace.fs.readFile(sourceUri);
  const markdownContent = new TextDecoder().decode(rawBytes);
  const json = convertMarkdownToExcalidrawJson(markdownContent);

  await vscode.workspace.fs.writeFile(
    targetUri,
    new TextEncoder().encode(json)
  );

  if (deleteSource) {
    await vscode.workspace.fs.delete(sourceUri);
  }

  await vscode.commands.executeCommand(
    "vscode.openWith",
    targetUri,
    "editor.excalidraw"
  );
}

/**
 * Command: Import from Obsidian.
 * Opens a file dialog, copies + converts, auto-opens.
 */
export async function importFromObsidian(): Promise<void> {
  const files = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { "Excalidraw Markdown": ["excalidraw.md"] },
    title: "Import Excalidraw Markdown",
  });
  if (!files || files.length === 0) {
    return;
  }

  const sourceUri = files[0];
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      "No workspace folder open. Open a folder first."
    );
    return;
  }
  const destinationDir = workspaceFolders[0].uri;

  try {
    await convertAndOpen(sourceUri, destinationDir, false);
  } catch (e) {
    vscode.window.showErrorMessage(
      `Failed to import: ${e instanceof Error ? e.message : e}`
    );
  }
}

/**
 * Command: Convert .excalidraw.md to .excalidraw in place.
 * Called from explorer context menu (uri argument) or command palette (active editor).
 */
export async function convertInPlace(uri?: vscode.Uri): Promise<void> {
  if (!uri) {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.fsPath.endsWith(".excalidraw.md")) {
      uri = activeEditor.document.uri;
    }
  }

  if (!uri || !uri.fsPath.endsWith(".excalidraw.md")) {
    vscode.window.showErrorMessage(
      "No .excalidraw.md file selected."
    );
    return;
  }

  const destinationDir = vscode.Uri.file(path.dirname(uri.fsPath));

  try {
    await convertAndOpen(uri, destinationDir, true);
  } catch (e) {
    vscode.window.showErrorMessage(
      `Failed to convert: ${e instanceof Error ? e.message : e}`
    );
  }
}
