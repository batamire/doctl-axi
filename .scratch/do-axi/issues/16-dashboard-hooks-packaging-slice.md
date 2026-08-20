# 16 — Dashboard + Hooks + Packaging slice

**What to build:** Bring the CLI home to shippable. Bare `do-axi` shows a rich content-first dashboard via `Promise.all` (`account` email/team, `balance`, plus counts for `droplet`/`app`/`database`/`kubernetes`/`registry`/`domain` — each failure degrades to `—`); `do-axi setup hooks` installs ambient SessionStart hooks for Claude/Codex/OpenCode via `axi-sdk-js` (`~/.claude/settings.json` etc.); `skills/do-axi` skill (`user-invocable:false`) + `update` channel; `release-please` + MIT + `npm` publish + community entry in `kunchenguid/axi/catalog.yaml`.

**Blocked by:** 11 — Kubernetes + Database slice, 12 — App + Registry slice, 13 — Network consolidated slice, 14 — Remaining doctl nouns slice, 15 — Docs fetch slice

**Status:** resolved

- [x] Bare `do-axi` with stubbed `doctl`+`fetch` prints TOON dashboard `account`/`balance` + 6 aggregates + `help: ["do-axi droplet list"]`; partial failure of one count does not crash home
- [x] `do-axi setup hooks` writes SessionStart hooks (Claude/Codex/OpenCode) and is idempotent; `do-axi setup hooks --check` reports drift
- [x] `skills/do-axi/SKILL.md` + `scripts/build-skill.ts` + `npx skills add do-axi` install works; `bin` fast-path for `--version`/`-v` before SDK init
- [x] `package.json` (`name: do-axi`, `bin: do-axi`, `Node >=20`, `pnpm`, deps `axi-sdk-js@0.1.10` + `toon@2.1.0`, `files: [dist, skills/do-axi, LICENSE, README.md]`), `pnpm build` + `vitest` green, `release-please` + `CHANGELOG.md` + catalog PR (`pnpm docs:gen` in `kunchenguid/axi`)

## Answer
Dashboard + Hooks + Packaging slice shipped. Bare `do-axi` now via `src/lib/dashboard.ts` `Promise.allSettled` fetching `account get` (email/team), `balance get`, plus counts for `droplet`/`app`/`database`/`kubernetes`/`registry`/`domain` via `doctl --output json` lists — each failure degrades to `—` not crash, assembled via `encode` TOON `account`/`balance` + 6 aggregates + `help: ["do-axi droplet list"]`. `do-axi setup hooks` via `axi-sdk-js installSessionStartHooks` writes SessionStart hooks for Claude (`~/.claude/settings.json`), Codex (`~/.codex/hooks.json` + `~/.codex/config.toml`), OpenCode (`.config/opencode/plugins`) idempotently; `setup hooks --check` drift now correctly includes codexConfigOk (fixed bug where deleting config.toml reported OK) and post-install discards OK now returns DRIFT when execPath ends in .ts (tsx path) — ensuring --check reflects true state. `skills/do-axi/SKILL.md` (user-invocable:false, Hermes devops, `npx skills add do-axi`) + `scripts/build-skill.ts` copy+manifest. Bin fast-path `src/bin/do-axi.ts` via `tryFastPath` handles `--version`/`-v` before SDK init. Packaging: `package.json` name do-axi, bin do-axi, type module, engines Node>=20, deps `axi-sdk-js@0.1.10` + `@toon-format/toon@2.1.0` via pnpm catalog `@toon-format/toon`/`axi-sdk-js` + `catalog:` protocol, `files: [dist, skills/do-axi, LICENSE, README.md]`, `license: MIT`, `LICENSE` MIT, `README.md`/`CHANGELOG.md`, `release-please-config.json` + `.release-please-manifest.json` + `.github/workflows/release-please.yml`+`ci.yml`. Smoke: bare dashboard TOON with 6 counts + help, partial failure → —, setup idempotent + --check DRIFT OK, --version fast-path prints 0.1.0 without token.

Verified: pnpm build (tsc + build-skill) green, tsc --noEmit green, pnpm test 131/131 green (7 dashboard-hooks +124), review P1 drift bugs fixed.

