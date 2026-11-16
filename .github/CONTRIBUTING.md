# Contributing

Thanks for your interest in acp-patchbay. Contributions are welcome.

## Ground rules

- **License — inbound = outbound.** By contributing you agree your contribution
  is licensed under the project's [Apache License 2.0](../LICENSE). You keep
  copyright on your work; there is no copyright assignment.
- **Developer Certificate of Origin.** Every commit must be signed off,
  certifying you have the right to submit it under the project license (see
  <https://developercertificate.org>). Add the sign-off with `git commit -s`,
  which appends:

      Signed-off-by: Your Name <you@example.com>

## Development

    npm ci            # install
    npm run check     # the full gate — typecheck, lint, tests, build, UI shots
    npm test          # unit tests only (vitest)
    npm run build     # esbuild bundle

`npm run check` is the source of truth for "green." The electron suite needs a
VS Code test host and skips loudly where one isn't available — run it where a
host can be downloaded before you rely on it. Every pull request runs the same
gate in CI on Linux, and the unit tests on Windows, so a suite you can't run
locally still runs before merge.

### Running it in an editor

    npm run dev                # build, then a VS Code window that loads this checkout
    npm run dev -- --watch     # keep rebuilding; Reload Window is what takes the new bundles

That window runs on a throwaway profile — its own user-data and extensions
directories, printed so you can delete them — so the Marketplace copy of
Patchbay can't load beside the development copy, nothing else you have
installed is in the way, and workspace trust is settled rather than prompted.
`--code <path>` names an editor nothing standard resolves; a folder argument
says what the window opens on.

F5 (Run Extension) is the other route: the debugger is attached and the window
uses your own profile, which is what you want when the question is inside the
extension host. Either way nothing reloads a running window by itself — `npm
run watch` or `dev --watch` rewrites `out/`, and Command Palette → **Reload
Window** loads it.

To install a built package instead of a development load:

    npm run package                                  # vsce, a devDependency already
    code --install-extension acp-patchbay-<version>.vsix

A chat still needs an agent to talk to: the CLIs Patchbay speaks ACP with
(`claude`, `codex`, `opencode`, `gemini`, …) come from their own vendors, and
Settings → Agents says which ones it found.

## Pull requests

- Keep each PR to **one concern**; unrelated changes belong in separate PRs.
- Use [Conventional Commits](https://www.conventionalcommits.org) for messages
  (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) — the history reads as a
  changelog.
- The architecture is documented in
  [the architecture doc](../docs/architecture.md). A PR that changes behavior
  should keep the docs honest.

## Curated MCP servers

The catalog under Settings → MCP Servers is shipped data:
[`data/mcp-catalog.json`](../data/mcp-catalog.json), validated by the schema in
`src/orchestrator/stores/mcp-catalog.ts`. What an entry is — and isn't — is
[the MCP architecture doc's "The curated set"](../docs/mcp-architecture.md#the-curated-set).

- **To request one**, open a
  [Curated MCP server request](https://github.com/solutionsunity/acp-patchbay/issues/new?template=mcp_server_request.yml).
  You don't need to be the vendor or the server's maintainer. The entry is
  written from the documentation page you link.
- **To contribute one directly**, open a PR adding a single entry to the data
  file, every field read from the vendor's docs (`docsUrl` is that page).
  The entry's mark is `data/icons/<id>.svg`, required: one monochrome
  `<path>` in a `viewBox`, nothing else, with a leading comment naming
  where it came from — the vendor's own asset or
  [simple-icons](https://simpleicons.org) (CC0) — never invented. `npm test`
  loads the file through the schema and the icons through their gate;
  `node scripts/catalog-check.mjs` asks the network whether every fact still
  holds (the same check runs weekly and files an "MCP Catalog drift" issue).

## Reporting

- Bugs and feature requests: open an issue.
- Security vulnerabilities: **do not** open a public issue — see
  [SECURITY.md](SECURITY.md).
