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
- `src/test/`: tests executed in a real VS Code Extension Host.
- `test/`: fast manifest and packaged-artifact contract tests.
- `scripts/`: small cross-platform harness helpers.
- `docs/plans/`: accepted implementation contracts; do not treat them as
  proof that later phases shipped.
- `esbuild.js`: paired desktop and web bundles.
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
- Generated output belongs in `dist/`, `out/`, `artifacts/`, or `.vscode-test/`
  and must stay untracked.
- `.vscode-test/` contains a complete downloaded VS Code distribution, including
  its own tool configs. Keep it excluded from repository-wide format and lint
  discovery.
- Native preview typography uses `--markdown-font-size` and
  `--markdown-line-height` (without a `--vscode-` prefix). VS Code 1.125 injects
  Markdown alert IDs as custom properties such as
  `--vscode-markdownAlert-note.foreground`; escape the dot in CSS and retain
  the normalized hyphen form as a compatibility fallback.
- Airplan column closing delimiters allow trailing horizontal whitespace;
  container-looking lines inside backtick or tilde fences are code, not nested
  column syntax.
- VS Code 1.125 configures its supplied Markdown-It's linkifier with
  `fuzzyLink: false`; enabling the native linkify rule covers schemes and email,
  but GFM `www.` literals need the extension's narrow linkify pass.
- VS Code 1.125 collapses backslash-escaped punctuation into plain inline text
  before contributed core rules run. When the resulting token is identical to
  authored text (for example `www\.example.com` versus `www.example.com`), do
  not guess at raw-source offsets in a core rule; preserve source maps and record
  the native-host limitation instead.
- VS Code's source-map core rule adds `data-line`, `code-line`, and `dir` attrs
  to mapped non-inline tokens before rendering. Owned block renderers must emit
  `renderer.renderAttrs(token)` on the real wrapper; `html_block` attrs otherwise
  land on a separate empty mapping element.
- Same-document preview edits can reuse Mermaid `<pre>` nodes, while a preview
  retarget replaces `.markdown-body` itself. DOM lifecycle code must handle both
  shapes without retaining stale source or TOC state.
- Use `mise run check` during implementation and `mise run verify` on the
  intended final head. Run focused tasks while iterating.

## Dependencies and Automation

New package releases cool down for seven days before pnpm resolves them. For an
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

GitHub Actions must declare restricted permissions and pin every action to a
full commit SHA. `mise run ci:workflows` enforces syntax, security posture, and
pin freshness.
