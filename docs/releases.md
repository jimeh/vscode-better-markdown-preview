# Releases

Every release-worthy squash commit that reaches `main` is released after the
same CI run passes repository validation plus desktop-floor, desktop-stable,
and web-stable host tests. There is no release pull request or manual approval
step.

## Version and Notes Policy

Pull request titles become squash commit messages and must follow Conventional
Commits. Semantic Release maps them as follows:

| Commit                                              | Release |
| --------------------------------------------------- | ------- |
| `feat`                                              | minor   |
| `fix`, `perf`, `revert`                             | patch   |
| `docs`                                              | patch   |
| `BREAKING CHANGE` or `type!`                        | major   |
| `build`, `chore`, `ci`, `refactor`, `style`, `test` | none    |

Breaking changes override the ordinary type. Use `fix(deps)` for runtime
dependency updates that should release and `chore(deps-dev)` for development
dependency updates that should not.

The tracked `package.json` stays at the valid development placeholder `0.0.0`.
Semantic Release calculates the real version and passes it directly to VSCE,
so the packaged extension manifest contains the released version.

The tracked changelog is an honest pointer to GitHub Releases. During release,
Semantic Release temporarily prepends the current release notes before building
the VSIX. The published VSIX therefore contains the current release entry plus
the GitHub Releases link; cumulative history lives in GitHub Releases. The
temporary changelog and version are not committed back to `main`.

With no prior `v*` tag, the first successful release is `v1.0.0` and its notes
cover the existing release-worthy Conventional Commit history.

## Publication Flow

The release job builds and validates one
`jimeh.better-markdown-preview-<version>.vsix`, then creates its SHA-256 file.
Semantic Release creates the tag and GitHub Release. A seven-day Actions
artifact carries the immutable pair to three independent jobs:

- Visual Studio Marketplace, authenticated only with `VSCE_PAT`.
- Open VSX, authenticated only with `OVSX_PAT`.
- The matching GitHub Release, using the workflow token to attach both files.

Each consumer verifies the checksum before publishing and never rebuilds the
VSIX.

## Required Repository Configuration

Before merging the release setup, confirm the GitHub App identified by
`RELEASE_BOT_CLIENT_ID` and `RELEASE_BOT_PRIVATE_KEY` is installed on this
repository with Metadata read, Contents write, and Issues write permissions.
Issues write is used only for Semantic Release's durable failure report.

Configure GitHub pull requests to allow squash merges only and set the default
squash commit title to **Pull request title**. This preserves the title already
validated by the `Validate PR title` check as the commit Semantic Release reads.

After the new workflows have run once and their check names exist, protect
`main` and require:

- `Validate PR title`
- `Validate and prepare hosts`
- `Desktop host (1.125.0 floor)`
- `Desktop host (stable)`
- `Web host (stable Chromium)`

The release and publication jobs are post-merge effects, so they are not branch
protection requirements.

## Failure Recovery

If a publisher fails after the GitHub Release exists, use **Re-run failed
jobs**. Do not re-run all jobs: Semantic Release will correctly treat the
existing tag as already released, leaving no new release outputs for the
publisher jobs.

For manual recovery after the seven-day Actions artifact expires, download the
VSIX and checksum from the existing GitHub Release, verify the checksum, and
publish that exact VSIX. Never rebuild a tagged release for one destination.

If the release job fails after creating a tag, inspect the existing tag and
GitHub Release before retrying. Do not delete or move a published tag merely to
force another Semantic Release run.
