# Architecture

## Native Preview Integration

Better Markdown Preview augments VS Code's built-in Markdown preview through
the supported Markdown extension contribution points. It does not own a custom
webview. This keeps native source synchronization, theme integration, resource
resolution, workspace trust, and user preview styles intact.

The manifest declares `markdown.markdownItPlugins`, `markdown.previewStyles`,
and `markdown.previewScripts`. The extension activation export composes narrow
rules onto the Markdown-It instance supplied by VS Code; it does not construct
the native renderer itself.

## Rendering Boundary

`src/markdown/compose.ts` installs standard Markdown-It plugins for task lists,
definition lists, footnotes, and GitHub alerts. It enables Markdown-It's native
linkify rule even when the preview setting disabled it, preserving native
scheme and email handling. VS Code disables fuzzy links on the supplied
linkifier, so a narrow `linkify-it` pass adds only GFM `www.` literals while
retaining native normalization, validation, nesting, and HTML-anchor guards.
VS Code 1.125 collapses some backslash-escaped punctuation before contributed
core rules run, so an escaped `www\.` is indistinguishable from authored
`www.` at this boundary. Local rules cover GFM tag filtering, TOML
frontmatter, responsive columns, exact Mermaid fences, and rich fence metadata.

Renderer wrappers retain and invoke the rule already installed on the supplied
Markdown-It instance. In particular, fenced code delegates to VS Code's native
renderer after recognized metadata and diff annotations are removed. This keeps
Highlight.js, language classes, source maps, and native copy controls
authoritative.

All emitted classes and data attributes are scoped with
`better-markdown-preview` or `bmp`. Invalid extension syntax falls back to
ordinary Markdown rather than partially transforming a document.

## Preview Boundary

`src/preview/runtime.ts` owns idempotent DOM enhancement. It wraps the existing
`.markdown-body` in a layout without replacing that element, preserves heading
and `data-line` nodes, rebuilds the TOC after content replacement or body
retargeting, and augments rich code blocks while retaining their authored text.

`media/preview.css` uses VS Code webview color variables and body theme classes;
it does not own a light or dark palette. VS Code loads user `markdown.styles`
after contributed styles, so user overrides retain precedence.

Mermaid is absent from both Extension Host bundles. The small preview runtime
dynamically imports `dist/preview/mermaid-runtime.js` only after finding an
exact Mermaid block. The renderer uses strict security, derives colors from
VS Code variables, and restores escaped source on every failure path.

## Runtime Boundary

`src/extension.ts` is the shared lifecycle entry point. Esbuild emits it twice:

- `dist/node/extension.js` targets the desktop Extension Host.
- `dist/web/extension.js` is browser-compatible for eligible web Extension
  Hosts; the current harness provides structural build evidence rather than an
  executed vscode.dev host.

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

The rendering contract is recorded in
`docs/plans/002-renderer-implementation.md`.
