# Bootstrap Foundation Plan

## Objective

Create a generated, agent-ready foundation for Better Markdown Preview without
implementing Markdown rendering behavior. The result must be independently
reviewable, packageable as a VS Code extension, and suitable as the base for the
feature implementation pull request.

## Constraints

- Bootstrap with the official Yeoman VS Code extension generator; do not
  hand-author the baseline extension structure.
- Use TypeScript, pnpm, and esbuild.
- Keep the generated extension entry point behavior-free after removing the
  sample command.
- Establish desktop and web-extension build targets without adding Markdown
  preview contribution points yet.
- Pin development runtimes through mise and expose stable, described tasks.
- Use a seven-day pnpm dependency-age gate and a committed lockfile.
- Keep GitHub Actions permissions restricted and third-party actions pinned to
  full commit SHAs.
- License the project under MIT.

## Expected Scope

- Generated VS Code extension manifest, TypeScript entry point, compiler and
  esbuild configuration, launch/tasks configuration, and package scripts.
- pnpm workspace policy and lockfile.
- Formatting, linting, typechecking, unit/extension smoke testing, packaging,
  and workflow validation.
- `mise.toml` task surface for `setup`, `dev`, `build`, `format`,
  `format:check`, `lint`, `lint:fix`, `typecheck`, `check`, `test`,
  `test:extension`, `package`, `verify`, `doctor`, and `clean`.
- Restricted, SHA-pinned GitHub Actions CI that maps to local tasks.
- Concise repository map and architecture/testing documentation.
- VSIX content validation that catches missing desktop or web bundles.

## Success Criteria

- A fresh clone can install all pinned tools and dependencies through
  `mise run setup`.
- The extension compiles for desktop and web without product behavior.
- The test runner confirms the extension can activate in a VS Code host.
- The produced VSIX contains the manifest and both runtime bundles, and excludes
  source, tests, and development-only files.
- `mise run check` is a fast local handoff gate.
- `mise run verify` is the intended-final-head local gate and passes.
- CI runs the same locked install and verification surface on the pushed head.

## Non-goals

- Markdown-It plugins or Markdown preview contribution points.
- Preview CSS or JavaScript.
- GFM, alerts, footnotes, definition lists, frontmatter, columns, Mermaid, TOC,
  rich code-fence presentation, or theme behavior.
- Marketplace publishing, release automation, or extension installation.
- Backfilling visual or renderer fixtures before rendering behavior exists.

## Risks

- The generator may emit obsolete sample commands or tooling. Preserve the
  generated structural baseline while removing sample behavior and replacing
  only tooling that cannot meet the frozen task contract.
- Desktop-only imports can silently break the web bundle. Build both targets and
  inspect the packaged manifest and files.
- An Extension Host smoke test can pass without loading the packaged artifact.
  Pair it with direct VSIX content validation.
- Workflow checks can drift from CI. Make CI invoke the same mise tasks used
  locally and validate workflow syntax and action pins.

## Closure Matrix

| Observable or risk | Evidence |
| --- | --- |
| Official tooling produced the baseline | Generator command recorded in implementation evidence and generated structure inspected |
| Desktop bundle is valid | `mise run build` and VSIX content assertion |
| Web bundle is valid | `mise run build` and VSIX content assertion |
| Extension activates | Named Extension Host smoke test through `mise run test:extension` |
| Type errors fail locally | `mise run typecheck` |
| Formatting and lint drift fail locally | `mise run check` |
| Locked, cooled dependency intake | Manifest inspection plus frozen install in CI |
| Workflow syntax, security, and pins remain valid | `mise run ci:workflows` |
| Published archive omits development files | Named package-content test against the generated VSIX |
| Fresh-environment broad gate | GitHub Actions `mise run verify` on the final pushed head |

## Evidence Ownership

- Implementer: generator transcript, focused build/tests, named test counts, and
  package-content evidence.
- Orchestrator: scope inspection, closure-matrix sufficiency, and missing focused
  checks only.
- Reviewers: requirement, architecture, and test-quality inspection.
- CI: locked clean-environment verification on the intended final head.

