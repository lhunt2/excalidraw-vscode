import { compressToBase64, decompressFromBase64 } from "lz-string";

export interface ParseResult {
  json: string;
  frontmatter: string;
  compressionFormat: "compressed-json" | "json";
  passthroughContent: string;
}

export const EMPTY_SCENE = JSON.stringify({
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
});

export class MarkdownExcalidrawAdapter {
  parse(content: string): ParseResult {
    const text = content.replace(/\r\n/g, "\n");
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = fmMatch ? fmMatch[1] : "";
    const afterFrontmatter = fmMatch ? text.slice(fmMatch[0].length) : text;
    const excalidrawDataIdx = afterFrontmatter.indexOf("# Excalidraw Data");
    const passthroughContent =
      excalidrawDataIdx >= 0
        ? afterFrontmatter.slice(0, excalidrawDataIdx)
        : afterFrontmatter;
    const codeBlockMatch = text.match(
      /```(compressed-json|json)\n([\s\S]*?)\n```/
    );
    if (!codeBlockMatch) {
      return {
        json: EMPTY_SCENE,
        frontmatter,
        compressionFormat: "compressed-json",
        passthroughContent,
      };
    }
    const compressionFormat = codeBlockMatch[1] as "compressed-json" | "json";
    // Obsidian's excalidraw plugin wraps long compressed lines — strip newlines before decompressing
    const rawData = codeBlockMatch[2].trim().replace(/\n/g, "");
    let json: string;
    if (compressionFormat === "compressed-json") {
      const decompressed = decompressFromBase64(rawData);
      if (!decompressed)
        throw new Error(
          "Failed to decompress .excalidraw.md Drawing data. The file may be corrupted."
        );
      json = decompressed;
    } else {
      json = rawData;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      if (compressionFormat === "compressed-json") {
        throw new Error(
          "Failed to decompress .excalidraw.md Drawing data. The file may be corrupted."
        );
      }
      throw new Error("Drawing data is not valid JSON");
    }
    if (!parsed.type && !parsed.elements)
      throw new Error(
        "Drawing data does not appear to be valid Excalidraw JSON"
      );
    return { json, frontmatter, compressionFormat, passthroughContent };
  }

  serialize(json: string, metadata: Omit<ParseResult, "json">): string {
    const scene = JSON.parse(json);
    const textElements = (scene.elements || [])
      .filter((el: any) => el.type === "text" && !el.isDeleted)
      .map((el: any) => `${el.originalText || el.text} ^${el.id}`)
      .join("\n\n");
    let drawingData: string;
    if (metadata.compressionFormat === "compressed-json") {
      drawingData = compressToBase64(json);
    } else {
      drawingData = json;
    }
    const parts = [
      `---\n${metadata.frontmatter}\n---`,
      metadata.passthroughContent,
      "# Excalidraw Data\n",
      "## Text Elements",
      textElements ? `${textElements}\n` : "",
      "%%",
      "## Drawing",
      `\`\`\`${metadata.compressionFormat}`,
      drawingData,
      "```",
      "%%\n",
    ];
    return parts.join("\n");
  }
}
