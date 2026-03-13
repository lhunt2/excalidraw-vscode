import * as vscode from "vscode";
import * as path from "path";
import { MarkdownExcalidrawAdapter, type ParseResult } from "./markdown-adapter";

export class ExcalidrawDocument implements vscode.CustomDocument {
  uri: vscode.Uri;
  content: Uint8Array;

  private _onDidContentChange = new vscode.EventEmitter<void>();
  public onDidContentChange = this._onDidContentChange.event;

  public readonly contentType;
  public markdownMetadata?: Omit<ParseResult, "json">;
  private static adapter = new MarkdownExcalidrawAdapter();

  getContentType(): string {
    const fsPath = this.uri.fsPath;
    if (fsPath.endsWith(".excalidraw.md")) {
      return "text/x-excalidraw-markdown";
    }
    switch (path.parse(this.uri.fsPath).ext) {
      case ".svg":
        return "image/svg+xml";
      case ".png":
        return "image/png";
      default:
        return "application/json";
    }
  }

  constructor(uri: vscode.Uri, content: Uint8Array) {
    this.uri = uri;
    this.contentType = this.getContentType();
    if (this.contentType === "text/x-excalidraw-markdown") {
      const text = new TextDecoder().decode(content);
      const result = ExcalidrawDocument.adapter.parse(text);
      this.markdownMetadata = { frontmatter: result.frontmatter, compressionFormat: result.compressionFormat, passthroughContent: result.passthroughContent };
      this.content = new TextEncoder().encode(result.json);
    } else {
      this.content = content;
    }
  }

  async revert() {
    const content = await vscode.workspace.fs.readFile(this.uri);
    if (this.contentType === "text/x-excalidraw-markdown") {
      const text = new TextDecoder().decode(content);
      const result = ExcalidrawDocument.adapter.parse(text);
      this.markdownMetadata = { frontmatter: result.frontmatter, compressionFormat: result.compressionFormat, passthroughContent: result.passthroughContent };
      this.content = new TextEncoder().encode(result.json);
    } else {
      this.content = content;
    }
  }

  async backup(destination: vscode.Uri): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(destination);
    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch (e) {}
      },
    };
  }

  async save() {
    return this.saveAs(this.uri);
  }

  async update(content: Uint8Array) {
    this.content = content;
    this._onDidContentChange.fire();
  }

  async saveAs(destination: vscode.Uri) {
    let output: Uint8Array;
    if (this.contentType === "text/x-excalidraw-markdown" && this.markdownMetadata) {
      const json = new TextDecoder().decode(this.content);
      const markdown = ExcalidrawDocument.adapter.serialize(json, this.markdownMetadata);
      output = new TextEncoder().encode(markdown);
    } else {
      output = this.content;
    }
    return vscode.workspace.fs.writeFile(destination, output);
  }

  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  /**
   * Fired when the document is disposed of.
   */
  public readonly onDidDispose = this._onDidDispose.event;

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidContentChange.dispose();
  }
}
