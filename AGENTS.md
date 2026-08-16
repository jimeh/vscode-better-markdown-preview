# Better Markdown Preview Agent Guide

Better Markdown Preview extends VS Code's built-in Markdown preview through its
supported Markdown extension hooks. Preserve the native preview rather than
replacing it with a custom webview.

## Change Routes

| Change                                | Read first                                                                                                                            | Start validation with                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Markdown parsing or settings          | [`docs/architecture.md`](docs/architecture.md#rendering-boundary) and [`docs/testing.md`](docs/testing.md#adding-a-rendering-feature) | Focused parser/configuration tests, then `mise run check`             |
| Preview DOM behavior or CSS           | [`docs/architecture.md`](docs/architecture.md#preview-boundary) and [`docs/testing.md`](docs/testing.md#adding-behavior)              | Focused DOM/presentation tests plus real-preview evidence when visual |
| Desktop or web host compatibility     | [`docs/testing.md`](docs/testing.md#host-compatibility-contract)                                                                      | Prepare once, then run the narrow host consumer                       |
| Build, package, or release automation | [`docs/architecture.md`](docs/architecture.md#tooling-boundary) and [`docs/releases.md`](docs/releases.md)                            | Relevant contract, package, or workflow task                          |

For a setting-backed rendering feature, trace an adjacent feature end to end;
`rg -n 'rendering\.columns'` exposes the manifest, typed configuration, parser,
tests, host contract, and documentation surfaces. Plans under `docs/plans/`
record accepted intent but are not proof that later phases shipped.

## Project Map

- `src/extension.ts`: shared, browser-safe extension lifecycle entry point.
- `src/markdown/`: Markdown-It composition and focused parser tests.
- `src/preview/`: idempotent browser runtime, Mermaid adapter, and DOM tests.
- `media/preview.css`: theme-aware contributed preview styles.
- `src/test/`: real desktop and web Extension Host contracts.
- `test/`: fast manifest, tooling, workflow, and packaged-artifact contracts.
- `scripts/`: small cross-platform harness and release helpers.
- `esbuild.mts`: paired desktop/web bundles plus preview and test targets.
- `mise.toml`: canonical tool versions and discoverable task surface.

## Repository Rules

- Use pnpm, not npm or yarn. Keep `pnpm-lock.yaml` authoritative and install
  with `--frozen-lockfile` outside intentional dependency updates.
- Keep shared extension code browser-safe unless desktop and web entry points
  are deliberately split. Building both targets is an architectural check.
- Treat `package.json` contribution points as public product behavior. Update
  their contracts and user documentation when they change intentionally.
- Generated output belongs in `dist/`, `out/`, `artifacts/`, `coverage/`,
  `.vscode-test/`, or `.vscode-test-web/` and must stay untracked.
- Use focused tasks while iterating, `mise run check` for the fast handoff gate,
  and `mise run verify` on an intended final head.
- Oxfmt owns source, configuration, documentation, and CSS formatting; Taplo
  owns `mise.toml` formatting.

## Dependencies and Automation

- Keep Mise tool selectors at the major version and commit exact
  multi-platform resolutions in `mise.lock`. Use `mise lock --bump` to refresh
  compatible tools.
- New package releases cool down for three days. For an urgent reviewed
  security fix, add only the exact package to `minimumReleaseAgeExclude`, update
  the lockfile, and remove the exception once the release ages in.
- Dependency install scripts are denied unless `allowBuilds` grants the package
  explicitly. Replace pnpm's placeholder decisions with reviewed booleans.
- GitHub Actions must declare restricted permissions and pin every action to a
  full commit SHA. `mise run ci:workflows` checks syntax, security, and pins.
