# Test Hardening and TypeScript Tooling Plan

## Objective

Make the repository safe to use as the validation foundation for later
unattended dependency and release automation. Exercise Better Markdown Preview
through the Markdown engine supplied by supported VS Code hosts, execute the web
extension in a real browser host, enforce meaningful source coverage, and bring
repo-owned Node tooling and tests under TypeScript checking wherever the tools
support it.

## Settled Decisions

- Preserve the native VS Code Markdown preview architecture and the shared,
  browser-safe extension entry point.
- The declared VS Code engine floor remains `1.125.0`.
- Desktop integration owns compatibility with both the engine floor and current
  stable VS Code.
- Web integration runs current stable VS Code for the Web in Chromium.
  `@vscode/test-web` does not support selecting the historical engine floor by
  semantic version, so the web job does not duplicate the desktop floor check.
- Host integration renders through `markdown.api.render`; directly passing a
  project-created Markdown-It instance to `extendMarkdownIt` remains unit-test
  evidence only.
- Convert repo-owned JavaScript tooling, configuration, helpers, and Node tests
  to TypeScript using explicit ESM `.mts` files where supported.
- Retain `.vscode-test.mjs` because the installed `@vscode/test-cli` supports
  `.json`, `.js`, `.cjs`, and `.mjs` configuration, but not `.mts`. Do not
  replace a legitimate JavaScript compatibility file with JSON merely to remove
  the extension. Any additional exception requires equivalent tool evidence.
- Node's native type stripping is an execution mechanism, not a type checker.
  A strict tooling TypeScript project must cover every migrated file.
- Coverage thresholds must measure all owned executable TypeScript source,
  include unimported files, apply per-file as well as global floors, and exclude
  only reviewed test, declaration, and generated code.
- Keep detailed syntax and DOM edge cases in fast tests. Host tests prove
  contribution discovery and compatibility without copying the full unit suite.
- Keep `mise run verify` as the intended-final-head local gate. CI may split
  evidence into jobs, but must not repeat broad validation in every host job.

## Expected Scope

### TypeScript tooling and tests

- Rename `esbuild.js`, supported tool configs, `scripts/**/*.mjs`, and
  `test/**/*.mjs` to `.mts`.
- Update package scripts, Mise tasks, VS Code tasks, imports, lint and format
  discovery, ignore rules, and contract assertions for the new paths.
- Add a strict Node/tooling tsconfig using NodeNext module semantics, `noEmit`,
  native-Node-compatible erasable syntax, and explicit TypeScript extensions.
- Make the main typecheck task cover both product source and Node tooling.
- Replace source-text harness assertions with typed behavioral contracts when a
  small exported helper can expose the behavior without coupling tests to file
  formatting.
- Keep `.vscode-test.mjs` minimal and type-aware where practical; put reusable
  argument and version-selection logic in typed code.

### Unit coverage and focused gaps

- Add the matching `@vitest/coverage-v8` package and a durable coverage task.
- Configure text and machine-readable output under ignored `coverage/`.
- Measure all executable `src/**/*.ts`, including files not imported by a test;
  exclude test files, declarations, and generated output only.
- Establish honest global and per-file thresholds after the focused additions.
  Round thresholds enough to avoid fractional churn, do not auto-update them,
  and do not add broad exclusions merely to make the gate pass.
- Add focused Mermaid adapter coverage for initialization, strict security,
  theme mapping, unique render IDs, SVG insertion, optional bind callbacks, and
  failure propagation.
- Use the coverage report to close material preview-runtime gaps, including
  loader failure, malformed or reversed line sets, SVG size fallbacks, dialog
  cleanup and fallback paths, theme defaults, and highlighted-code preservation
  where those paths remain meaningfully uncovered.
- Cover the small extension and preview entry points through observable behavior
  rather than excluding them or writing assertions that only execute lines.

### Desktop host integration

- Retain the activation and exported API assertions where useful.
- Render one focused compatibility fixture through:

  ```ts
  vscode.commands.executeCommand<string>('markdown.api.render', source)
  ```

- Share browser-safe fixture and assertion code between desktop and web tests.
- Assert semantic evidence for:
  - task lists, definition lists, footnotes, and known GitHub alerts;
  - HTTP, HTTPS, email, and `www.` literals with the host's `fuzzyLink: false`;
  - GFM tag filtering and TOML frontmatter;
  - columns and exact lowercase Mermaid fences;
  - rich fence metadata and delegation to native fence rendering; and
  - native source-map attributes where the command exposes them.
- Require multiple Better Markdown Preview-owned classes or data attributes so
  the fixture fails when the extension is absent even if native Markdown
  supports part of the syntax.
- Avoid snapshots or exact serialization of incidental host-owned HTML.
- Expose separate floor and stable desktop tasks plus a combined local task.

### Hosted web integration

- Add `@vscode/test-web` and a browser-safe bundled test runner exporting the
  interface expected by the official harness.
- Keep Node built-ins and Node-only assertion libraries out of the web runner.
- Launch headless Chromium against current stable VS Code for the Web with the
  browser extension loaded from the development checkout.
- Render through `markdown.api.render` and reuse the desktop semantic contract.
- Prove that the browser entry point activates and that the built-in Markdown
  extension discovers the contribution; a browser-compatible build alone does
  not satisfy this requirement.

### Tasks, CI, and documentation

- Separate build/test preparation from host execution so desktop floor,
  desktop stable, and web stable consume one prepared revision.
- Run broad format, lint, typecheck, unit/coverage, package, and workflow gates
  once in CI. Share prepared artifacts with narrow host jobs rather than running
  the complete gate in every matrix entry.
- Keep job and task names stable and descriptive enough for later branch
  protection and dependency auto-merge rules.
- Keep package validation authoritative for the exact VSIX runtime inventory.
- Update `docs/architecture.md`, `docs/testing.md`, task descriptions, project
  maps, and ignore rules to record:
  - the direct Markdown-It dependency as a development/test fixture;
  - ownership of floor, stable, and web compatibility;
  - the response when stable adopts a new Markdown-It major;
  - coverage scope and threshold policy; and
  - the justified `.vscode-test.mjs` compatibility exception.

## Observable Success

- Every eligible repo-owned JavaScript file is migrated to checked TypeScript;
  remaining `.mjs` files have a documented tool constraint.
- Native Node 24 executes every migrated script, config, and Node test entry.
- `mise run typecheck` checks product, extension tests, web tests, tooling,
  configuration, and Node contract tests.
- Coverage includes unimported executable source and passes global and per-file
  thresholds without padding or broad exclusions.
- Desktop floor and stable tests render through the real host-supplied
  Markdown-It engine and fail when the extension contribution is absent.
- A real Chromium VS Code web host activates the browser extension and passes
  the shared rendering contract.
- `mise run verify` passes locally on the intended final revision.
- CI passes the same evidence classes on the exact pushed revision without
  duplicating broad validation across host jobs.
- The packaged VSIX still contains only the expected runtime files.

## Important Failure and Boundary Paths

- A host changes Markdown-It major version, option reapplication, plugin order,
  source-map behavior, or native fence rendering.
- The extension activates but its Markdown contribution is not discovered.
- The web bundle is structurally valid but imports a Node-only dependency or is
  not loaded by the web extension host.
- Native Node accepts a `.mts` file at runtime while `tsc` would reject its
  types, imports, or unsupported emitted syntax.
- A tool silently ignores a renamed TypeScript configuration file.
- Mermaid initialization, rendering, or dynamic loading rejects and fallback
  source must remain available.
- A new source module is not imported by tests and would disappear from an
  aggregate-only coverage report.
- Host-owned HTML changes without a corresponding behavioral regression.

## Verification and Closure Matrix

| Observable or risk | Evidence |
| --- | --- |
| Eligible tooling is TypeScript and executable on pinned Node | Tooling typecheck plus direct execution through normal tasks |
| Tool config discovery survives `.mts` migration | Formatter, linter, Vitest, and esbuild tasks execute their real configs |
| `.vscode-test.mjs` remains a justified exception | Installed CLI loader contract plus successful floor/stable runs |
| Parser and DOM behavior remain stable | Named fast Vitest and Node contract tests |
| Coverage includes unimported production source | V8 all-files report plus global and per-file thresholds |
| Mermaid adapter owns secure initialization and fallback behavior | Focused adapter and runtime success/failure tests |
| VS Code discovers the Markdown-It contribution | `markdown.api.render` contract with BMP-owned output markers |
| Declared engine floor remains compatible | Desktop Extension Host test on `1.125.0` |
| Current VS Code remains compatible | Desktop Extension Host test on `stable` |
| Browser entry point executes in a real host | `@vscode/test-web` Chromium test on stable |
| Web runner stays browser-safe | Browser-targeted typecheck/build and real web-host execution |
| Native fence and source-map behavior is preserved | Focused semantic assertions in the host fixture |
| VSIX contents do not drift | Exact packaged-content test |
| Workflow syntax, permissions, and action pins remain valid | `mise run ci:workflows` |
| Complete local final-head gate | `mise run verify` |
| Clean-environment exact-head gate | Required GitHub Actions jobs |

## Risks and Mitigations

- Native TypeScript execution ignores tsconfig settings. Restrict tooling to
  erasable syntax and validate every file with the dedicated tooling project.
- Per-file coverage can encourage low-value branch chasing. Add tests only for
  observable failure modes, set realistic floors from the measured report, and
  leave defensive platform fallbacks documented when automation is not useful.
- Host assertions can become coupled to private HTML. Assert semantic classes,
  attributes, links, and preserved behavior rather than full snapshots.
- Web-host setup can be slower and less stable than unit tests. Keep it to one
  focused contract on stable Chromium and leave detailed behavior in fast tests.
- Sharing built artifacts across CI jobs can hide preparation assumptions.
  Make preparation a named task, validate artifact contents, and keep each host
  consumer narrow and revision-bound.

## Non-goals

- Dependabot configuration, dependency grouping, or automatic merging.
- Semantic-release, tags, changelog generation, Marketplace publishing, Open
  VSX publishing, or GitHub Release automation.
- Raising the VS Code engine floor.
- Required VS Code Insiders testing.
- Replacing the built-in preview or introducing a custom webview.
- Full browser UI automation of preview CSS, dialogs, scrolling, or visual
  appearance. Existing DOM tests and proportionate real-preview visual checks
  remain responsible for those surfaces.
- Tests written solely to reach 100% coverage.

## Implementation Order

1. Migrate eligible tooling/config/tests to `.mts` and establish the tooling
   typecheck project.
2. Add coverage instrumentation, inspect the honest report, and close meaningful
   unit gaps.
3. Add the shared compatibility fixture and replace the desktop smoke with host
   rendering.
4. Add configurable desktop floor/stable execution.
5. Add the bundled stable web-host test.
6. Refactor Mise tasks and CI around one preparation/broad-validation owner and
   narrow host consumers.
7. Update architecture/testing documentation and run the complete final-head
   verification.
