<div align="center">

<img width="196px" src="https://github.com/jimeh/vscode-better-markdown-preview/raw/refs/heads/main/img/logo.png" alt="Better Markdown Preview logo">

# Better Markdown Preview

**A better, theme-aware Markdown preview for Visual Studio Code.**

[![GitHub Release](https://img.shields.io/github/v/release/jimeh/vscode-better-markdown-preview?logo=github&label=Release)](https://github.com/jimeh/vscode-better-markdown-preview/releases/latest)
[![VSCode](https://img.shields.io/badge/Marketplace-blue.svg?logoColor=white&logo=data:image/svg%2bxml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJtOTkuOTkgOS41NXY4My4zM3MtMjMuOCA5LjUxLTIzLjggOS41MWwtNDEuNjktNDAuNDYtMjUuMDIgMTkuMDUtOS40OC00Ljc1di01MHM5LjUzLTQuNzkgOS41My00Ljc5bDI1LjA0IDE5LjA2IDQxLjYtNDAuNSAyMy44MyA5LjU1em0tMjYuMjYgMjMuODgtMjMuOCAxNy43OSAyMy44MSAxNy45M3YtMzUuNzJ6bS02MS45NCA3LjA3djIxLjRzMTEuOS0xMC43NyAxMS45LTEwLjc3bC0xMS45MS0xMC42M3oiIGZpbGw9IiNmZmYiLz48L3N2Zz4=)][vscode-ext]
[![OpenVSX](https://img.shields.io/badge/OpenVSX-purple.svg?logoColor=white&logo=data:image/svg%2bxml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTMxIDEzMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjZmZmIj48cGF0aCBkPSJtNDIuOCA0My4zNSAyMi42LTM5LjJoLTQ1LjN6bS0yNS40IDQ0LjNoNDUuM2wtMjIuNy0zOS4xem01MSAwIDIyLjYgMzkuMiAyMi42LTM5LjJ6Ii8+PHBhdGggZD0ibTY1LjQgNC4xNS0yMi42IDM5LjJoNDUuMnptLTI1LjQgNDQuNCAyMi43IDM5LjEgMjIuNi0zOS4xem01MSAwLTIyLjYgMzkuMWg0NS4yeiIvPjwvZz48L3N2Zz4=)][openvsx-ext]
[![GitHub Issues](https://img.shields.io/github/issues/jimeh/vscode-better-markdown-preview?logo=github&label=Issues)](https://github.com/jimeh/vscode-better-markdown-preview/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/jimeh/vscode-better-markdown-preview?logo=github&label=PRs)](https://github.com/jimeh/vscode-better-markdown-preview/pulls)
[![License](https://img.shields.io/github/license/jimeh/vscode-better-markdown-preview?label=License)](https://github.com/jimeh/vscode-better-markdown-preview/blob/main/LICENSE)

</div>

[vscode-ext]: https://marketplace.visualstudio.com/items?itemName=jimeh.better-markdown-preview
[openvsx-ext]: https://open-vsx.org/extension/jimeh/better-markdown-preview

Better Markdown Preview is a standalone, all-in-one enhancement for Visual
Studio Code's built-in Markdown preview. Its goal is to bring the common preview
features you would otherwise need several extensions for into one place,
without replacing the native preview. Source synchronization, resource
resolution, security settings, code-copy controls, syntax highlighting, and
user preview styles continue to work.

![Better Markdown Preview showing a table of contents, frontmatter, GitHub alert, columns, and a Mermaid diagram](img/preview.png)

It adds:

- Complete visible GFM behavior, including task lists, literal autolinks, and
  tag filtering.
- A responsive H1-H3 table of contents with active-heading tracking.
- GitHub alerts, footnotes, definition lists, and collapsible highlighted TOML
  and YAML frontmatter.
- Unicode emoji from named shortcodes such as `:joy:`, with optional emoticon
  shortcuts such as `:)`.
- Responsive Pandoc-style columns.
- Improved, locally bundled Mermaid rendering with a full-page viewer for
  zooming and panning around large diagrams.
- Code-block titles, highlighted lines and words, line numbers, and diff-line
  annotations while retaining VS Code's native highlighter.
- A clean layout driven entirely by the active VS Code theme, including high
  contrast and print presentation.

Open a Markdown file and run **Markdown: Open Preview** or **Markdown: Open
Preview to the Side**. The built-in preview is enhanced automatically.

**Compatibility note:** Better Markdown Preview is intended as a one-stop
preview enhancement and may conflict with other extensions that modify VS
Code's Markdown preview. Disable or uninstall overlapping preview extensions to
avoid duplicate rendering or unexpected behavior.

## Extended syntax

### TOML and YAML frontmatter

TOML frontmatter uses exact `+++` delimiter lines at the start of a document;
YAML uses `---`. Both render expanded by default in a collapsible,
syntax-highlighted code block without displaying their delimiter lines.

### Columns

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

### Rich code blocks

Rich code metadata follows the language identifier:

````markdown
```ts title="src/example.ts" {1,3-5} /needle/ showLineNumbers
const needle = true; // [!code ++]
```
````

### Mermaid

Only an exact lowercase `mermaid` fence renders as a diagram. Mermaid is loaded
from the extension package only when the document contains such a block; source
remains visible if loading or rendering fails. Diagram surfaces are derived from
the active editor background, foreground, and link accent colors. The Mermaid
theme shift settings control how far fills and borders move toward those theme
colors.

### Emoji

Named emoji shortcodes render as Unicode emoji in ordinary Markdown text and
link labels, but remain literal in inline and block code. Emoticon shortcuts are
available separately and disabled by default.

## Settings

Better Markdown Preview features can be changed at user or workspace scope.
Boolean features are enabled by default except emoticon shortcuts; Mermaid theme
shifts are percentages from 0 to 100:

| Setting                                                   | Behavior                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `betterMarkdownPreview.rendering.taskLists`               | GFM task lists                                                    |
| `betterMarkdownPreview.rendering.definitionLists`         | Definition lists                                                  |
| `betterMarkdownPreview.rendering.footnotes`               | Footnotes and backlinks                                           |
| `betterMarkdownPreview.rendering.githubAlerts`            | GitHub-style alerts                                               |
| `betterMarkdownPreview.rendering.emojiShortcodes`         | Named emoji shortcodes such as `:joy:`                            |
| `betterMarkdownPreview.rendering.emoticonShortcuts`       | Emoticons such as `:)`; requires emoji shortcodes                 |
| `betterMarkdownPreview.rendering.tomlFrontmatter`         | Expanded, collapsible, highlighted TOML frontmatter               |
| `betterMarkdownPreview.rendering.yamlFrontmatter`         | Expanded, collapsible, highlighted YAML frontmatter               |
| `betterMarkdownPreview.rendering.columns`                 | Responsive Pandoc-style columns                                   |
| `betterMarkdownPreview.rendering.enhancedAutolinks`       | Missing GFM HTTP, HTTPS, email, and `www.` literal links          |
| `betterMarkdownPreview.rendering.richCodeBlocks`          | Rich code-block metadata and diff annotations                     |
| `betterMarkdownPreview.rendering.mermaid`                 | Local Mermaid fence rendering                                     |
| `betterMarkdownPreview.navigation.tableOfContents`        | Responsive table of contents and active-heading tracking          |
| `betterMarkdownPreview.navigation.smoothScrolling`        | Animated ToC navigation, subject to reduced-motion preferences    |
| `betterMarkdownPreview.mermaid.viewer`                    | Full-screen Mermaid zoom and pan viewer                           |
| `betterMarkdownPreview.mermaid.theme.primaryColorShift`   | Primary fill shift toward the theme link accent (default 12%)     |
| `betterMarkdownPreview.mermaid.theme.secondaryColorShift` | Secondary fill shift toward the theme link accent (default 18%)   |
| `betterMarkdownPreview.mermaid.theme.tertiaryColorShift`  | Tertiary fill shift toward the editor foreground (default 10%)    |
| `betterMarkdownPreview.mermaid.theme.borderColorShift`    | Border shift toward its accent or foreground source (default 45%) |

Disabling a rendering feature stops Better Markdown Preview from handling that
syntax and delegates it to VS Code or another Markdown extension. It does not
force the syntax to remain literal. Theme integration, accessibility, overflow
handling, print safety, and GFM tag filtering remain enabled because they are
baseline presentation, compatibility, and safety behavior.

## Development

[mise](https://mise.jdx.dev/) installs the locked runtime and validation tools.
The project uses three-day release-age policies for Mise tools and pnpm
dependencies.

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
- `mise run lint` runs native and type-aware Oxlint, Stylelint, and Markdownlint.
- `mise run test:coverage` enforces all-files V8 coverage floors.
- `mise run test:desktop` exercises the engine floor and stable desktop hosts.
- `mise run test:web:stable` exercises stable VS Code for the Web in Chromium
  after `mise run test:hosts:prepare`.
- `mise run package:validate` builds and inspects the VSIX.
- `mise run release:check` exercises versioning, notes, outputs, and workflow
  contracts without publishing.
- `mise run verify` runs the intended-final-head local gate.

See [Architecture](docs/architecture.md) and [Testing](docs/testing.md) for the
contracts those commands enforce. See [Releases](docs/releases.md) for the
automated versioning, publication, and recovery contract.

## License

Better Markdown Preview is available under the [MIT License](LICENSE).
