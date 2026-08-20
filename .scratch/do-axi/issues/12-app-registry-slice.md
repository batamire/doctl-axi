# 12 — App + Registry slice

**What to build:** Add App Platform and Container Registry verticals. An agent can `do-axi app list/get/create/update/delete` plus `deployments/logs` and `do-axi registry repository/tag/manifest/garbage-collection` — each end-to-end via stubbed `doctl apps` / `doctl registry --output json` → TOON with same aggregates/truncation/help as droplet.

**Blocked by:** 10 — Foundation + Droplet slice

**Status:** resolved

- [x] `do-axi app list` stubbed via `doctl apps list --output json` returns TOON `count` + `id/name/region/phase` with `help:`; `get`/`create`/`update`/`delete`/`list-deployments`/`logs` work
- [x] `do-axi registry repository list` and `tag`/`manifest`/`garbage-collection` subcommands work via `doctl registry* --output json`
- [x] TOON rules (4 fields, `0 apps`/`0 repositories` empties, `--full`/`--fields`) reused without duplication
- [x] CLI seam tests for both nouns with canned fixtures

## Answer
App + Registry verticals shipped. `do-axi app list` via `doctl apps list --output json` → TOON `count: N of N total` + `id/name/region/phase` (+ activeDeployment) + `help: ["app get <id> for detail", "do-axi app list --full"]` with `0 apps` definitive; subcommands `app get|create|update|delete|list-deployments|get-deployment|create-deployment|logs` all via `doctl apps ... --output json` with --full (8k) / --fields filter / --context forwarding. `do-axi registry repository list` + `tag list|get`, `manifest list`, `garbage-collection list|get|create|delete` via `doctl registry ... --output json` with same TOON 4-field + help + `0 repositories` empties. Both reuse droplet truncation/aggregates/help/error contracts without duplication. CLI seam 30 tests green (app list count+5 fields+help, 0 apps, --full/--fields, all verbs; registry repo/tag/manifest/gc, 0 empties, --full/--fields).

Verified: pnpm build green, tsc green, pnpm test 124/124 green.
