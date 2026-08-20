# 10 — Foundation + Droplet slice

**What to build:** A runnable `do-axi` binary that lists Droplets via the fake `doctl` contract, proving the single CLI seam. From the agent's perspective, `do-axi droplet list` returns minimal TOON (`id/name/region/size+status` + `count`/`status` aggregates, `help:` disclosure, `0 droplets` definitive, truncate with `--full`, `--fields` filter) backed by stubbed `doctl --output json` (`[]`/`{}`/`{errors}`), auth shim reading `DIGITALOCEAN_ACCESS_TOKEN` || `DIGITALOCEAN_API_TOKEN` forwarded as `-t`, `MAX_BUFFER` 10 MB, structured `{error,code,help}` and `AUTH_MISSING`.

**Blocked by:** None — can start immediately. (Wayfinder 01-09 are closed decisions, not code gates.)

**Status:** resolved

- [x] `do-axi droplet list` with fake `doctl` on PATH returning `[]` or 2 Droplets prints TOON `count` + 4 fields per item + `help:`; `0 droplets` on `[]`; exit 0
- [x] `do-axi droplet list --full` disables truncation; `--fields id,name` filters TOON; unknown flag returns validation `{code,help}` exit 2
- [x] Auth shim injects `-t` from `DIGITALOCEAN_ACCESS_TOKEN` || `DIGITALOCEAN_API_TOKEN` || `--context` || `stdin` pipe; missing token prints `AUTH_MISSING` TOON with `help: export ... or doctl auth init`
- [x] Scaffold: `pnpm` + `Node >=20` + `axi-sdk-js` + `toon` wiring (`runAxiCli`, `TOP_HELP`, `Cli` boundary), `bin` fast-path leaf for `--version`, `MAX_BUFFER` 10 MB, `mapError` table for `doctl` `{"errors":...}` → `AxiError` codes
- [x] Tests via CLI seam: spawn built CLI with canned `doctl` fixtures, assert TOON aggregates/truncation/help/error codes (prior art: `gh-axi` vitest CLI goldens)

## Answer
Foundation droplet slice shipped. `do-axi droplet list` via `doctl --output json` → TOON `count: N of N total` + `status: active X/N` + 5 fields per Droplet (`id/name/region/status/size`) + `help: [\"droplet get <id> for detail\", \"do-axi droplet list --full\"]`; `0 droplets` definitive empty exit 0. `--full` disables 8k truncation, `--fields id,name` filters, unknown flag → `VALIDATION_ERROR` exit 2, missing token → `AUTH_MISSING` with `help: export DIGITALOCEAN_ACCESS_TOKEN... or doctl auth init`. Auth shim order `flag > ACCESS_TOKEN > API_TOKEN > config.yaml fallback (no -t, map doctl error) > stdin pipe (non-blocking readableLength/fstat guard)` with `MAX_BUFFER 10MB`. Scaffold `pnpm + Node >=20 + axi-sdk-js@0.1.10 + @toon-format/toon@2.1.0`, `runAxiCli` + `tryFastPath --version`, `TOP_HELP`. CLI seam tests `tests/droplet.test.ts` 10/10 green via fake `doctl` on PATH (canned fixtures, captured `-t` args), covering aggregates/truncation/help/fields/auth precedence/config fallback/stdin. Review since 38a2135..HEAD found auth config fallback + stdin hang + build gap → fixed (now pnpm test auto-builds, region --full fix, valueless --fields validation).

Verified: `pnpm build` green, `tsc --noEmit` green, `pnpm test` 10/10 green, `rm -rf dist && pnpm test` green, manual `do-axi droplet list` with fake doctl 2/0 droplets + truncations correct.

