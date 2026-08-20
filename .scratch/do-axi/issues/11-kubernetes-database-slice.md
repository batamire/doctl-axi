# 11 — Kubernetes + Database slice

**What to build:** Extend the CLI proven in 10 to manage Kubernetes clusters and Databases as complete verticals. An agent can `do-axi kubernetes cluster list/get/create/delete` and node-pool ops plus `kubeconfig`, and `do-axi database list/get/create` plus `user`/`topic`/`pool`/`config`/`firewall` via the same TOON 4-field policy (`id/name/region/status` + `engine` aggregate for databases). Mirrors droplet patterns without new seams.

**Blocked by:** 10 — Foundation + Droplet slice

**Status:** resolved

- [x] `do-axi kubernetes cluster list` via stubbed `doctl kubernetes cluster list --output json` returns TOON `count` + 4 fields per cluster with `help:`; `get`/`create`/`delete` and `node-pool` subcommands work
- [x] `do-axi kubernetes cluster kubeconfig <id>` exercises `doctl` kubeconfig path
- [x] `do-axi database list` returns TOON with `engine` bucket aggregate and 4 fields (`id/name/engine/version/region/status`); `user`/`topic`/`pool`/`config`/`firewall` subcommands work; no `godo` needed
- [x] Errors map through same `mapError` table; `help:` discloses next steps per noun
- [x] CLI seam tests cover both nouns with canned fixtures, no added unit seam

## Answer
Kubernetes + Database verticals shipped. `do-axi kubernetes cluster list` via `doctl kubernetes cluster list --output json` → TOON `count: N of N total` + 4 fields `id/name/region/status` + `help: ["kubernetes cluster get <id> for detail", "do-axi kubernetes cluster list --full"]` with `0 kubernetes clusters` definitive; `get/create/delete` + `node-pool list/get/create/delete` + `kubeconfig <id>` via `doctlRaw` (kubeconfig respects --full truncation 8k). Aliases `k8s`/`doks`. `do-axi database list` via `doctl databases list --output json` → TOON `count: 3 total` + `engine: pg=2, mysql=1` bucket + 5 fields `id/name/engine/version/region/status` + help; subcommands `database user|topic|pool|config|firewall` via `doctl databases ... --output json` with singular taxonomy (no plural aliases), `--full` truncation now respected, `0 databases` empties, --fields filter. Both share droplet `mapError`/`MAX_BUFFER 10MB`/`rejectUnknownFlags`/`AUTH_MISSING` shim. CLI seam 26 tests green (k8s alias, kubeconfig path, node-pool, database engine aggregate, user/topic/pool/config/firewall, 0 empties, --full/--fields/--context).

Verified: pnpm build green, tsc --noEmit green, pnpm test 124/124 green.
