# Import & Convert .excalidraw.md Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two VS Code commands that convert `.excalidraw.md` files to bare `.excalidraw` JSON — one via file picker (import from Obsidian), one via right-click/command palette (convert in place).

**Architecture:** Both commands share a single conversion function that uses the existing `MarkdownExcalidrawAdapter.parse()` to extract JSON, then writes it as `.excalidraw`. The import command uses `showOpenDialog`, the convert command operates on a file URI passed via context menu or the active editor's file. Both auto-open the result in the Excalidraw custom editor.

**Tech Stack:** VS Code Extension API, existing `MarkdownExcalidrawAdapter`, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-import-convert-excalidraw-md.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/convert.ts` (NEW) | Core conversion logic + both command handlers |
| `src/convert.test.ts` (NEW) | Unit tests for the conversion function (adapter integration) |
| `src/commands.ts` (MODIFY) | Register the two new commands |
| `package.json` (MODIFY) | Declare commands, menus, `when` clauses |

---

## Chunk 1: Core Conversion + Tests + Commands

### Task 1: Core conversion function with tests

**Files:**
- Create: `src/convert.ts`
- Create: `src/convert.test.ts`

The conversion function is pure logic (no VS Code API) — takes markdown string, returns JSON string. This lets us unit test it without mocking VS Code.

- [ ] **Step 1: Write the failing test for conversion**

Create `src/convert.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { convertMarkdownToExcalidrawJson } from "./convert";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/convert.test.ts`
Expected: FAIL — `convertMarkdownToExcalidrawJson` is not exported / does not exist.

- [ ] **Step 3: Write the conversion function**

Create `src/convert.ts`:

```typescript
import { MarkdownExcalidrawAdapter } from "./markdown-adapter";

const adapter = new MarkdownExcalidrawAdapter();

/**
 * Parse an .excalidraw.md string and return the bare Excalidraw JSON string.
 * Handles both compressed-json and json formats.
 * Throws on corrupted or invalid data.
 */
export function convertMarkdownToExcalidrawJson(markdownContent: string): string {
  if (!markdownContent.includes("## Drawing")) {
    throw new Error("No Drawing section found in the .excalidraw.md file.");
  }
  const result = adapter.parse(markdownContent);
  return result.json;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/convert.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/convert.ts src/convert.test.ts
git commit -m "feat: add convertMarkdownToExcalidrawJson function with tests"
```

---

### Task 2: Filename mapping helper with test

**Files:**
- Modify: `src/convert.ts`
- Modify: `src/convert.test.ts`

- [ ] **Step 1: Add filename mapping test**

Append to `src/convert.test.ts`:

```typescript
import { convertMarkdownToExcalidrawJson, excalidrawMdToExcalidrawFilename } from "./convert";

// ... existing tests ...

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
```

Update the import at the top of the file to include `excalidrawMdToExcalidrawFilename`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/convert.test.ts`
Expected: FAIL — `excalidrawMdToExcalidrawFilename` not exported.

- [ ] **Step 3: Add the function to `src/convert.ts`**

Append to `src/convert.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/convert.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/convert.ts src/convert.test.ts
git commit -m "feat: add excalidrawMdToExcalidrawFilename helper"
```

---

### Task 3: VS Code command handlers

**Files:**
- Modify: `src/convert.ts` — add `importFromObsidian()` and `convertInPlace()` command handlers
- Modify: `src/commands.ts` — register both commands

These functions use VS Code APIs so they can't be unit tested — they'll be smoke tested manually.

- [ ] **Step 1: Add command handler functions to `src/convert.ts`**

Add these imports to the top of `src/convert.ts`:

```typescript
import * as vscode from "vscode";
import * as path from "path";
```

Add these functions after the existing `excalidrawMdToExcalidrawFilename` function:

```typescript
/**
 * Shared conversion logic: read .excalidraw.md, write .excalidraw, auto-open.
 * @param sourceUri URI of the .excalidraw.md file to convert
 * @param destinationDir URI of the directory to write the .excalidraw file into
 * @param deleteSource Whether to delete the source file after conversion
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
```

- [ ] **Step 2: Register commands in `src/commands.ts`**

Add import at the top of `src/commands.ts`:

```typescript
import { importFromObsidian, convertInPlace } from "./convert";
```

Add these two registrations inside `registerCommands()`, before the closing `}`:

```typescript
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.importFromObsidian", importFromObsidian)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.convertMarkdownToExcalidraw", convertInPlace)
  );
```

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `npx vitest run`
Expected: All tests pass (11 existing + 7 new = 18 total)

- [ ] **Step 4: Commit**

```bash
git add src/convert.ts src/commands.ts
git commit -m "feat: add importFromObsidian and convertInPlace commands"
```

---

### Task 4: package.json — declare commands and menus

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add command declarations**

In `package.json`, locate the `contributes.commands` array (currently ends with the `excalidraw.newMarkdownFile` entry). Add two new entries after it:

```json
{
    "command": "excalidraw.importFromObsidian",
    "category": "Excalidraw",
    "title": "Import from Obsidian",
    "icon": "$(cloud-download)"
},
{
    "command": "excalidraw.convertMarkdownToExcalidraw",
    "category": "Excalidraw",
    "title": "Convert .excalidraw.md to .excalidraw",
    "icon": "$(file-symlink-file)"
}
```

- [ ] **Step 2: Add command palette `when` clauses**

In `contributes.menus.commandPalette`, add:

```json
{
    "command": "excalidraw.importFromObsidian",
    "when": "true"
},
{
    "command": "excalidraw.convertMarkdownToExcalidraw",
    "when": "resourceFilename =~ /\\.excalidraw\\.md$/"
}
```

- [ ] **Step 3: Add explorer context menu entry**

In `contributes.menus`, add a new `"explorer/context"` section:

```json
"explorer/context": [
    {
        "command": "excalidraw.convertMarkdownToExcalidraw",
        "when": "resourceFilename =~ /\\.excalidraw\\.md$/",
        "group": "navigation"
    }
]
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All 17 tests pass (package.json changes are declarative, but verify nothing is broken)

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: register import/convert commands in package.json menus"
```

---

### Task 5: Smoke test

Manual verification in VS Code Extension Development Host (`F5`):

- [ ] **Step 1: Test Import from Obsidian**

1. Press `Cmd+Shift+P` → type "Import from Obsidian"
2. File dialog should open
3. Navigate to `~/code/lancehunt/Overmind/diagrams/` and pick any `.excalidraw.md` file
4. Verify: `.excalidraw` file created in workspace root
5. Verify: file auto-opens in Excalidraw editor with correct content
6. Verify: original file in Overmind is untouched

- [ ] **Step 2: Test Convert in Place**

1. Copy any `.excalidraw.md` file into the workspace
2. Right-click it in the explorer → "Convert .excalidraw.md to .excalidraw"
3. Verify: `.excalidraw` file created in same directory
4. Verify: original `.excalidraw.md` is deleted
5. Verify: file auto-opens in Excalidraw editor

- [ ] **Step 3: Test overwrite protection**

1. Import the same Obsidian file again
2. Verify: prompted "File already exists. Overwrite?"
3. Click Cancel → verify no change
4. Repeat and click Overwrite → verify file is replaced

- [ ] **Step 4: Test error handling**

1. Create a file `broken.excalidraw.md` with invalid content
2. Try to convert it
3. Verify: error notification shown, no partial files created

- [ ] **Step 5: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: smoke test fixes for import/convert commands"
```
