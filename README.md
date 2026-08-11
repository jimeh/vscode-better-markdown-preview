# Better Markdown Preview

Better Markdown Preview will enhance Visual Studio Code's built-in Markdown
preview while preserving its theme, security, resource resolution, and editor
synchronization behavior.

The repository currently contains the generated extension foundation and its
validation harness. It deliberately contributes no Markdown rendering behavior
yet.

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

- `mise run dev` watches the desktop and web bundles.
- `mise run check` runs the fast formatter, linter, type, and unit gate.
- `mise run test:extension` exercises activation in a real Extension Host.
- `mise run package:validate` builds and inspects the VSIX.
- `mise run verify` runs the intended-final-head local gate.

See [Architecture](docs/architecture.md) and [Testing](docs/testing.md) for the
contracts those commands enforce.

## License

Better Markdown Preview is available under the [MIT License](LICENSE).
