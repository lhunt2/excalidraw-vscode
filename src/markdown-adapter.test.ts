import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { MarkdownExcalidrawAdapter, EMPTY_SCENE } from "./markdown-adapter";

const fixturesDir = join(__dirname, "fixtures");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("MarkdownExcalidrawAdapter.parse()", () => {
  const adapter = new MarkdownExcalidrawAdapter();

  it("extracts JSON from compressed-json format", () => {
    const content = readFixture("sample-compressed.excalidraw.md");
    const result = adapter.parse(content);
    expect(result.compressionFormat).toBe("compressed-json");
    const parsed = JSON.parse(result.json);
    expect(parsed.type).toBe("excalidraw");
    expect(Array.isArray(parsed.elements)).toBe(true);
  });

  it("extracts JSON from uncompressed json format", () => {
    const content = readFixture("sample-uncompressed.excalidraw.md");
    const result = adapter.parse(content);
    expect(result.compressionFormat).toBe("json");
    const parsed = JSON.parse(result.json);
    expect(parsed.type).toBe("excalidraw");
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.elements[0].text).toBe("Hello World");
  });

  it("detects compression format correctly", () => {
    const compressed = readFixture("sample-compressed.excalidraw.md");
    const uncompressed = readFixture("sample-uncompressed.excalidraw.md");
    expect(adapter.parse(compressed).compressionFormat).toBe("compressed-json");
    expect(adapter.parse(uncompressed).compressionFormat).toBe("json");
  });

  it("preserves frontmatter", () => {
    const content = readFixture("sample-uncompressed.excalidraw.md");
    const result = adapter.parse(content);
    expect(result.frontmatter).toContain("excalidraw-plugin: parsed");
    expect(result.frontmatter).toContain("tags: [excalidraw]");
  });

  it("returns empty canvas for file with no Drawing section", () => {
    const content = `---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==\n`;
    const result = adapter.parse(content);
    expect(result.json).toBe(EMPTY_SCENE);
    expect(result.compressionFormat).toBe("compressed-json");
  });

  it("throws on corrupted compressed data", () => {
    const content = `---\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n---\n\n# Excalidraw Data\n\n## Text Elements\n\n%%\n## Drawing\n\`\`\`compressed-json\nNOT_VALID_BASE64_COMPRESSED_DATA_!!!!\n\`\`\`\n%%\n`;
    expect(() => adapter.parse(content)).toThrow(
      "Failed to decompress .excalidraw.md Drawing data"
    );
  });
});

describe("MarkdownExcalidrawAdapter.serialize()", () => {
  const adapter = new MarkdownExcalidrawAdapter();

  it("produces a file that round-trips through parse()", () => {
    const content = readFixture("sample-uncompressed.excalidraw.md");
    const parsed = adapter.parse(content);
    const { json, ...metadata } = parsed;
    const serialized = adapter.serialize(json, metadata);
    const reparsed = adapter.parse(serialized);
    expect(JSON.parse(reparsed.json)).toEqual(JSON.parse(json));
    expect(reparsed.frontmatter).toBe(parsed.frontmatter);
    expect(reparsed.compressionFormat).toBe(parsed.compressionFormat);
  });

  it("round-trips compressed fixture", () => {
    const content = readFixture("sample-compressed.excalidraw.md");
    const parsed = adapter.parse(content);
    const { json, ...metadata } = parsed;
    const serialized = adapter.serialize(json, metadata);
    const reparsed = adapter.parse(serialized);
    expect(JSON.parse(reparsed.json)).toEqual(JSON.parse(json));
  });

  it("regenerates Text Elements section from scene elements", () => {
    const scene = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "abc123",
          type: "text",
          text: "Hello World",
          originalText: "Hello World",
          isDeleted: false,
        },
        {
          id: "def456",
          type: "text",
          text: "Second Element",
          originalText: "Second Element",
          isDeleted: false,
        },
        {
          id: "ghi789",
          type: "rectangle",
          isDeleted: false,
        },
        {
          id: "jkl000",
          type: "text",
          text: "Deleted",
          originalText: "Deleted",
          isDeleted: true,
        },
      ],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    });
    const metadata = {
      frontmatter: "excalidraw-plugin: parsed\ntags: [excalidraw]",
      compressionFormat: "json" as const,
      passthroughContent:
        "\n==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==\n\n",
    };
    const serialized = adapter.serialize(scene, metadata);
    expect(serialized).toContain("Hello World ^abc123");
    expect(serialized).toContain("Second Element ^def456");
    expect(serialized).not.toContain("Deleted ^jkl000");
    // Rectangle should not appear in Text Elements
    expect(serialized).not.toContain("^ghi789");
  });

  it("serializes with compressed-json format when specified", () => {
    const content = readFixture("sample-compressed.excalidraw.md");
    const parsed = adapter.parse(content);
    const { json, ...metadata } = parsed;
    const serialized = adapter.serialize(json, metadata);
    expect(serialized).toContain("```compressed-json");
  });

  it("serializes with json format when specified", () => {
    const content = readFixture("sample-uncompressed.excalidraw.md");
    const parsed = adapter.parse(content);
    const { json, ...metadata } = parsed;
    const serialized = adapter.serialize(json, metadata);
    expect(serialized).toContain("```json");
  });
});
