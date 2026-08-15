<div align="center">

<img width="196px" src="https://github.com/jimeh/vscode-better-markdown-preview/raw/refs/heads/main/img/logo.png" alt="Better Markdown Preview logo">

# Better Markdown Preview

**A better, theme-aware Markdown preview for Visual Studio Code.**

[![GitHub Release](https://img.shields.io/github/v/release/jimeh/vscode-better-markdown-preview?logo=github&label=Release)](https://github.com/jimeh/vscode-better-markdown-preview/releases/latest)
[![VSCode](https://img.shields.io/badge/Marketplace-blue.svg?logo=visualstudiocode&logoColor=white)][vscode-ext]
[![OpenVSX](https://img.shields.io/badge/OpenVSX-purple.svg?logo=eclipseide&logoColor=white)][openvsx-ext]
[![GitHub Issues](https://img.shields.io/github/issues/jimeh/vscode-better-markdown-preview?logo=github&label=Issues)](https://github.com/jimeh/vscode-better-markdown-preview/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/jimeh/vscode-better-markdown-preview?logo=github&label=PRs)](https://github.com/jimeh/vscode-better-markdown-preview/pulls)
[![License](https://img.shields.io/github/license/jimeh/vscode-better-markdown-preview?label=License)](https://github.com/jimeh/vscode-better-markdown-preview/blob/main/LICENSE)

</div>

[vscode-ext]: https://marketplace.visualstudio.com/items?itemName=jimeh.better-markdown-preview
[openvsx-ext]: https://open-vsx.org/extension/jimeh/better-markdown-preview

Better Markdown Preview enhances Visual Studio Code's built-in Markdown preview
without replacing it. Native source synchronization, resource resolution,
security settings, code-copy controls, syntax highlighting, and user preview
styles continue to work.

It adds:

- Complete visible GFM behavior, including task lists, literal autolinks, and
  tag filtering.
- GitHub alerts, footnotes, definition lists, and collapsed TOML frontmatter.
- Responsive Pandoc-style columns and locally bundled Mermaid diagrams.
- Code-block titles, highlighted lines and words, line numbers, and diff-line
  annotations while retaining VS Code's native highlighter.
- A responsive H1-H3 table of contents with active-heading tracking.
- A clean layout driven entirely by the active VS Code theme, including high
  contrast and print presentation.

Open a Markdown file and run **Markdown: Open Preview** or **Markdown: Open
Preview to the Side**. The built-in preview is enhanced automatically.

## Extended syntax

TOML frontmatter uses exact `+++` delimiter lines at the start of a document.
Columns use the supported Pandoc fenced-div subset:

```markdown
:::: {.columns}
::: {.column width=40%}
Left column
:::
::: {.column}
Right column
:::
::::
```

Rich code metadata follows the language identifier:

````markdown
```ts title="src/example.ts" {1,3-5} /needle/ showLineNumbers
const needle = true; // [!code ++]
```
````

Only an exact lowercase `mermaid` fence renders as a diagram. Mermaid is loaded
from the extension package only when the document contains such a block; source
remains visible if loading or rendering fails.

## Development

[mise](https://mise.jdx.dev/) installs the pinned runtime and validation tools.
The project uses pnpm with a seven-day dependency release-age policy.

```console
mise run setup
mise run check
mise run verify
```

Use `mise tasks` to discover the complete task surface. The most common loops
are:

- `mise run dev` watches the desktop, web, preview runtime, Mermaid, CSS, and
  TypeScript targets.
- `mise run check` runs the fast formatter, linter, type, and unit gate.
- `mise run test:extension` exercises activation in a real Extension Host.
- `mise run package:validate` builds and inspects the VSIX.
- `mise run verify` runs the intended-final-head local gate.

See [Architecture](docs/architecture.md) and [Testing](docs/testing.md) for the
contracts those commands enforce.

## License

Better Markdown Preview is available under the [MIT License](LICENSE).
