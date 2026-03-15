# Import & Convert .excalidraw.md to .excalidraw

## Goal

Strip the Obsidian markdown wrapper from `.excalidraw.md` files and produce bare `.excalidraw` (JSON) files for use in git repos with VS Code. Two workflows, same conversion logic.

## Workflows

### 1. Import from Obsidian

- **Trigger:** `Cmd+P` → "Excalidraw: Import from Obsidian"
- **Flow:**
  1. Open native file dialog filtered to `*.excalidraw.md`
  2. User picks a file from their Obsidian vault (or anywhere)
  3. Parse the markdown, extract the Excalidraw JSON (decompress if needed)
  4. Write `<original-name>.excalidraw` to the current workspace folder (explorer root if no subfolder is focused)
  5. Auto-open the new file in the Excalidraw editor
- **Source file is untouched** (copy, not move)

### 2. Convert in Place

- **Trigger:** Right-click an `.excalidraw.md` file in the VS Code explorer → "Excalidraw: Convert to .excalidraw"
- **Also available via:** `Cmd+P` → "Excalidraw: Convert .excalidraw.md to .excalidraw" (operates on the active editor file)
- **Flow:**
  1. Parse the markdown, extract the Excalidraw JSON (decompress if needed)
  2. Write `<same-name>.excalidraw` in the same directory
  3. Delete the original `.excalidraw.md` file
  4. Auto-open the new file in the Excalidraw editor

## Conversion Logic

Reuse `MarkdownExcalidrawAdapter.parse()` from `src/markdown-adapter.ts`:
- Handles both `compressed-json` and `json` formats
- Strips frontmatter, Text Elements index, and `%%` markers
- Returns raw Excalidraw JSON

Output is the JSON string written with `.excalidraw` extension. No re-compression, no markdown wrapping — just the bare scene JSON.

## Filename Mapping

| Source | Output |
|--------|--------|
| `2025-06-02-EdInsights-Integration.excalidraw.md` | `2025-06-02-EdInsights-Integration.excalidraw` |
| `My Drawing.excalidraw.md` | `My Drawing.excalidraw` |

Rule: strip the trailing `.md`, keep everything else.

## UX Details

- **File dialog (workflow 1):** Native OS file picker via `vscode.window.showOpenDialog` with filter `{'Excalidraw Markdown': ['excalidraw.md']}`. Single file selection.
- **Destination (workflow 1):** Current workspace folder root. If a multi-root workspace, use the first workspace folder.
- **Context menu (workflow 2):** Show "Convert to .excalidraw" only when right-clicking `*.excalidraw.md` files.
- **Command palette (workflow 2):** Only enabled when the active editor has an `.excalidraw.md` file open.
- **Error handling:** If parsing fails (corrupted Drawing section), show an error notification. Do not create partial output files. Do not delete the source on failure.
- **Overwrite protection:** If the target `.excalidraw` file already exists, prompt "File already exists. Overwrite?" before proceeding.

## Commands

| Command ID | Title | Context |
|-----------|-------|---------|
| `excalidraw.importFromObsidian` | Import from Obsidian | Command palette (always available) |
| `excalidraw.convertMarkdownToExcalidraw` | Convert .excalidraw.md to .excalidraw | Command palette (when active file is `.excalidraw.md`), explorer context menu (on `.excalidraw.md` files) |

## package.json Changes

- Register both commands in `contributes.commands`
- Add `explorer/context` menu entry for `convertMarkdownToExcalidraw` with `when: "resourceFilename =~ /\\.excalidraw\\.md$/"`
- Add `commandPalette` entry for `convertMarkdownToExcalidraw` with `when: "resourceFilename =~ /\\.excalidraw\\.md$/"`

## Out of Scope

- Reverse direction (`.excalidraw` → `.excalidraw.md`)
- Batch conversion
- Auto-sync / file watching
- Configurable source directory (hardcoded file picker is sufficient)
