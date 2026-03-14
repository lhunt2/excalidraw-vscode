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
