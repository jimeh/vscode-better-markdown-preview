# Testing and Validation

## Feedback Tiers

Use the narrowest task that proves the behavior under development:

- `mise run test` runs typed Node contracts plus focused parser and preview DOM
  tests without coverage instrumentation.
- `mise run test:coverage` measures every owned executable `src/**/*.ts` file,
  including files no test imports, with V8 coverage.
- `mise run build` compiles production desktop, web, preview runtime, Mermaid,
  and CSS bundles.
- `mise run test:hosts:prepare` builds production artifacts plus the desktop and
  browser host runners once for the current revision.
- `mise run test:desktop:floor` and `mise run test:desktop:stable` consume those
  prepared artifacts in VS Code 1.125.0 and current stable respectively.
- `mise run test:web:stable` consumes the prepared browser bundle in current
  stable VS Code for the Web under headless Chromium.
- `mise run package:validate` produces a VSIX and asserts its exact runtime
  contents.
- `mise run ci:workflows` validates workflow syntax, security, and action pins.

`mise run check` is the fast handoff gate: formatting, lint, all TypeScript
projects, Node contracts, and coverage. `mise run validate` adds the package and
workflow contracts. `mise run verify` prepares one revision and then runs the
desktop floor, desktop stable, and web stable consumers; it is the local gate
for an intended final revision.

On a headless Linux host, the desktop helper uses `xvfb-run`; on macOS, Windows,
or a Linux desktop it launches the test CLI directly. The first desktop run may
download VS Code into `.vscode-test/`. The first web run downloads stable VS
Code for the Web into `.vscode-test-web/`; pnpm's reviewed
`@playwright/browser-chromium` build installs the matching Chromium binary.

## Coverage Policy

Vitest's V8 provider includes all executable `src/**/*.ts` source, not merely
files imported by the suite. Test files, `src/test/` host harnesses, and
declaration-only `src/types/` files are the only source exclusions. Reports are
written as terminal text, JSON summary, and LCOV under ignored `coverage/`.

Global and per-file minimums are 90% statements, functions, and lines and 75%
branches. These rounded floors reflect the focused suite's current honest
coverage; they are not auto-updated. Raise them only after adding useful
behavioral evidence, and do not exclude production files or add execution-only
tests to satisfy the gate.

## Adding Behavior

Material Markdown parsing and preview lifecycle behavior should have focused
fixtures for successful, failure, boundary, and regression cases. Prefer a
test-first failure at the intended assertion, and confirm the runner reports
the new test by name or count.

Presentation-only changes should additionally be exercised in a real VS Code
preview across light, dark, and high-contrast themes. Record manual or visual
evidence when automated assertions would not meaningfully prove the result.

The parser suite lives beside `src/markdown/compose.ts`; its GFM boundary cases
cover native linkification both enabled and disabled, including VS Code's
`fuzzyLink: false` configuration. The DOM suite uses a controlled browser DOM
and Mermaid adapter to cover conditional loading, loader and render failure
fallback, theme rerender and defaults, reused Mermaid blocks, body replacement,
TOC focus behavior, Mermaid viewer zoom/pan/focus, SVG sizing and clone
isolation, and source-preserving highlighted code presentation.

Configuration tests assert the exact manifest keys, boolean defaults, window
scope, typed host reads, change filtering, reload command, and disposable
registration. Parser tests render the default feature set and then disable each
feature independently, retaining tag filtering and checking Mermaid/rich-fence
independence. DOM tests exercise marker defaults and live updates across reused
nodes and replaced Markdown bodies, including complete cleanup when the TOC,
smooth scrolling, or Mermaid viewer is disabled. Presentation contracts pin the
Mermaid backdrop opacity and the reduced-motion override. Navigation tests keep
the smooth-scroll class limited to owned TOC link activation and require
next-frame or bounded-fallback cleanup.

`test/fixtures/kitchen-sink.md` remains the shared manual/runtime document for
light, dark, high-contrast, wide, and narrow preview checks.

## Host Compatibility Contract

Desktop and web integration share the browser-safe fixture and semantic
assertions in `src/test/render-contract.ts`. Both activate the development
extension and render with `markdown.api.render`; neither constructs its own
Markdown-It instance. The contract covers default-on task lists, definitions, footnotes,
known alerts, GFM literal links with native `fuzzyLink: false`, tag filtering,
expanded and highlighted TOML/YAML frontmatter, columns, exact Mermaid fences,
rich fence delegation, several
extension-owned output markers, and native source-map attributes. The host
matrix also changes a representative parser setting and preview-only setting,
waits for the real Markdown plugin reload, verifies disabled output, then resets
both settings and verifies default rendering returns.

Detailed syntax and DOM edge cases stay in fast tests. Host tests prove real
contribution discovery and compatibility without duplicating the unit suite.
The direct `markdown-it` dependency is only a deterministic development/test
fixture. When stable changes Markdown-It major versions, diagnose the stable
host contract first, preserve the declared 1.125.0 floor, then update the local
fixture and focused expectations only for accepted compatibility behavior.

## CI

CI has one broad validation and preparation owner. It runs formatting, lint,
strict product/desktop/web/tooling typechecks, Node contracts, all-files unit
coverage, package inventory, and workflow policy once, then uploads `dist/` and
`out/` for revision-bound host jobs. Desktop floor, desktop stable, and web
stable jobs install only their runtime dependencies, download those prepared
artifacts, and run their narrow compatibility consumer.

This gives clean-environment evidence for the pushed revision without running
the complete repository gate in every host job.
