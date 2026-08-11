# Architecture

## Native Preview Integration

Better Markdown Preview augments VS Code's built-in Markdown preview through
the supported Markdown extension contribution points. It does not own a custom
webview. This keeps native source synchronization, theme integration, resource
resolution, workspace trust, and user preview styles intact.

The foundation does not declare those contributions yet. `contributes` remains
empty until the rendering implementation lands as an independently reviewed
change.

## Runtime Boundary

`src/extension.ts` is the shared lifecycle entry point. Esbuild emits it twice:

- `dist/node/extension.js` targets the desktop Extension Host.
- `dist/web/extension.js` targets browser Extension Hosts such as vscode.dev.

Code reachable from the shared entry point must avoid Node-only APIs. If a
future feature genuinely needs platform-specific code, split the entry points
and keep shared rendering contracts platform-neutral.

Both bundles are declared in `package.json` and asserted inside the produced
VSIX. A successful desktop build alone is not sufficient evidence.

## Public Contracts

The extension manifest, Markdown-It behavior, contributed preview assets, and
settings become public contracts once introduced. Prefer small adapters around
VS Code's native renderer and scope preview CSS and scripts so other Markdown
extensions and user styles can coexist.

The accepted bootstrap scope is recorded in
`docs/plans/001-bootstrap-foundation.md`. Plans document intent; source, tests,
and shipped artifacts describe the current implementation.
