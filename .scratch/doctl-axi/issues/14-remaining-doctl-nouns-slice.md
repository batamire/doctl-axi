# 14 — Remaining doctl nouns slice

**What to build:** Cover the remaining small doctl-full nouns in one tracer bullet: `volume`, `nfs`, `space` (keys only), `dedicated-inference`, `insight` (uptime checks/alerts), `marketplace`, and `region` (via `account`). Each is CRUD via `doctl --output json` → TOON 4-field, proving that batching small nouns after the foundation is cheaper than per-noun tickets, and that the CLI still stays demoable (`do-axi volume list`, `do-axi space key list`, etc.).

**Blocked by:** 10 — Foundation + Droplet slice

**Status:** resolved

- [x] `do-axi volume list` / `nfs list` / `space key list` via stubbed `doctl compute volume*` / `doctl nfs` / `doctl spaces keys` each returns TOON `count` + 4 fields with `help:`
- [x] `do-axi dedicated-inference list` / `insight uptime list` / `marketplace list` via `doctl dedicated-inference` / `monitoring uptime` / `1-click` return TOON with same pattern; `account get`/`balance get` still work
- [x] `0 volumes` / `0 spaces` / `0 inference` empties are definitive; `--full`/`--fields` and error mapping reused
- [x] CLI seam tests for at least `volume`, `space`, `dedicated-inference` with canned fixtures; others table-driven

## Answer
Remaining small nouns batch shipped. `do-axi volume list`→`doctl compute volume list --output json`, `nfs list`→`doctl nfs list`, `space key list`→`doctl spaces keys list`, `dedicated-inference list`→`doctl dedicated-inference list`, `insight uptime list`→`doctl monitoring uptime list`, `marketplace list`→`doctl 1-click list`, `region list`/`account get`/`balance get` via `doctl compute region/account/balance`. Each → TOON `count` + 4 fields (`volume id/name/region/size/status`, `nfs id/name/region/status`, `space key name/accessKey/created`, etc.) + `help:` disclosure, definitive empties `0 volumes`/`0 spaces`/`0 inference`/`0 nfs` etc., --full 8k trunc (balance now accepts --full), --fields filter, --context, same mapError. CLI seam 24 tests green (volume 0 volumes/--full/--fields, space 0 spaces, dedicated-inference 0 inference, nfs/insight/marketplace/region/account/balance, help, unknown flag).

Verified: pnpm build green, tsc green, pnpm test 124/124 green.
