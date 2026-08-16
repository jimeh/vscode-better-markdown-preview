# Better Markdown Preview Agent Guide

## Start Here

Better Markdown Preview extends VS Code's built-in Markdown preview. Read
`docs/architecture.md` before changing extension boundaries and
`docs/testing.md` before choosing validation.

## Project Map

- `src/extension.ts`: shared, browser-safe extension lifecycle entry point.
- `src/markdown/`: Markdown-It composition and focused parser tests.
- `src/preview/`: idempotent browser runtime, local Mermaid adapter, and DOM
  lifecycle tests.
- `media/preview.css`: source for the theme-aware contributed preview style.
- `src/test/render-contract.ts`: browser-safe host rendering contract shared by
  desktop and web tests.
- `src/test/desktop/`: tests executed in real desktop Extension Hosts.
- `src/test/web/`: bundled runner executed in stable VS Code for the Web.
- `test/`: fast manifest and packaged-artifact contract tests.
- `scripts/`: small cross-platform harness helpers.
- `docs/plans/`: accepted implementation contracts; do not treat them as
  proof that later phases shipped.
- `esbuild.mts`: paired desktop and web bundles plus the web test runner.
- `mise.toml`: canonical tool versions and task surface.

## Working Rules

- Use pnpm, not npm or yarn. Keep `pnpm-lock.yaml` authoritative and install
  with `--frozen-lockfile` outside intentional dependency updates.
- Keep extension code browser-safe unless desktop and web entry points are
  deliberately split. Building both targets is an architectural check.
- Treat `package.json` contribution points as public product behavior. Update
  manifest tests whenever contributions change intentionally.
- Keep preview enhancements inside VS Code's supported Markdown extension
  hooks; do not replace the built-in preview with a custom webview.
- Generated output belongs in `dist/`, `out/`, `artifacts/`, `coverage/`,
  `.vscode-test/`, or `.vscode-test-web/` and must stay untracked.
- `.vscode-test/` and `.vscode-test-web/` contain downloaded VS Code/browser
  distributions, including their own tool configs. Keep them excluded from
  repository-wide format and lint discovery.
- Native preview typography uses `--markdown-font-size` and
  `--markdown-line-height` (without a `--vscode-` prefix). VS Code 1.125 injects
  Markdown alert IDs as custom properties such as
  `--vscode-markdownAlert-note.foreground`; escape the dot in CSS and retain
  the normalized hyphen form as a compatibility fallback.
- Airplan column closing delimiters allow trailing horizontal whitespace;
  container-looking lines inside backtick or tilde fences are code, not nested
  column syntax.
- VS Code 1.125 configures its supplied Markdown-It's linkifier with
  `fuzzyLink: false` and reapplies per-render options after contributed plugins.
  The extension's narrow post-native pass must therefore fill missing GFM HTTP,
  HTTPS, email, and `www.` literals without mutating `md.options.linkify`.
- VS Code 1.125 collapses backslash-escaped punctuation into plain inline text
  before contributed core rules run. When the resulting token is identical to
  authored text (for example `www\.example.com` versus `www.example.com`), do
  not guess at raw-source offsets in a core rule; preserve source maps and record
  the native-host limitation instead.
- VS Code installs its `front_matter` YAML block rule after contributed
  Markdown-It plugins, immediately before `fence`. A contributed YAML rule
  inserted before `fence` therefore runs first when enabled; omitting it cleanly
  delegates back to VS Code's `markdown.preview.frontMatter` behavior.
- VS Code's source-map core rule adds `data-line`, `code-line`, and `dir` attrs
  to mapped non-inline tokens before rendering. Owned block renderers must emit
  `renderer.renderAttrs(token)` on the real wrapper; `html_block` attrs otherwise
  land on a separate empty mapping element.
- Same-document preview edits can reuse Mermaid `<pre>` nodes, while a preview
  retarget replaces `.markdown-body` itself. DOM lifecycle code must handle both
  shapes without retaining stale source or TOC state.
- Desktop host test settings under `.vscode-test/user-data` persist across
  invocations. Tests that change global configuration must establish their own
  defaults and restore previous values in `finally`.
- Mermaid scopes embedded SVG styles to generated element IDs. Any cloned SVG
  ID rewrite must update CSS selectors inside `<style>` elements as well as
  attributes such as `url(#id)` and ARIA ID references.
- Use `mise run check` during implementation and `mise run verify` on the
  intended final head. Run focused tasks while iterating.
- Oxlint's type-aware project discovery only associates files with the root
  conventionally named `tsconfig.json`; keep its type-aware task scoped to that
  product program. The four explicit TypeScript 7 projects remain the
  authoritative full-repository typecheck.
- TypeScript 7's default package export does not provide the legacy compiler
  API. Keep repository tooling on CLI `tsc` invocations and parse strict JSON
  directly instead of importing `typescript` for JSONC helpers.
- Oxfmt owns source, configuration, documentation, and CSS formatting, but
  `mise.toml` remains excluded because Taplo is the canonical TOML formatter.

## Dependencies and Automation

Keep Mise tool selectors at the major version and commit the exact multi-platform
resolutions in `mise.lock`. Use `mise lock --bump` to refresh compatible tools.

New package releases cool down for three days before pnpm resolves them. For an
urgent reviewed security fix, add only the exact package to
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`, update the lockfile, and
remove the exception once the release ages in.

Dependency install scripts are denied unless `allowBuilds` grants the package
explicitly. Pnpm may add placeholder decisions for newly encountered build
scripts; replace each placeholder with a reviewed boolean before handoff.

VSCE normalizes packaged README and changelog paths to lowercase and renames the
license to `LICENSE.txt`. Package-content assertions should target the archive's
normalized names, not the source filenames.

VSCE accepts only `ui` and `workspace` in `extensionKind`. Web-host eligibility
comes from the manifest's `browser` entry point; do not add a synthetic `web`
extension kind.

`@semantic-release/release-notes-generator` 14.1.1 is compatible with
`conventional-changelog-conventionalcommits` 9.3.1. Version 10 uses a newer
writer contract and silently produced release headings without commit entries;
retain the executable release-notes contract when upgrading either package.

VSCE's positional package version calls `npm version` unless both
`--no-git-tag-version` and `--no-update-package-json` are supplied. Release
packaging must keep those flags because Semantic Release has already modified
the transient changelog and the tracked manifest must stay at `0.0.0`.

GitHub Actions must declare restricted permissions and pin every action to a
full commit SHA. `mise run ci:workflows` enforces syntax, security posture, and
pin freshness.
