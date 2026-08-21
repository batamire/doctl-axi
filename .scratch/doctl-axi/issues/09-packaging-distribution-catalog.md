# Packaging, distribution & catalog

Type: grilling
Status: resolved
Blocked by: 05, 06

## Question

Lock packaging so the destination is shippable: npm name `do-axi` availability + `package.json` (`bin: do-axi`, `Node >=20`, `pnpm`, `axi-sdk-js` + `@toon-format/toon`), skill location (`skills/do-axi/SKILL.md`), hooks installer (`setup hooks` for opencode/claude/codex), versioning (`release-please`), and AXI catalog PR (`kunchenguid/axi/catalog.yaml` community entry). Decide license (MIT like references) and repo home (standalone `do-axi` repo). Needs 05+06 — can't version/scope package without v1 domain set + wrapper boundary.

## Notes

- Check `npm view do-axi` + catalog.yaml contribution guide (`CONTRIBUTING.md` in `kunchenguid/axi`).
- Keep `skills/do-axi` minimal — mirrors `gh-axi/skills/gh-axi` frontmatter (`user-invocable: false`, `metadata.hermes`).

## Answer

Resolved 2026-08-20. Grilling completed (1 question). Pre-checks: `npm view do-axi` 404 → name available; `axi-sdk-js@0.1.10` latest.

**Decision: Approve as proposed — Ponytail minimal.**

- **package.json:** `name: do-axi`, `bin: { "do-axi": "./dist/bin/do-axi.js" }`, `type: module`, `engines: { node: ">=20" }`, `packageManager: pnpm@11`, `dependencies: { "axi-sdk-js": "^0.1.10", "@toon-format/toon": "^2.1.0" }` — no godo in v1, fetch for docs is stdlib. `files: ["dist","skills/do-axi","LICENSE","README.md"]`.

- **Scaffold (port gh-axi):** `src/version.ts` leaf → `bin/do-axi.ts` fast-path (`tryFastPath`) → `src/cli.ts` (`DESCRIPTION/TOP_HELP/COMMAND_HELP/COMMANDS`→`runAxiCli`) → `src/doctl.ts` (gh.ts port) → `src/errors.ts:mapDoctlError` → `src/format.ts/toon.ts/args.ts/fields.ts/body.ts` → `src/suggestions.ts` → `src/commands/home.ts` + 15 per-noun commands → `src/commands/setup.ts` + `hooks.ts` wrapper (computeSessionStartHookUpdate), `skills/do-axi/SKILL.md` (user-invocable:false, metadata.hermes devops), `scripts/build-skill.ts`.

- **Tooling:** `pnpm`, `tsc`, `vitest`, `eslint`, `prettier`, `release-please` (CHANGELOG.md, release-please-config.json, .release-please-manifest.json), GitHub Actions `ci.yml` + `release-please.yml`, LICENSE MIT.

- **Distrib:** `npm publish` public, `npx -y do-axi` zero-setup, `npx skills add do-axi` skill install (via vercel-labs/skills), `do-axi setup hooks` optional ambient (SessionStart for Claude/Codex/OpenCode). Catalog PR to `kunchenguid/axi/catalog.yaml` community: `{name: do-axi, url: https://github.com/<owner>/do-axi, author: <owner>, domain: DigitalOcean, description: "Manage Droplets, DOKS, Apps, Databases, Networking, Spaces and more via doctl with TOON..."}` + `pnpm docs:gen`.

- **Repo:** standalone `github.com/<owner>/do-axi` (not fork of labs MCP), MIT like gh-axi/chrome-devtools-axi.

