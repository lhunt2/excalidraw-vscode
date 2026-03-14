# Excalidraw Unified VS Code Extension — Design Spec

## Problem

The existing `excalidraw-vscode` extension only handles `.excalidraw` (and `.excalidraw.json`, `.excalidraw.svg`, `.excalidraw.png`) files. Obsidian's Excalidraw plugin stores drawings as `.excalidraw.md` files — a markdown wrapper containing YAML frontmatter, a human-readable text index, and LZ-string compressed Excalidraw JSON. Users who work across both tools cannot visually edit `.excalidraw.md` files in VS Code.

## Goal

Fork `excalidraw/excalidraw-vscode` and add seamless support for `.excalidraw.md` files so both formats can be edited in a single extension. Files round-trip cleanly between VS Code and Obsidian with no data loss.

## Audience

Personal use plus coworkers. Published to VS Code marketplace but not optimized for broad community adoption or upstream merge.

## Approach

Fork and patch. Add a thin adapter layer to the existing extension — no architectural changes, no webview modifications. The adapter sits between the filesystem and the existing JSON pipeline.

## Architecture

The upstream extension has a clean two-process split:

- **Extension host** (`src/`): `ExcalidrawDocument` reads/writes files as `Uint8Array`. `ExcalidrawEditorProvider` manages the webview lifecycle.
- **Webview** (`webview/`): React app with `@excalidraw/excalidraw`. Handles parsing/serialization per content type.

The new **`MarkdownExcalidrawAdapter`** module intercepts at the extension host level:

- **On open:** Detects `.excalidraw.md` → parses markdown → extracts Drawing code block → decompresses if needed → hands raw Excalidraw JSON to the existing pipeline.
- **On save:** Takes Excalidraw JSON → regenerates Text Elements from scene data → compresses (or not, matching original format) → reassembles full `.excalidraw.md` → writes to disk.

The webview never knows about the markdown format. It only sees Excalidraw JSON.

## MarkdownExcalidrawAdapter

Core module, ~150-200 lines of TypeScript.

### Parse (file to Excalidraw JSON)

1. Read `.excalidraw.md` as UTF-8
2. Extract YAML frontmatter (between `---` delimiters)
3. Find the code block under `## Drawing` — either ` ```compressed-json ` or ` ```json `
4. If `compressed-json`: LZ-string decompress to get JSON string
5. If `json`: use raw content as JSON string
6. Store metadata envelope for round-trip (frontmatter, format flag, any passthrough content)
7. Return Excalidraw JSON as `Uint8Array`

### Serialize (Excalidraw JSON to file)

1. Parse scene to extract all text elements
2. Regenerate `## Text Elements` section: for each element with `type: "text"`, emit `{text} ^{id}`
3. Re-compress if original was `compressed-json`, leave raw if `json`
4. Reassemble full file: frontmatter + warning banner + Text Elements + Drawing block
5. Return as `Uint8Array`

### Round-trip state (per open document)

- `frontmatter`: original YAML string, preserved verbatim
- `compressionFormat`: `"compressed-json"` | `"json"` — write back in the same format the file was read as
- `passthroughContent`: any content between frontmatter and `# Excalidraw Data` (e.g., user notes), preserved verbatim

## Integration Points

Five files in the upstream codebase need changes:

### 1. `package.json` — File extension registration

Add `*.excalidraw.md` to the `customEditors` selector:

```json
"selector": [
  { "filenamePattern": "*.excalidraw" },
  { "filenamePattern": "*.excalidraw.json" },
  { "filenamePattern": "*.excalidraw.svg" },
  { "filenamePattern": "*.excalidraw.png" },
  { "filenamePattern": "*.excalidraw.md" }
]
```

### 2. `package.json` — New dependency

Add `lz-string` (MIT, same library Obsidian's plugin uses).

### 3. `src/document.ts` — Content type routing

Extend `getContentType()` to return `"text/x-excalidraw-markdown"` for `.excalidraw.md` URIs. Wrap the read/write methods: if content type is markdown, delegate to the adapter before/after the `Uint8Array` pipeline.

### 4. `webview/src/main.tsx` — Initial data parsing

Add a case for the markdown content type in `getInitialData()`. Since the adapter already extracts the JSON on the extension host side, this falls through to the existing JSON parsing path. Effectively a no-op.

### 5. `src/commands.ts` — New File command

Add a `"excalidraw.newMarkdownDrawing"` command that creates a blank `.excalidraw.md` with:

```markdown
---

excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==

# Excalidraw Data

## Text Elements

%%
## Drawing
```compressed-json
{empty scene JSON, LZ-compressed}
```
%%
```

This matches the format the Obsidian Excalidraw plugin produces, ensuring cross-tool compatibility.

The existing "New Excalidraw Drawing" command remains unchanged.

## Compression

The Obsidian Excalidraw plugin uses `lz-string` with the `compressToBase64` / `decompressFromBase64` methods. The adapter uses the same functions to ensure bit-for-bit compatibility.

## Format Detection

On read, the adapter checks the code block language identifier:

- ` ```compressed-json ` → `compressionFormat = "compressed-json"`, decompress with LZ-string
- ` ```json ` → `compressionFormat = "json"`, use raw content

On write, the adapter uses the stored `compressionFormat` to write back in the same format.

## Text Elements Regeneration

On every save, the adapter rebuilds the `## Text Elements` section from the Excalidraw scene:

```
For each element in scene.elements where type === "text":
  emit "{element.originalText} ^{element.id}\n"
```

This keeps the text index in sync with the drawing, even when text is added or removed in the VS Code visual editor.

## Edge Cases

### Handled

- **No Drawing section:** File has frontmatter but no `## Drawing` block. Treat as empty canvas. Create Drawing section on first save.
- **Corrupted LZ-string data:** Decompression fails. Show VS Code error notification. Do not open a blank canvas over the user's data.
- **Mixed line endings:** Parser regex is tolerant of `\r\n` vs `\n` and varying blank lines between sections.
- **Extra markdown content:** Any content between frontmatter and `# Excalidraw Data` is preserved verbatim through round-trips.

### Not handled (v1)

- `[[wiki-links]]` and `![[embedded images]]` referencing Obsidian vault files.
- Excalidraw drawings embedded inline in regular `.md` files (not `.excalidraw.md`).
- Obsidian plugin settings like `autoexport` or `linkPrefix`.

## New File Creation

Two command palette options:

1. **"New Excalidraw Drawing"** (existing) — creates `.excalidraw` file
2. **"New Excalidraw Drawing (Obsidian .md)"** (new) — creates `.excalidraw.md` with Obsidian-compatible template

## Testing

### Unit tests

- **Round-trip test:** Parse a known `.excalidraw.md` file, extract JSON, serialize back, verify output matches original. Use 2-3 actual files as fixtures.
- **Format detection test:** Verify `compressed-json` vs `json` is correctly detected and preserved through round-trip.
- **Text Elements regeneration test:** Modify scene (add/remove text element), serialize, verify Text Elements section reflects changes.

### Manual smoke test

Open an Obsidian-created `.excalidraw.md` in the fork, edit it, save, reopen in Obsidian — confirm no data loss.

No e2e webview tests for v1.

## Dependencies

| Dependency | Version | Purpose | License |
|-----------|---------|---------|---------|
| `lz-string` | ^1.5 | LZ-string compression/decompression | MIT |

## Estimated Scope

- `MarkdownExcalidrawAdapter` module: ~150-200 lines
- `package.json` changes: ~10 lines
- `document.ts` integration: ~20-30 lines
- `main.tsx` integration: ~5 lines
- `commands.ts` new file command: ~30-40 lines
- Unit tests: ~100-150 lines
- **Total new/modified code: ~350-450 lines**
