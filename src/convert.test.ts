import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { convertMarkdownToExcalidrawJson, excalidrawMdToExcalidrawFilename } from "./convert";

const fixturesDir = join(__dirname, "fixtures");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("convertMarkdownToExcalidrawJson()", () => {
  it("extracts valid Excalidraw JSON from compressed .excalidraw.md", () => {
    const md = readFixture("sample-compressed.excalidraw.md");
    const json = convertMarkdownToExcalidrawJson(md);
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe("excalidraw");
    expect(Array.isArray(parsed.elements)).toBe(true);
  });

  it("extracts valid Excalidraw JSON from uncompressed .excalidraw.md", () => {
    const md = readFixture("sample-uncompressed.excalidraw.md");
    const json = convertMarkdownToExcalidrawJson(md);
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe("excalidraw");
    expect(parsed.elements).toHaveLength(1);
  });

  it("throws on corrupted data", () => {
    const content = `---\nexcalidraw-plugin: parsed\n---\n\n# Excalidraw Data\n\n%%\n## Drawing\n\`\`\`compressed-json\nCORRUPTED!!!\n\`\`\`\n%%\n`;
    expect(() => convertMarkdownToExcalidrawJson(content)).toThrow();
  });

  it("throws when file has no Drawing section", () => {
    const content = `---\nexcalidraw-plugin: parsed\n---\nSome markdown without a drawing.\n`;
    expect(() => convertMarkdownToExcalidrawJson(content)).toThrow("No Drawing section");
  });
});

describe("excalidrawMdToExcalidrawFilename()", () => {
  it("strips .md suffix from .excalidraw.md filename", () => {
    expect(excalidrawMdToExcalidrawFilename("2025-06-02-EdInsights.excalidraw.md")).toBe("2025-06-02-EdInsights.excalidraw");
  });

  it("handles spaces in filename", () => {
    expect(excalidrawMdToExcalidrawFilename("My Drawing.excalidraw.md")).toBe("My Drawing.excalidraw");
  });

  it("returns input unchanged if not .excalidraw.md", () => {
    expect(excalidrawMdToExcalidrawFilename("foo.excalidraw")).toBe("foo.excalidraw");
  });
});
