# Excalidraw Unified VS Code Extension — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork excalidraw-vscode and add seamless `.excalidraw.md` support so both plain and Obsidian-format Excalidraw files can be edited in one extension.

**Architecture:** A `MarkdownExcalidrawAdapter` module sits between the filesystem and the existing JSON pipeline. On open it extracts and decompresses the Excalidraw JSON from the markdown wrapper; on save it regenerates Text Elements and reassembles the markdown. The webview never sees the markdown format.

**Tech Stack:** TypeScript, VS Code Extension API, lz-string, @excalidraw/excalidraw (existing)

**Spec:** `docs/superpowers/specs/2026-03-13-excalidraw-unified-vscode-design.md`

---

## Chunk 1: Project Setup & Adapter Module

### Task 1: Fork and set up the repository

**Files:**
- Clone: `excalidraw/excalidraw-vscode` into the project directory

- [ ] **Step 1: Fork the upstream repo (flat clone into project directory)**

```bash
cd /Users/lhunt/code/lancehunt/excalidraw-unified-vscode
gh repo fork excalidraw/excalidraw-vscode --clone=false
git clone https://github.com/<your-gh-username>/excalidraw-vscode.git .
git remote add upstream https://github.com/excalidraw/excalidraw-vscode.git
```

Expected: Repo cloned flat into the project directory with `origin` pointing to your fork and `upstream` to the original.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install lz-string
npm install --save-dev @types/lz-string
```

Expected: `node_modules/` populated, `lz-string` in `package.json` dependencies

- [ ] **Step 3: Verify the extension builds**

```bash
npm run build
```

Expected: Build succeeds, `dist/` populated

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lz-string dependency for .excalidraw.md support"
```

---

### Task 2: Write the MarkdownExcalidrawAdapter — parser tests

**Files:**
- Create: `src/markdown-adapter.test.ts`
- Create: `src/fixtures/sample-compressed.excalidraw.md` (copy from Overmind)
- Create: `src/fixtures/sample-uncompressed.excalidraw.md` (hand-craft)

- [ ] **Step 1: Create fixture files**

Copy a real `.excalidraw.md` from your Overmind vault as `src/fixtures/sample-compressed.excalidraw.md`.

Create a minimal uncompressed fixture at `src/fixtures/sample-uncompressed.excalidraw.md`:

```markdown
---

excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==

# Excalidraw Data

## Text Elements
Hello World ^abc123

%%
## Drawing
```json
{"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":[{"id":"abc123","type":"text","x":100,"y":100,"width":120,"height":25,"text":"Hello World","originalText":"Hello World","fontSize":20,"fontFamily":1,"textAlign":"left","verticalAlign":"top","strokeColor":"#000000","backgroundColor":"transparent","fillStyle":"hachure","strokeWidth":1,"roughness":1,"opacity":100,"groupIds":[],"roundness":null,"seed":1,"version":1,"versionNonce":1,"isDeleted":false,"boundElements":null,"updated":1,"link":null,"locked":false,"lineHeight":1.25,"angle":0,"frameId":null,"index":"a0","containerId":null}],"appState":{"viewBackgroundColor":"#ffffff"},"files":{}}
```
%%
```

- [ ] **Step 2: Write failing parser tests**

Create `src/markdown-adapter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { MarkdownExcalidrawAdapter } from "./markdown-adapter";

describe("MarkdownExcalidrawAdapter", () => {
  describe("parse", () => {
    it("should extract JSON from compressed-json format", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "fixtures/sample-compressed.excalidraw.md"),
        "utf-8"
      );
      const adapter = new MarkdownExcalidrawAdapter();
      const result = adapter.parse(content);

      expect(result.json).toBeDefined();
      const scene = JSON.parse(result.json);
      expect(scene.type).toBe("excalidraw");
      expect(Array.isArray(scene.elements)).toBe(true);
    });

    it("should extract JSON from uncompressed json format", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "fixtures/sample-uncompressed.excalidraw.md"),
        "utf-8"
      );
      const adapter = new MarkdownExcalidrawAdapter();
      const result = adapter.parse(content);

      expect(result.json).toBeDefined();
      const scene = JSON.parse(result.json);
      expect(scene.type).toBe("excalidraw");
      expect(scene.elements[0].text).toBe("Hello World");
    });

    it("should detect compression format", () => {
      const compressed = fs.readFileSync(
        path.join(__dirname, "fixtures/sample-compressed.excalidraw.md"),
        "utf-8"
      );
      const uncompressed = fs.readFileSync(
        path.join(__dirname, "fixtures/sample-uncompressed.excalidraw.md"),
        "utf-8"
      );
      const adapter = new MarkdownExcalidrawAdapter();

      const r1 = adapter.parse(compressed);
      expect(r1.compressionFormat).toBe("compressed-json");

      const r2 = adapter.parse(uncompressed);
      expect(r2.compressionFormat).toBe("json");
    });

    it("should preserve frontmatter", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "fixtures/sample-uncompressed.excalidraw.md"),
        "utf-8"
      );
      const adapter = new MarkdownExcalidrawAdapter();
      const result = adapter.parse(content);

      expect(result.frontmatter).toContain("excalidraw-plugin: parsed");
    });

    it("should handle file with no Drawing section as empty canvas", () => {
      const content = `---\n\nexcalidraw-plugin: parsed\n\n---\n\n# Excalidraw Data\n\n## Text Elements\n`;
      const adapter = new MarkdownExcalidrawAdapter();
      const result = adapter.parse(content);

      expect(result.json).toBeDefined();
      const scene = JSON.parse(result.json);
      expect(scene.type).toBe("excalidraw");
      expect(scene.elements).toEqual([]);
    });

    it("should throw on corrupted compressed data", () => {
      const content = `---\n\nexcalidraw-plugin: parsed\n\n---\n\n# Excalidraw Data\n\n## Text Elements\n\n%%\n## Drawing\n\`\`\`compressed-json\nNOT_VALID_BASE64_DATA!!!\n\`\`\`\n%%`;
      const adapter = new MarkdownExcalidrawAdapter();

      expect(() => adapter.parse(content)).toThrow();
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/markdown-adapter.test.ts
```

Expected: FAIL — `Cannot find module './markdown-adapter'`

- [ ] **Step 4: Commit test file and fixtures**

```bash
git add src/markdown-adapter.test.ts src/fixtures/
git commit -m "test: add failing tests for MarkdownExcalidrawAdapter parser"
```

---

### Task 3: Implement the MarkdownExcalidrawAdapter — parser

**Files:**
- Create: `src/markdown-adapter.ts`

- [ ] **Step 1: Implement the adapter module**

Create `src/markdown-adapter.ts`:

```typescript
import { compressToBase64, decompressFromBase64 } from "lz-string";

export interface ParseResult {
  /** The extracted Excalidraw JSON string */
  json: string;
  /** Original YAML frontmatter (between --- delimiters), preserved verbatim */
  frontmatter: string;
  /** "compressed-json" or "json" — write back in the same format */
  compressionFormat: "compressed-json" | "json";
  /** Any content between end of frontmatter and "# Excalidraw Data" heading */
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

/**
 * Parses and serializes the Obsidian .excalidraw.md format.
 *
 * File structure:
 *   ---
 *   (YAML frontmatter)
 *   ---
 *   (optional passthrough content)
 *   # Excalidraw Data
 *   ## Text Elements
 *   (text index)
 *   %%
 *   ## Drawing
 *   ```compressed-json   OR   ```json
 *   (drawing data)
 *   ```
 *   %%
 */
export class MarkdownExcalidrawAdapter {
  /**
   * Extract Excalidraw JSON from an .excalidraw.md file.
   */
  parse(content: string): ParseResult {
    // Normalize line endings
    const text = content.replace(/\r\n/g, "\n");

    // Extract frontmatter
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = fmMatch ? fmMatch[1] : "";
    const afterFrontmatter = fmMatch
      ? text.slice(fmMatch[0].length)
      : text;

    // Extract passthrough content (between frontmatter and # Excalidraw Data)
    const excalidrawDataIdx = afterFrontmatter.indexOf("# Excalidraw Data");
    const passthroughContent =
      excalidrawDataIdx >= 0
        ? afterFrontmatter.slice(0, excalidrawDataIdx)
        : afterFrontmatter;

    // Find the drawing code block
    const codeBlockMatch = text.match(
      /```(compressed-json|json)\n([\s\S]*?)\n```/
    );

    if (!codeBlockMatch) {
      // No Drawing section — return empty scene
      return {
        json: EMPTY_SCENE,
        frontmatter,
        compressionFormat: "compressed-json",
        passthroughContent,
      };
    }

    const compressionFormat = codeBlockMatch[1] as "compressed-json" | "json";
    const rawData = codeBlockMatch[2].trim();

    let json: string;
    if (compressionFormat === "compressed-json") {
      const decompressed = decompressFromBase64(rawData);
      if (!decompressed) {
        throw new Error(
          "Failed to decompress .excalidraw.md Drawing data. The file may be corrupted."
        );
      }
      json = decompressed;
    } else {
      json = rawData;
    }

    // Validate it's parseable JSON with excalidraw structure
    const parsed = JSON.parse(json);
    if (!parsed.type && !parsed.elements) {
      throw new Error("Drawing data does not appear to be valid Excalidraw JSON");
    }

    return {
      json,
      frontmatter,
      compressionFormat,
      passthroughContent,
    };
  }

  /**
   * Reassemble an .excalidraw.md file from Excalidraw JSON.
   */
  serialize(json: string, metadata: Omit<ParseResult, "json">): string {
    const scene = JSON.parse(json);

    // Regenerate Text Elements section
    const textElements = (scene.elements || [])
      .filter(
        (el: { type: string; isDeleted?: boolean }) =>
          el.type === "text" && !el.isDeleted
      )
      .map(
        (el: { originalText?: string; text?: string; id: string }) =>
          `${el.originalText || el.text} ^${el.id}`
      )
      .join("\n\n");

    // Compress or leave raw based on original format
    let drawingData: string;
    if (metadata.compressionFormat === "compressed-json") {
      drawingData = compressToBase64(json);
    } else {
      drawingData = json;
    }

    // Reassemble the file
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
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/markdown-adapter.test.ts
```

Expected: All parser tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/markdown-adapter.ts
git commit -m "feat: implement MarkdownExcalidrawAdapter parse/serialize"
```

---

### Task 4: Write and pass serializer round-trip tests

**Files:**
- Modify: `src/markdown-adapter.test.ts`

- [ ] **Step 1: Add serializer and round-trip tests**

Append to `src/markdown-adapter.test.ts`:

```typescript
describe("serialize", () => {
  it("should round-trip an uncompressed file", () => {
    const original = fs.readFileSync(
      path.join(__dirname, "fixtures/sample-uncompressed.excalidraw.md"),
      "utf-8"
    );
    const adapter = new MarkdownExcalidrawAdapter();
    const parsed = adapter.parse(original);
    const serialized = adapter.serialize(parsed.json, {
      frontmatter: parsed.frontmatter,
      compressionFormat: parsed.compressionFormat,
      passthroughContent: parsed.passthroughContent,
    });

    // Re-parse the serialized output and compare JSON
    const reparsed = adapter.parse(serialized);
    expect(JSON.parse(reparsed.json)).toEqual(JSON.parse(parsed.json));
    expect(reparsed.compressionFormat).toBe("json");
  });

  it("should round-trip a compressed file", () => {
    const original = fs.readFileSync(
      path.join(__dirname, "fixtures/sample-compressed.excalidraw.md"),
      "utf-8"
    );
    const adapter = new MarkdownExcalidrawAdapter();
    const parsed = adapter.parse(original);
    const serialized = adapter.serialize(parsed.json, {
      frontmatter: parsed.frontmatter,
      compressionFormat: parsed.compressionFormat,
      passthroughContent: parsed.passthroughContent,
    });

    const reparsed = adapter.parse(serialized);
    expect(JSON.parse(reparsed.json)).toEqual(JSON.parse(parsed.json));
    expect(reparsed.compressionFormat).toBe("compressed-json");
  });

  it("should regenerate Text Elements from scene data", () => {
    const adapter = new MarkdownExcalidrawAdapter();
    const scene = {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "abc123",
          type: "text",
          text: "Hello",
          originalText: "Hello",
          isDeleted: false,
        },
        {
          id: "def456",
          type: "text",
          text: "World",
          originalText: "World",
          isDeleted: false,
        },
        {
          id: "ghi789",
          type: "rectangle",
          isDeleted: false,
        },
        {
          id: "deleted1",
          type: "text",
          text: "Gone",
          originalText: "Gone",
          isDeleted: true,
        },
      ],
      appState: {},
      files: {},
    };

    const result = adapter.serialize(JSON.stringify(scene), {
      frontmatter: "\nexcalidraw-plugin: parsed\n",
      compressionFormat: "json",
      passthroughContent: "\n",
    });

    expect(result).toContain("Hello ^abc123");
    expect(result).toContain("World ^def456");
    expect(result).not.toContain("ghi789");
    expect(result).not.toContain("Gone");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/markdown-adapter.test.ts
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/markdown-adapter.test.ts
git commit -m "test: add serializer and round-trip tests for markdown adapter"
```

---

## Chunk 2: Extension Integration

### Task 5: Register `.excalidraw.md` in package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add file pattern to customEditors selector**

In `package.json`, find the `customEditors` array and add the new pattern:

```json
"selector": [
    { "filenamePattern": "*.excalidraw" },
    { "filenamePattern": "*.excalidraw.json" },
    { "filenamePattern": "*.excalidraw.svg" },
    { "filenamePattern": "*.excalidraw.png" },
    { "filenamePattern": "*.excalidraw.md" }
]
```

- [ ] **Step 2: Update activation events (if present)**

Check if `package.json` has an `activationEvents` field. The upstream currently has:
```json
"activationEvents": [
    "workspaceContains:**/*.{excalidraw,excalidraw.svg,excalidraw.png}"
]
```

If present, update it to include `.excalidraw.md`:
```json
"activationEvents": [
    "workspaceContains:**/*.{excalidraw,excalidraw.svg,excalidraw.png,excalidraw.md}"
]
```

If `activationEvents` is absent (modern VS Code auto-generates from `customEditors`), skip this step — the `customEditors` selector from Step 1 is sufficient.

- [ ] **Step 3: Update editor/title menu `when` clauses to include .md**

Find the `editor/title` menus and update the `when` regex patterns:

```json
{
    "command": "excalidraw.showEditor",
    "alt": "excalidraw.showEditorToSide",
    "when": "activeCustomEditorId != 'editor.excalidraw' && resourceFilename =~ /^.+\\.excalidraw(.png|.svg|.md)?$/",
    "group": "navigation"
},
{
    "command": "excalidraw.showSource",
    "alt": "excalidraw.showSourceToSide",
    "group": "navigation",
    "when": "activeCustomEditorId == 'editor.excalidraw' && resourceFilename =~ /^.+\\.excalidraw(.svg|.md)?$/"
}
```

- [ ] **Step 4: Verify build still passes**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: register .excalidraw.md file extension"
```

---

### Task 6: Integrate adapter into document.ts

**Files:**
- Modify: `src/document.ts`

The upstream `document.ts` has: imports, the `ExcalidrawDocument` class with `uri`, `content`, `contentType`, `getContentType()`, constructor, `revert()`, `backup()`, `save()`, `update()`, `saveAs()`, and `dispose()`. We make targeted additions — do NOT replace the whole file.

- [ ] **Step 1: Add import for the adapter at the top of document.ts**

Add after the existing imports (`import * as vscode` and `import * as path`):

```typescript
import { MarkdownExcalidrawAdapter, type ParseResult } from "./markdown-adapter";
```

- [ ] **Step 2: Add class-level properties for markdown support**

Inside the `ExcalidrawDocument` class, after the `public readonly contentType;` line, add:

```typescript
/** Stored metadata for .excalidraw.md round-trip. Undefined for other formats. */
public markdownMetadata?: Omit<ParseResult, "json">;

private static adapter = new MarkdownExcalidrawAdapter();
```

- [ ] **Step 3: Update getContentType() to check for .excalidraw.md first**

Replace the existing `getContentType()` method. The original switches on `path.parse(this.uri.fsPath).ext` which returns `.md` for `.excalidraw.md` files — we need to check the full suffix first:

```typescript
getContentType(): string {
  const fsPath = this.uri.fsPath;
  if (fsPath.endsWith(".excalidraw.md")) {
    return "text/x-excalidraw-markdown";
  }
  switch (path.parse(fsPath).ext) {
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "application/json";
  }
}
```

- [ ] **Step 4: Update the constructor to parse .excalidraw.md on open**

Replace the existing constructor. The original just assigns `this.uri`, `this.content`, and `this.contentType`. The new version adds markdown parsing:

```typescript
constructor(uri: vscode.Uri, content: Uint8Array) {
  this.uri = uri;
  this.contentType = this.getContentType();

  if (this.contentType === "text/x-excalidraw-markdown") {
    const text = new TextDecoder().decode(content);
    const result = ExcalidrawDocument.adapter.parse(text);
    this.markdownMetadata = {
      frontmatter: result.frontmatter,
      compressionFormat: result.compressionFormat,
      passthroughContent: result.passthroughContent,
    };
    this.content = new TextEncoder().encode(result.json);
  } else {
    this.content = content;
  }
}
```

- [ ] **Step 5: Update revert() to re-parse .excalidraw.md**

Replace the existing `revert()`. The original just does `this.content = await vscode.workspace.fs.readFile(this.uri)`:

```typescript
async revert() {
  const rawContent = await vscode.workspace.fs.readFile(this.uri);
  if (this.contentType === "text/x-excalidraw-markdown") {
    const text = new TextDecoder().decode(rawContent);
    const result = ExcalidrawDocument.adapter.parse(text);
    this.markdownMetadata = {
      frontmatter: result.frontmatter,
      compressionFormat: result.compressionFormat,
      passthroughContent: result.passthroughContent,
    };
    this.content = new TextEncoder().encode(result.json);
  } else {
    this.content = rawContent;
  }
}
```

- [ ] **Step 6: Update saveAs() to re-wrap .excalidraw.md**

Note: The upstream `save()` method calls `this.saveAs(this.uri)`, so updating `saveAs()` is sufficient — `save()` does not need changes.

Replace the existing `saveAs()`. The original just does `vscode.workspace.fs.writeFile(destination, this.content)`:

```typescript
async saveAs(destination: vscode.Uri) {
  let output: Uint8Array;
  if (
    this.contentType === "text/x-excalidraw-markdown" &&
    this.markdownMetadata
  ) {
    const json = new TextDecoder().decode(this.content);
    const markdown = ExcalidrawDocument.adapter.serialize(
      json,
      this.markdownMetadata
    );
    output = new TextEncoder().encode(markdown);
  } else {
    output = this.content;
  }
  return vscode.workspace.fs.writeFile(destination, output);
}
```

- [ ] **Step 7: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/document.ts
git commit -m "feat: integrate markdown adapter into ExcalidrawDocument"
```

---

### Task 7: Update editor.ts for .excalidraw.md content type

**Files:**
- Modify: `src/editor.ts`

The upstream `editor.ts` has two classes: `ExcalidrawEditorProvider` (with `openCustomDocument`, `resolveCustomEditor`, save/revert/backup delegation) and `ExcalidrawEditor` (with `setupWebview`, `buildHtmlForWebview`, `extractName`, config getters). Plus a standalone `openLink` function. We make targeted changes to specific methods.

- [ ] **Step 1: Wrap ExcalidrawDocument construction in try/catch in openCustomDocument**

In the `ExcalidrawEditorProvider` class, find the `openCustomDocument` method. The existing code creates `const document = new ExcalidrawDocument(uri, content)` directly. Wrap it in a try/catch to handle corrupted `.excalidraw.md` files:

Replace this line:
```typescript
const document = new ExcalidrawDocument(uri, content);
```

With:
```typescript
let document: ExcalidrawDocument;
try {
  document = new ExcalidrawDocument(uri, content);
} catch (e) {
  // Per spec: show error and do NOT silently open a blank canvas over corrupted data
  vscode.window.showErrorMessage(
    `Failed to open ${uri.fsPath}: ${e instanceof Error ? e.message : e}`
  );
  throw e;
}
```

This matches the spec's edge case handling: "Show VS Code error notification. Do not open a blank canvas over the user's data."

- [ ] **Step 2: Update extractName to strip .excalidraw.md**

In the `ExcalidrawEditor` class, the `extractName` method needs to handle the `.excalidraw.md` extension:

```typescript
public extractName(uri: vscode.Uri) {
  const basename = path.parse(uri.fsPath).base;
  if (basename.endsWith(".excalidraw.md")) {
    return basename.slice(0, -14);
  }
  const name = path.parse(uri.fsPath).name;
  return name.endsWith(".excalidraw") ? name.slice(0, -11) : name;
}
```

- [ ] **Step 3: Update openLink to recognize .excalidraw.md**

In the `openLink` function at the bottom of editor.ts, add `.excalidraw.md` to the extensions array:

```typescript
const extensions = [
  ".excalidraw.md",
  ".excalidraw",
  ".excalidraw.json",
  ".excalidraw.png",
  ".excalidraw.svg",
];
```

Note: `.excalidraw.md` must come before `.excalidraw` so the longer match wins.

- [ ] **Step 4: Update contentType passed to webview**

In the `ExcalidrawEditor` class, find the `setupWebview()` method. Near the end, there's a `this.webview.html = await this.buildHtmlForWebview({...})` call. The config object includes `contentType: this.document.contentType`. For `.excalidraw.md` files, the adapter has already extracted the JSON on the extension host side, so the webview should see `application/json`. Change the `contentType` line in that config object:

Replace:
```typescript
contentType: this.document.contentType,
```

With:
```typescript
contentType:
  this.document.contentType === "text/x-excalidraw-markdown"
    ? "application/json"
    : this.document.contentType,
```

This is the only change needed in `setupWebview()`. No changes are needed in `webview/src/main.tsx` — the webview just sees `application/json` and processes it normally.

**Spec deviation note:** The spec lists `webview/src/main.tsx` as integration point #4 (adding a case to `getInitialData()`). Instead, we handle this entirely on the extension host side by passing `application/json` as the content type. This is simpler and avoids touching the webview build. The result is identical — the webview sees plain Excalidraw JSON.

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/editor.ts
git commit -m "feat: update editor for .excalidraw.md content type handling"
```

---

### Task 8: Add "New Excalidraw Drawing (Obsidian .md)" command

**Files:**
- Modify: `src/commands.ts`
- Modify: `src/utils.ts`
- Modify: `package.json`

- [ ] **Step 1: Add newMarkdownFile utility function**

Add to `src/utils.ts`. The upstream `utils.ts` already imports `vscode` and `path`, and already defines `getActiveWorkspace()` and a `runningCounter` variable (used by `newUntitledExcalidrawDocument`). Add the new import and function after the existing code:

```typescript
import { compressToBase64 } from "lz-string";
import { EMPTY_SCENE as EMPTY_SCENE_JSON } from "./markdown-adapter";

export async function newExcalidrawMarkdownDocument() {
  runningCounter += 1;
  const ws = getActiveWorkspace();
  let fileName = `Untitled-${runningCounter}.excalidraw.md`;
  if (ws) {
    fileName = path.join(ws.uri.fsPath, fileName);
  }

  const compressedScene = compressToBase64(EMPTY_SCENE_JSON);
  const template = [
    "---",
    "",
    "excalidraw-plugin: parsed",
    "tags: [excalidraw]",
    "",
    "---",
    "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==",
    "",
    "",
    "# Excalidraw Data",
    "",
    "## Text Elements",
    "",
    "%%",
    "## Drawing",
    "```compressed-json",
    compressedScene,
    "```",
    "%%",
    "",
  ].join("\n");

  const uri = vscode.Uri.file(fileName);
  await vscode.workspace.fs.writeFile(
    uri,
    new TextEncoder().encode(template)
  );
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "editor.excalidraw"
  );
}
```

- [ ] **Step 2: Register the new command**

Add to `src/commands.ts`:

```typescript
import { newUntitledExcalidrawDocument, newExcalidrawMarkdownDocument } from "./utils";

// In registerCommands function, add:
async function newMarkdownFile() {
  try {
    await newExcalidrawMarkdownDocument();
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to create new markdown file: ${error}`
    );
  }
}

// Add registration:
context.subscriptions.push(
  vscode.commands.registerCommand(
    "excalidraw.newMarkdownFile",
    newMarkdownFile
  )
);
```

- [ ] **Step 3: Add command to package.json**

Add to the `commands` array in `package.json`:

```json
{
    "command": "excalidraw.newMarkdownFile",
    "category": "Excalidraw",
    "title": "New Drawing (Obsidian .md)",
    "icon": "$(new-file)"
}
```

Add to the `file/newFile` menu:

```json
"file/newFile": [
    { "command": "excalidraw.newFile" },
    { "command": "excalidraw.newMarkdownFile" }
]
```

Add to `commandPalette` (make it visible — unlike the existing newFile which is hidden):

```json
{
    "command": "excalidraw.newMarkdownFile",
    "when": "true"
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/commands.ts src/utils.ts package.json
git commit -m "feat: add 'New Drawing (Obsidian .md)' command"
```

---

## Chunk 3: Verification & Cleanup

### Task 9: Run full test suite

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run
```

Expected: All tests PASS (adapter tests from Tasks 2-4 plus any existing upstream tests)

- [ ] **Step 2: Build the extension**

```bash
npm run build
```

Expected: Build succeeds with no errors or warnings

- [ ] **Step 3: Commit any fixes if needed**

If tests or build revealed issues, fix and commit before proceeding.

---

### Task 10: Manual smoke test

- [ ] **Step 1: Build the extension (if not already built)**

```bash
npm run build
```

- [ ] **Step 2: Launch Extension Development Host**

Press `F5` in VS Code (or run "Debug: Start Debugging"). This opens a new VS Code window with your extension loaded.

- [ ] **Step 3: Test opening an existing .excalidraw.md file**

Open one of the `.excalidraw.md` files from the Overmind vault (or any `.excalidraw.md` file you have). For example:

```
/Users/lhunt/code/lancehunt/Overmind/diagrams/2026-03-03 skyscraper-conceptual.excalidraw.md
```

Expected: The Excalidraw visual editor opens. You should see the diagram with all shapes and text intact.

- [ ] **Step 4: Test editing and saving**

Make a visible change (add a shape or text). Save with Cmd+S.

Expected: File saves without error.

- [ ] **Step 5: Verify round-trip in Obsidian**

Open the same file in Obsidian.

Expected: The diagram loads correctly with your VS Code edit visible. No data loss, no corruption.

- [ ] **Step 6: Test creating a new .excalidraw.md**

In the Extension Development Host, run command palette → "Excalidraw: New Drawing (Obsidian .md)".

Expected: A new file is created and the Excalidraw editor opens with an empty canvas.

- [ ] **Step 7: Test opening a plain .excalidraw file still works**

Open a plain `.excalidraw` file.

Expected: Works exactly as before — no regression.

---

### Task 11: Update extension metadata

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update extension name and description**

Update the top-level fields in `package.json`:

```json
{
    "name": "excalidraw-unified",
    "displayName": "Excalidraw Unified",
    "description": "Draw schemas in VS Code using Excalidraw — supports both .excalidraw and .excalidraw.md (Obsidian) formats",
    "publisher": "lancehunt"
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: update extension metadata for unified fork"
```
