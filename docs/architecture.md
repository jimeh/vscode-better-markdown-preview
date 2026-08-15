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
definition lists, footnotes, and GitHub alerts. Markdown-It's native linkify
rule runs first when enabled. A narrow post-native `linkify-it` pass fills
missing GFM HTTP, HTTPS, email, and `www.` literals independently of that
setting, while filtering bare domains and other schemes and retaining native
normalization, validation, nesting, and HTML-anchor guards.
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

The extension host reads one typed, window-scoped configuration snapshot and
passes it into Markdown composition. A relevant setting change refreshes the
snapshot and invokes VS Code's `markdown.api.reloadPlugins` command, which is
available at the declared 1.125.0 engine floor. Disabled rendering features are
not installed or intercepted; VS Code and other contributed Markdown plugins
remain free to handle their syntax. GFM tag filtering is unconditional.

## Preview Boundary

`src/preview/runtime.ts` owns idempotent DOM enhancement. It wraps the existing
`.markdown-body` in a layout without replacing that element, preserves heading
and `data-line` nodes, rebuilds the TOC after content replacement or body
retargeting, and augments rich code blocks while retaining their authored text.

Each render appends a hidden, escaped configuration marker containing only the
table-of-contents, smooth-scrolling, and Mermaid-viewer booleans needed in the
webview. The runtime re-reads that marker when preview content changes or the
Markdown body is replaced. It removes owned navigation or viewer UI when a
feature becomes disabled, including open dialogs and controls attached to
reused Mermaid nodes. Smooth navigation is expressed as a root class in the
contributed stylesheet and is overridden exactly when the operating system
requests reduced motion.

`media/preview.css` uses VS Code webview color variables and body theme classes;
it does not own a light or dark palette. VS Code loads user `markdown.styles`
after contributed styles, so user overrides retain precedence.

Mermaid is absent from both Extension Host bundles. The small preview runtime
dynamically imports `dist/preview/mermaid-runtime.js` only after finding an
exact Mermaid block. The renderer uses strict security, derives colors from
VS Code variables, and restores escaped source on every failure path. Rendered
diagrams remain passive in the document so they do not capture preview
scrolling. A preview-owned near-viewport dialog provides dedicated zoom and pan
interaction, refreshes its SVG clone after theme or source rerenders, and
rewrites cloned SVG IDs so Mermaid markers and gradients stay local to the
dialog.

## Runtime Boundary

`src/extension.ts` is the shared lifecycle entry point. Esbuild emits it twice:

- `dist/node/extension.js` targets the desktop Extension Host.
- `dist/web/extension.js` is browser-compatible for eligible web Extension
  Hosts and is executed in stable VS Code for the Web under headless Chromium.

Code reachable from the shared entry point must avoid Node-only APIs. If a
future feature genuinely needs platform-specific code, split the entry points
and keep shared rendering contracts platform-neutral.

Both bundles are declared in `package.json` and asserted inside the produced
VSIX. A successful desktop build alone is not sufficient evidence.

The repository's direct `markdown-it` development dependency is a controlled
unit-test fixture only. Host compatibility tests render through the built-in
Markdown extension's `markdown.api.render` command, so they exercise the
Markdown-It version, options, plugin ordering, fence renderer, and source maps
actually supplied by VS Code. If stable VS Code adopts a new Markdown-It major,
first use the host contract to identify the behavioral delta, then update the
direct fixture and focused unit expectations deliberately; do not make the
fixture masquerade as host evidence.

## Tooling Boundary

Repository-owned Node configuration, scripts, helpers, and contract tests use
explicit ESM `.mts` files. Node 24 executes these files through native type
stripping, while `tsconfig.tooling.json` independently applies strict NodeNext,
no-emit checking and restricts the files to erasable TypeScript syntax.

`.vscode-test.mjs` is the sole JavaScript compatibility exception because
`@vscode/test-cli` 0.0.15 discovers `.json`, `.js`, `.cjs`, and `.mjs` configs
but not `.mts`. Reusable version and invocation logic remains in checked `.mts`
helpers rather than the compatibility file.

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
