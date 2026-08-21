# 13 — Network consolidated slice

**What to build:** A single `network` noun that consolidates the scattered `doctl` networking surface into one AXI help page, per `CONTEXT.md` Network term. An agent can `do-axi network domain/record/certificate/firewall/load-balancer/vpc/peering/cdn/reserved-ip` — each subcommand routes to the correct `doctl` top-level (`compute`, `vpcs`, `network`) but presents as `network` subcommands with uniform TOON.

**Blocked by:** 10 — Foundation + Droplet slice

**Status:** resolved

- [x] `do-axi network domain list` / `record list` stubbed via `doctl compute domain* --output json` returns TOON `count` + `name/ttl/records` with `help:`
- [x] `do-axi network firewall/load-balancer/vpc/peering/cdn/certificate/reserved-ip` subcommands each delegate to correct `doctl` invocation but share `network` TOON/error/help pattern
- [x] `network --help` lists all 9 subcommands in one concise per-command reference; unknown subcommand fails fast
- [x] CLI seam tests cover at least 3 subcommands (`domain`, `firewall`, `vpc`) with canned fixtures; rest via same table-driven pattern

## Answer
Network consolidated noun shipped per CONTEXT.md Network term. Single `do-axi network` with 9 subcommands `domain|record|certificate|firewall|load-balancer|vpc|peering|cdn|reserved-ip` each with `list|get|create|delete` verbs, routing to correct doctl top-level but uniform TOON: `network domain list`→`doctl compute domain list --output json`, `record list`→`compute domain records list <domain>`, `firewall`→`compute firewall list`, `load-balancer`→`compute load-balancer list`, `vpc`→`vpcs list`, `peering`→`vpcs peerings list`, `cdn`→`compute cdn list`, `certificate`→`compute certificate list`, `reserved-ip`→`compute reserved-ip list`. TOON `count` + `name/ttl/records` (+ sub-specific 4 fields) + non-empty `help:` after every output (create/delete now disclose next steps), 8k truncation with --full, --fields, --context, rejectUnknownFlags, unknown subcommand → VALIDATION_ERROR help. `network --help` lists all 9 subcommands concise. CLI seam 18 tests green (domain/record/firewall/vpc detailed + 0 empties + --full/--fields + help lists 9 + unknown fail; table-driven for remaining 5).

Verified: pnpm build green, tsc green, pnpm test 124/124 green.
