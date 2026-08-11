# Testing and Validation

## Feedback Tiers

Use the narrowest task that proves the behavior under development:

- `mise run test` checks manifest contracts plus focused parser and preview DOM
  behavior.
- `mise run build` compiles production desktop, web, preview runtime, Mermaid,
  and CSS bundles.
- `mise run test:extension` compiles tests, builds both targets, and runs the
  named activation smoke test on the declared VS Code engine floor.
- `mise run package:validate` produces a VSIX and asserts its exact runtime
  contents.
- `mise run ci:workflows` validates workflow syntax, security, and action pins.

`mise run check` is the fast handoff gate. `mise run verify` runs all of the
above sequentially and is the local gate for an intended final revision.

On a headless Linux host, the Extension Host helper uses `xvfb-run`; on macOS,
Windows, or a Linux desktop it launches the test CLI directly. The first run
may download VS Code 1.125.0 into `.vscode-test/`.

## Adding Behavior

Material Markdown parsing and preview lifecycle behavior should have focused
fixtures for successful, failure, boundary, and regression cases. Prefer a
test-first failure at the intended assertion, and confirm the runner reports
the new test by name or count.

Presentation-only changes should additionally be exercised in a real VS Code
preview across light, dark, and high-contrast themes. Record manual or visual
evidence when automated assertions would not meaningfully prove the result.

The parser suite lives beside `src/markdown/compose.ts` and renders with native
linkification disabled so extension-owned autolinks are explicit. The DOM suite
uses a controlled browser DOM and Mermaid adapter to cover conditional loading,
failure fallback, theme rerender, body replacement, TOC focus behavior, and
source-preserving code presentation. These focused suites do not replace the
real Extension Host activation test or runtime presentation inspection.

`test/fixtures/kitchen-sink.md` is the shared manual/runtime document for light,
dark, high-contrast, wide, and narrow preview checks.

## CI

CI installs the exact mise-managed tools, performs a frozen pnpm install, and
runs `mise run verify`. It supplies clean-environment evidence for the pushed
revision; it does not replace focused local evidence gathered while building a
feature.
