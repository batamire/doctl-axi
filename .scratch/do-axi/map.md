# Map: do-axi — single AXI replacing multiple DigitalOcean MCPs

## Destination

A shippable `do-axi` CLI (npm package `do-axi`, binary `do-axi`) that wraps `doctl` (+ direct REST only where `doctl` gaps) behind AXI's 10 principles (TOON, 3-4 fields/list, truncation+`--full`, aggregates, definitive empties, structured errors, ambient context, content-first dashboard, suggestions, `--help`), consolidating the 21 fragmented `digitalocean-labs/mcp-digitalocean` remote MCP services into one agent-ergonomic surface. Published to npm, listed in `kunchenguid/axi/catalog.yaml` (community), with `do-axi setup hooks` + skill for ambient context. The map is done when the spec + implementation plan is decided — command surface, TOON field map, doctl↔MCP coverage matrix, auth/dashboard contract, wrapper boundary, packaging/catalog requirements — nothing left to decide before build.

## Notes

- Domain: DigitalOcean infrastructure (Droplets, App Platform, DOKS, Databases, Spaces, Networking, DOCR, Functions, etc.) + AXI ergonomics.
- Strategy: Ponytail — follow `gh-axi` pattern (`execFile("doctl", args)` → reformat to TOON) as primary rung; direct REST only where `doctl` has no coverage (e.g., some GenAI/vectorDB). Prefer `axi-sdk-js` + `@toon-format/toon`, Node >=20, pnpm.
- Skills every session should consult: `axi` (principles + scaffold), `grilling` + `domain-modeling` for language/decisions, `prototype` for field/output stubs.
- Reference implementations: `kunchenguid/gh-axi` (CLI wrapper) and `kunchenguid/chrome-devtools-axi` (MCP wrapper) — see analysis in issues.
- Auth baseline: `DIGITALOCEAN_API_TOKEN` env (labs MCP) + `doctl` config (`~/.config/doctl/config.yaml`) interop — decision gated by ticket 03.
- Plan, don't do: tickets resolve decisions, not deliverables. One ticket per session (research parallel okay).

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [Inventory: DO services vs doctl coverage matrix](issues/01-do-services-vs-doctl-coverage-matrix.md) — 21 services mapped: 14 full via doctl, 3 partial, 7 gap (GenAI batch/custom/router/eval, vectorDB, docs, modelcatalog-search) → wrapper default, REST only for gaps.
- [Teardown: axi-sdk-js + TOON + gh-axi / chrome-devtools-axi pattern](issues/02-axi-sdk-toon-reference-teardown.md) — gh-axi `execFile`+TOON pattern is template for do-axi; SDK gives runAxiCli/home/hooks, we build doctl.ts/format/toon/errors; 10MB buffer & stdin-secrets pitfalls captured.
- [Probe: doctl auth & JSON contract](issues/03-doctl-auth-json-contract.md) — doctl auth is flag>ACCESS_TOKEN>config.yaml, ignores API_TOKEN (shim needed); `--output json` stable, list=[] get={} error={errors}, 10MB buffer required; redact DB passwords.
- [Domain language & command naming](issues/04-domain-language-command-naming.md) — singular gh-axi-style nouns + consolidated `network` (vpc under network) + kubernetes/database/registry canonicals → `CONTEXT.md` written with 12 terms + taxonomy.
- [v1 domain prioritization & scope cut](issues/05-v1-domain-prioritization.md) — v1 = 15 domains: 14 full via doctl (droplet, kubernetes, app, database, registry, network, volume, nfs, space, account, dedicated-inference, insight, marketplace, region) + `docs` (only gap promoted); 6 GenAI/vector + 2 partial trios deferred with trigger.
- [Wrapper vs REST boundary](issues/06-wrapper-vs-rest-boundary.md) — strict `doctl` execFile (10MB, --output json, token shim) + thin `docs` fetch only; gaps → NOT_IMPLEMENTED AxiError, no godo in v1.
- [Prototype: TOON fields & aggregates for core resources](issues/07-toon-fields-aggregates-prototype.md) — 4 fields + aggregates (droplet id/name/region/status etc.) + truncate>8k + 0-results empty; prototype `prototype/toon-samples.md` linked.
- [Auth & ambient dashboard contract](issues/08-auth-ambient-dashboard-contract.md) — both env shim (ACCESS_TOKEN||API_TOKEN → -t) + stdin secret, rich dashboard `Promise.all` (account+balance+6 counts), skill + `setup hooks` both offered.
- [Packaging, distribution & catalog](issues/09-packaging-distribution-catalog.md) — `do-axi` npm available, `axi-sdk-js@0.1.10`+`toon@2.1.0`, pnpm+Node>=20, fast-path bin, release-please, MIT standalone repo + catalog PR.
- [Foundation + Droplet slice](issues/10-foundation-droplet-slice.md) — runnable `do-axi droplet list` via `doctl --output json` → TOON `count/status` + 5 fields + `help:` + `0 droplets` + `--full`/`--fields` + `AUTH_MISSING`; auth shim flag>ACCESS_TOKEN>API_TOKEN>config.yaml>stdin (non-blocking) + 10MB buffer; CLI seam 10 tests green.
- [Kubernetes + Database slice](issues/11-kubernetes-database-slice.md) — `kubernetes cluster list/get/create/delete` + `node-pool` + `kubeconfig` + aliases `k8s`/`doks` + `database list` with `engine` aggregate + `user/topic/pool/config/firewall` singular taxonomy, CLI seam 26 tests.
- [App + Registry slice](issues/12-app-registry-slice.md) — `app list/get/create/update/delete` + `deployments/logs` + `registry repository/tag/manifest/garbage-collection`, CLI seam 30 tests.
- [Network consolidated slice](issues/13-network-consolidated-slice.md) — single `network` noun consolidating 9 subcommands (`domain/record/certificate/firewall/load-balancer/vpc/peering/cdn/reserved-ip`) via compute/vpcs routing, `network --help` lists all 9, 18 tests.
- [Remaining doctl nouns slice](issues/14-remaining-doctl-nouns-slice.md) — `volume/nfs/space keys/dedicated-inference/insight/marketplace/region/account/balance` batch, 24 tests.
- [Docs fetch slice](issues/15-docs-fetch-slice.md) — stdlib `fetch` `llms.txt` + `{path}index.html.md` 30m cache, no token, `docs search/get` + variants, 16 tests.

- [Dashboard + Hooks + Packaging slice](issues/16-dashboard-hooks-packaging-slice.md) — bare `do-axi` `Promise.allSettled` dashboard `account/balance` + 6 counts + `—` degradation + `help`; `setup hooks` idempotent + `--check` drift (codexConfigOk fix); `skills/do-axi` + `build-skill` + bin fast-path `--version`/`-v`; package `do-axi` Node>=20 pnpm catalog + `license MIT` + `release-please` + `CHANGELOG` + workflows, 131 tests.

## Not yet specified

<!-- in-scope fog; graduates as frontier advances; not tickets yet -->

- Bench harness — token/cost benchmark vs 21 MCPs à la `bench-github` (post-v1, needs field map + implemented CLI to measure; not ticketed until v1 ships).
- REST augmentation for deferred gaps — exact `godo` endpoints for `genai-*`, `vector-database`, `function` atomic (graduates only if a v2 trigger fires: proven GenAI/serverless usage).

## Out of scope

<!-- beyond destination; never graduates -->

- Terraform/Pulumi replacement or state management — out of scope, this is CLI ergonomics not IaC.
- Full DigitalOcean API parity beyond `doctl` + labs MCP catalog — destination is agent-ergonomic subset, not 1:1 API mirror.
- Web UI / hosted dashboard — CLI + hooks + skill only.
- Billing automation / invoice workflows — account `balance` shown, but not billing mutations.
