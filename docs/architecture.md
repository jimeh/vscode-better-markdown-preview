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

`src/markdown/compose.ts` orders standard Markdown-It plugins and the focused
rules in `src/markdown/columns.ts`, `frontmatter.ts`, `inline.ts`, and
`fences.ts`. Those modules own their feature-specific parsing and rendering.
The standard plugins cover task lists, definition lists, footnotes, GitHub
alerts, and named Unicode emoji shortcodes.
Optional emoticon shortcuts are part of the emoji plugin and remain subordinate
to the named-shortcode setting. Markdown-It's native linkify rule runs first
when enabled. A narrow post-native `linkify-it` pass fills missing GFM HTTP,
HTTPS, email, and `www.` literals independently of that setting, while filtering
bare domains and other schemes and retaining native normalization, validation,
nesting, and HTML-anchor guards. Emoji replacement runs after both linkifiers,
so autolink text and destinations remain intact while ordinary text and link
labels can contain shortcodes.
Local rules cover GFM tag filtering, TOML and YAML frontmatter, responsive
columns, exact Mermaid fences, and rich fence metadata.

VS Code 1.125 configures its supplied linkifier with `fuzzyLink: false` and
reapplies per-render options after contributed plugins. The extension must not
mutate `md.options.linkify` to compensate. Prose-oriented inline transformations
must operate on parsed text tokens rather than raw source or rendered HTML so
inline code, fenced code, HTML, existing links, and source maps keep their
native semantics. Rule ordering around native and extension-owned linkification
is part of the host compatibility contract.

VS Code 1.125 collapses backslash-escaped punctuation into plain inline text
before contributed core rules run. While emoji parsing is active, an inline
guard keeps each Markdown-escaped punctuation mark in a separate token. Emoji
and enhanced-autolink rules treat that boundary like current Markdown-It's
native `text_special` token, preserving escaped syntax across the engine floor
without reconstructing raw-source offsets or changing source maps.

Renderer wrappers retain and invoke the rule already installed on the supplied
Markdown-It instance. In particular, fenced code delegates to VS Code's native
renderer after recognized metadata and diff annotations are removed. This keeps
Highlight.js, language classes, source maps, and native copy controls
authoritative. Frontmatter likewise delegates its inner TOML or YAML source to
that supplied fence renderer, while the extension owns only the expanded
`details` wrapper. When YAML rendering is disabled, VS Code's later-installed
native frontmatter rule remains free to render its configured table, code block,
or hidden presentation.

VS Code installs its `front_matter` YAML block rule after contributed plugins,
immediately before `fence`. The extension's YAML rule therefore runs first when
enabled, while omitting it delegates cleanly to the native rule. Airplan column
closing delimiters allow trailing horizontal whitespace, and container-looking
lines inside backtick or tilde fences are code rather than nested column syntax.

VS Code's source-map core rule adds `data-line`, `code-line`, and `dir`
attributes to mapped non-inline tokens before rendering. Owned block renderers
must call `renderer.renderAttrs(token)` on their real wrapper; rendering an
`html_block` string would leave those attributes on a separate empty mapping
element.

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

`src/preview/runtime.ts` retains the stable façade while `controller.ts`
coordinates shared ownership, observers, scheduling, and disposal. Focused
modules own the TOC/layout, rich code-block enhancement, revision-aware Mermaid
renderer, and Mermaid viewer. The controller wraps the existing `.markdown-body`
in a layout without replacing that element, preserves heading and `data-line`
nodes, rebuilds the TOC after content replacement or body retargeting, and
augments rich code blocks while retaining their authored text.

Each render appends a hidden, escaped configuration marker containing the
table-of-contents, smooth-scrolling, and Mermaid-viewer booleans plus Mermaid
color-shift values needed in the webview. The runtime re-reads that marker when
preview content changes or the Markdown body is replaced. It removes owned
navigation or viewer UI when a feature becomes disabled, including open dialogs
and controls attached to reused Mermaid nodes. Owned TOC link activation applies
a root smooth-scroll class synchronously for native fragment navigation, then
removes it on the next animation frame. A bounded timeout covers a stalled frame
without extending the normal window into editor-to-preview synchronization. The
contributed stylesheet overrides the class exactly when the operating system
requests reduced motion.

`media/preview.css` uses VS Code webview color variables and body theme classes;
it does not own a light or dark palette. VS Code loads user `markdown.styles`
after contributed styles, so user overrides retain precedence.

Native preview typography uses `--markdown-font-size` and
`--markdown-line-height` without a `--vscode-` prefix. VS Code 1.125 exposes
Markdown alert identifiers as custom properties such as
`--vscode-markdownAlert-note.foreground`; CSS must escape the dot and retain the
normalized hyphen form as a compatibility fallback.

Mermaid is absent from both Extension Host bundles. The small preview runtime
dynamically imports `dist/preview/mermaid-runtime.js` only after finding an
exact Mermaid block. The renderer uses strict security, derives colors from
VS Code variables, and restores escaped source on every failure path. Mermaid
fills and borders use configurable percentage shifts from the editor background
toward the theme's link accent or editor foreground. High-contrast themes use
VS Code's contrast border when available. Rendered diagrams are produced in
detached staging elements and committed only when the block's source revision is
still current. Serialized rendering therefore cannot let an older success or
failure overwrite a same-block live edit. Final controller disposal invalidates
queued work before removing owned navigation and viewer controls. Diagrams
remain passive in the document so they do not capture preview scrolling. A
preview-owned near-viewport dialog provides dedicated zoom and pan interaction,
refreshes its SVG clone after theme or source rerenders, and rewrites cloned SVG
IDs so Mermaid markers and gradients stay local to the dialog. Rewrites must
cover selectors and `url(#id)` references inside embedded `<style>` elements as
well as `url(#id)`, ARIA references, and other ID-bearing attributes.

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

VSCE accepts only `ui` and `workspace` in `extensionKind`; web-host eligibility
comes from the manifest's `browser` entry point rather than a synthetic `web`
extension kind.

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

JavaScript compatibility files are kept as thin discovery shims when an
external tool cannot discover `.mts`. `@vscode/test-cli` 0.0.15 discovers
`.vscode-test.mjs`, while Semantic Release discovers `release.config.mjs`.
Reusable host and release policy remains in strictly checked `.mts` helpers
rather than either compatibility file.

TypeScript 7's default package export does not expose the legacy compiler API.
Repository tooling must use CLI `tsc` invocations and parse strict JSON directly
instead of importing `typescript` for JSONC helpers.

## Release Boundary

The tracked extension version is the development placeholder `0.0.0`.
Semantic Release owns version selection from squash commit messages and passes
the selected version to the repository's VSCE packaging helper; it does not
edit or commit the manifest. Release preparation runs after all source and host
gates, injects the version only into the VSIX, checks the complete archive and
transient current-release changelog, and produces a SHA-256 file.

Visual Studio Marketplace, Open VSX, and GitHub Release publication are
independent consumers of that one immutable artifact. Publisher jobs never
rebuild it and receive only their own credential. GitHub Releases are the
cumulative changelog authority; see [Releases](releases.md) for operational
policy and recovery.

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

The automated release contract is recorded in
`docs/plans/004-semantic-release-automation.md`.
