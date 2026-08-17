# Testing and Validation

## Feedback Tiers

Use the narrowest task that proves the behavior under development:

- `mise run test` runs typed Node contracts plus focused parser and preview DOM
  tests without coverage instrumentation.
- `mise run test:coverage` measures every owned executable `src/**/*.ts` file,
  including files no test imports, with V8 coverage.
- `mise run build` compiles production desktop, web, preview runtime, Mermaid,
  and CSS bundles.
- `mise run test:preview-browser` builds and loads the actual preview bundles in
  real Chromium, including the relative Mermaid dynamic import.
- `mise run test:hosts:prepare` builds production artifacts plus the desktop and
  browser host runners once for the current revision.
- `mise run test:desktop:floor` and `mise run test:desktop:stable` consume those
  prepared artifacts in VS Code 1.125.0 and current stable respectively.
- `mise run test:web:stable` consumes the prepared browser bundle in current
  stable VS Code for the Web under headless Chromium.
- `mise run package:validate` produces a VSIX and asserts its exact runtime
  contents.
- `mise run release:check` exercises semantic version selection, release-note
  visibility, runner outputs, and workflow orchestration without publishing.
- `mise run ci:workflows` validates workflow syntax, security, and action pins.

Code quality has distinct, complementary owners. Oxlint runs fast native checks
across every JavaScript and TypeScript file plus type-aware rules over the
product program owned by the root `tsconfig.json`. TypeScript 7 remains the
authoritative compiler gate for the product, desktop tests, web tests, and
tooling projects. Stylelint checks CSS semantics; Oxfmt owns formatting for CSS,
JavaScript, TypeScript, JSON, Markdown, and YAML, while Taplo remains the TOML
formatter.

Oxlint's type-aware discovery associates files only with the conventionally
named root `tsconfig.json`; the type-aware task is therefore scoped to that
product program while the four explicit TypeScript projects remain the
authoritative repository typecheck. Oxfmt exits with an error when every
explicit path is ignored, so Lefthook's staged-format exclusions must stay
aligned with `.oxfmtrc.json`. Keep downloaded `.vscode-test/` and
`.vscode-test-web/` distributions outside repository-wide format and lint
discovery because they contain their own tool configurations.

`mise run setup` also installs Lefthook. Its read-only parallel pre-commit jobs
check Oxfmt, Taplo, and lint only against matching staged files, then
conditionally run the fast type-aware product lint, full TypeScript typecheck,
unit suite, and Node contracts when relevant source, configuration, or
dependency files are staged. Longer host and package checks remain explicit
Mise and CI gates.

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
independence. Terraform callout tests cover all three presentation mappings,
paragraph and indentation boundaries, inline Markdown, Registry-compatible
escaping, blockquote nesting, list exclusion, code and table exclusions, and
independence from GitHub alerts. Emoji parser tests cover named shortcodes,
opt-in emoticon shortcuts, their master-setting dependency, code exclusions,
escaping, unknown names, and link boundaries. DOM tests exercise marker defaults and live updates across reused
nodes and replaced Markdown bodies, including complete cleanup when the TOC,
smooth scrolling, or Mermaid viewer is disabled. Presentation contracts pin the
Mermaid backdrop opacity and the reduced-motion override. Navigation tests keep
the smooth-scroll class limited to owned TOC link activation and require
next-frame or bounded-fallback cleanup.

`test/fixtures/kitchen-sink.md` remains the shared manual/runtime document for
light, dark, high-contrast, wide, and narrow preview checks.

### Real Preview Visual Check

Use the real Extension Development Host for presentation changes that cannot be
proved by DOM or browser contracts alone:

1. Run `mise run setup`, open the repository in VS Code, and launch **Run Better
   Markdown Preview** from Run and Debug. Its pre-launch task starts the desktop,
   web, preview, Mermaid, CSS, and TypeScript watchers.
2. In the Extension Development Host, open `test/fixtures/kitchen-sink.md` and
   run **Markdown: Open Preview to the Side**.
3. Inspect the built-in **Default Light Modern**, **Default Dark Modern**, and
   **Default High Contrast** themes. Check text, links, alerts, tables, code
   annotations, Mermaid fills and borders, focus indicators, and user-style
   precedence relevant to the change.
4. Resize the preview through the responsive boundaries. Above `64rem` (roughly
   1024 px at the default root font size), the persistent table of contents is
   visible. At or below `64rem`, it becomes a trigger and bottom dialog. At or
   below `44rem` (roughly 704 px), columns stack and the Mermaid viewer uses its
   compact layout.
5. Exercise affected interaction with keyboard and pointer input. For navigation
   or animation changes, also enable reduced motion. Open **Developer: Toggle
   Developer Tools** in the Extension Development Host and require no relevant
   console errors or unhandled rejections.
6. Record the VS Code version, themes, viewport states, and interactions checked.
   Attach screenshots or recorded DOM/computed-style evidence when appearance is
   part of the acceptance criteria.

### Adding a Rendering Feature

Trace an adjacent setting before editing; for example,
`rg -n 'rendering\.columns'` reveals the existing public, runtime, test, host,
and documentation contracts. Then:

1. Declare the public setting and add its typed key, default, and host read.
2. Install or intercept syntax only while the feature is enabled. Disabling a
   rendering feature must leave VS Code and other Markdown extensions free to
   handle it.
3. Add focused success, failure, boundary, regression, and isolated-disable
   coverage justified by the feature's concrete failure modes. Inline prose
   transformations must explicitly preserve code, HTML, existing links, and
   autolinks when those boundaries apply.
4. Update the shared host contract when correctness depends on VS Code's
   supplied Markdown-It, plugin ordering, renderer, source maps, or live
   configuration reload. Keep detailed syntax permutations in fast tests.
5. Update the README setting reference and the kitchen-sink fixture when the
   behavior is user-visible. Configuration contracts keep the manifest,
   runtime keys, and README reference aligned.
6. For new packages, follow the release-age and `allowBuilds` policy, keep
   runtime code browser-safe, and build both extension targets.

## Host Compatibility Contract

Desktop and web integration share the browser-safe fixture and semantic
assertions in `src/test/render-contract.ts`. Both activate the development
extension and render with `markdown.api.render`; neither constructs its own
Markdown-It instance. The contract covers default-on task lists, definitions,
footnotes, known alerts, named emoji shortcodes, GFM literal links with native
`fuzzyLink: false`, tag filtering, expanded and highlighted TOML/YAML
frontmatter, columns, exact Mermaid fences, rich fence delegation, several
extension-owned output markers, and native source-map attributes. The host
matrix also changes a representative parser setting and preview-only setting,
including the emoji master/shortcut dependency, waits for the real Markdown
plugin reload, verifies disabled output, then resets the settings and verifies
default rendering returns.

Desktop host settings under `.vscode-test/user-data` persist across invocations.
Tests that change global configuration must establish their own starting
defaults and restore every prior value in `finally`. When independent restores
use `Promise.allSettled`, inspect every rejected result after all restores have
settled. Report restoration failures while preserving an earlier test failure
as the primary error.

Detailed syntax and DOM edge cases stay in fast tests. Host tests prove real
contribution discovery and compatibility without duplicating the unit suite.
The direct `markdown-it` dependency is only a deterministic development/test
fixture. When stable changes Markdown-It major versions, diagnose the stable
host contract first, preserve the declared 1.125.0 floor, then update the local
fixture and focused expectations only for accepted compatibility behavior.

## Preview Browser Contract

The preview browser contract serves a VS Code-shaped fixture and the production
`dist/preview` assets over loopback. It exercises the actual `preview.js`, CSS,
and relative Mermaid chunk in repository-managed Chromium under a restrictive
fixture CSP. Scripts are same-origin only; `unsafe-inline` is limited to styles
because the fixture and Mermaid output deliberately use inline style values. It
covers TOC and code enhancement, Markdown body replacement, Mermaid rendering
and theme rerendering, dialog behavior, focus restoration, console errors, and
unhandled promise rejections.

This is real browser evidence for the contributed assets, not privileged
introspection of VS Code's native preview webview. VS Code contribution
discovery and host-supplied Markdown rendering remain owned by the desktop and
web Extension Host contracts. Fine-grained disposal and reinitialization remain
covered by the focused DOM lifecycle tests because the contributed entry point
intentionally does not publish a controller handle to the page.

## CI

CI has one broad validation and preparation owner with individually named
formatting, lint, TypeScript, Node contract, unit coverage, package inventory,
and workflow-policy steps, then uploads `dist/` and `out/` for revision-bound
host jobs. Desktop floor, desktop stable, and web stable jobs install only their
runtime dependencies, download those prepared artifacts, and run their narrow
compatibility consumer.

This gives clean-environment evidence for the pushed revision without running
the complete repository gate in every host job.

On a `main` push, Semantic Release runs only after all three host jobs pass.
Release preparation then supplies the calculated version to VSCE, reuses the
exact package inventory contract, checks the generated current-release
changelog, and verifies the checksum. Publication jobs download that one
revision-bound artifact and independently publish it to both extension
registries and the matching GitHub Release.
