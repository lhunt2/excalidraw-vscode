# Maintainer Guide

## Syncing with Upstream

This extension is a fork of [excalidraw/excalidraw-vscode](https://github.com/excalidraw/excalidraw-vscode). To pull in upstream changes:

```bash
git fetch upstream
git merge upstream/master
```

After merging, reinstall and verify:

```bash
npm install && npx vitest run
```

Then rebuild and smoke test in VS Code (`F5` to launch Extension Development Host).

## Likely Merge Conflicts

Files you modified from upstream (conflict-prone):

- **`package.json`** — metadata, added dependencies, custom editor selector
- **`src/document.ts`** — markdown parsing in constructor, `revert()`, `saveAs()`
- **`src/editor.ts`** — `.excalidraw.md` routing in `setupWebview()`, `openCustomDocument()`, `extractName()`, `openLink()`

Files you added (won't conflict with upstream):

- `src/markdown-adapter.ts` — core adapter (parse/serialize)
- `src/markdown-adapter.test.ts` — unit tests
- `src/commands.ts` — new markdown file command
- `src/fixtures/` — test fixtures

## If Upstream Makes Breaking Changes

The adapter logic in `markdown-adapter.ts` is fully decoupled from the extension host. If upstream refactors `document.ts` or `editor.ts`, you only need to re-wire the integration points:

1. **`document.ts`** — constructor and `saveAs()` intercept markdown content
2. **`editor.ts`** — `setupWebview()` maps content type, `openCustomDocument()` wraps errors

The parsing/serialization logic itself won't need to change.

## Watching for Updates

On GitHub, click **Watch > Releases only** on `excalidraw/excalidraw-vscode` to get notified of new releases.
