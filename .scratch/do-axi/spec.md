Status: ready-for-agent

# Spec: do-axi — single AXI for DigitalOcean

## Problem Statement

An agent that needs to operate DigitalOcean today must juggle up to 21 separate remote MCP services (`apps.mcp.digitalocean.com`, `droplets.mcp.digitalocean.com`, `doks.mcp.digitalocean.com`, `databases.mcp.digitalocean.com`, `networking.mcp.digitalocean.com`, `spaces.mcp.digitalocean.com`, etc.) each with its own tool list, auth header, and verbose JSON schemas. Like the pre-AXI `gh` vs GitHub MCP story (100% vs 87% success, 66% higher cost), this fragmentation blows the agent's context, forces tool-search, and requires the user to configure 21 MCP entries instead of one. `doctl` already consolidates the same surface into a single CLI, but its raw JSON is verbose, lacks truncation, aggregates, and agent hints. Agents need one agent-ergonomic CLI that wraps the stable `doctl --output json` contract and reformats to TOON, with minimal per-list schemas, truncation, aggregates, definitive empties, structured errors, content-first dashboard, and ambient skill/hooks — replacing the 21 MCPs with one `do-axi` binary, as `gh-axi` does for `gh`.

## Solution

Ship `do-axi` as an AXI-compliant npm package (`doctl-axi`, bins `do-axi` + `doctl-axi`) that wraps `doctl` via process execution and reformats every response to TOON (`@toon-format/toon`), driven by `axi-sdk-js`. One binary exposes 15 v1 nouns covering all `doctl`-full domains plus `docs` via `fetch`: `droplet`, `kubernetes` (alias `k8s`/`doks`), `app`, `database`, `registry`, `network` (consolidated `domain`/`record`/`certificate`/`firewall`/`load-balancer`/`vpc`/`peering`/`cdn`/`reserved-ip`), `volume`, `nfs`, `space` (keys only), `account`/`balance`/`billing`/`invoice`/`region`, `dedicated-inference`, `insight`, `marketplace`, and `docs`. Gaps that require direct REST (`genai-*`, `vector-database`, `function` atomic, `database` online-migration) are unadvertised and deferred to v2. Auth reads `DIGITALOCEAN_ACCESS_TOKEN` || `DIGITALOCEAN_API_TOKEN` (labs compat) and forwards `--context`, plus `stdin` secret support; bare `do-axi` shows a rich `Promise.all` dashboard (`account`, `balance`, 6 counts); `do-axi setup hooks` + `skills/do-axi` provide ambient context (Principle 7). Packaged with `pnpm`/`Node >=20`, `release-please`, MIT, standalone repo, and a community entry in `kunchenguid/axi/catalog.yaml`.

## User Stories

1. As an agent, I want to list Droplets with 4 minimal TOON fields plus aggregates (`count`, `status`), so that I can inventory fleet without parsing 130-field `doctl` payloads.
2. As an agent, I want to get a single Droplet by ID, so that I can inspect its region/size/image/status detail.
3. As an agent, I want to create a Droplet, so that I can provision new compute.
4. As an agent, I want to delete a Droplet idempotently, so that retrying a delete after success is a no-op with a clear message, not an error.
5. As an agent, I want to invoke Droplet actions (reboot/power-cycle/resize/snapshot/rebuild), so that I can operate a fleet.
6. As an agent, I want `0 droplets` definitive empty (exit 0) rather than `[]`, so that I can distinguish "no match" from failure.
7. As an agent, I want to list Kubernetes clusters with `id/name/region/status`, so that I can see DOKS state compactly.
8. As an agent, I want to manage Kubernetes node-pools, so that I can scale a cluster.
9. As an agent, I want to fetch a kubeconfig for a Kubernetes cluster, so that I can drive `kubectl` after.
10. As an agent, I want to list Apps with `id/name/region/phase`, so that I can track App Platform.
11. As an agent, I want to manage App deployments (list/get/create logs), so that I can diagnose deploy failures without extra round trips.
12. As an agent, I want to list Databases with `id/name/engine/version/region/status` plus `engine` aggregate, so that I can triage managed clusters.
13. As an agent, I want to manage Database users/topics/pools/config firewalls, so that I can operate a cluster beyond listing.
14. As an agent, I want to list Registry repositories/tags/manifests, so that I can inspect container images.
15. As an agent, I want to manage Registry garbage collection, so that I can maintain a registry.
16. As an agent, I want to manage Network domains and DNS records via `network domain`/`network record`, so that I can operate DNS without learning four `doctl` top-levels.
17. As an agent, I want to manage Network firewalls, load-balancers, VPCs, peerings, CDNs, certificates, and reserved IPs under `network`, so that one noun consolidates networking.
18. As an agent, I want to list Volumes with `id/name/region/size/status`, so that I can manage block storage.
19. As an agent, I want to manage NFS file shares and snapshots, so that I can operate shared storage.
20. As an agent, I want to manage Space keys (create/list/get/update/delete), so that I can rotate S3-compatible credentials (buckets/objects remain S3 domain, out of scope).
21. As an agent, I want to get account/balance/billing-history/invoices/SSH keys/regions, so that I can surface account context without separate calls.
22. As an agent, I want to list dedicated inference instances, so that I can track GPU inference.
23. As an agent, I want to list uptime checks and alerts via `insight`, so that I can monitor endpoints.
24. As an agent, I want to list Marketplace 1-clicks, so that I can discover installable stacks.
25. As an agent, I want to search DigitalOcean docs (`docs search`) without a token, so that I can answer "how to resize a Droplet" from docs.
26. As an agent, I want to get a doc page and related pages (`docs get`, `get-related`, `get-quickstart`, `troubleshoot`), so that I can follow docs chains.
27. As an agent, I want `--fields` to select subset of TOON fields, so that I can reduce tokens further when only `id`/`name` matters.
28. As an agent, I want `--full` to disable truncation, so that I can retrieve the complete payload when needed.
29. As an agent, I want large text truncated with `... [truncated N chars, use --full]`, so that one field cannot flood context.
30. As an agent, I want structured errors `{error, code, help}` + exit 2 on validation and non-zero on upstream, so that I can branch on error type programmatically.
31. As an agent, I want idempotent mutations to return a no-op success with hint, not a failure, so that reruns are safe.
32. As an agent, I want `help:` disclosure after each output, so that I know the next command without re-reading help.
33. As an agent, I want `do-axi <noun> --help` concise per-command help, so that I can learn flags without full docs.
34. As an operator, I want auth to accept `DIGITALOCEAN_ACCESS_TOKEN` || `DIGITALOCEAN_API_TOKEN` (labs compat) plus `stdin` piping, so that existing envs and leaked-arg avoidance both work.
35. As an operator, I want missing token to report `AUTH_MISSING` with `help: export ... or doctl auth init`, so that I can fix auth without guessing.
36. As an operator, I want bare `do-axi` to show a rich dashboard (`account` email/team, `balance`, plus counts for `droplet`/`app`/`database`/`kubernetes`/`registry`/`domain`) via parallel fetches, so that Principle 8 content-first holds and I see live state without args.
37. As an operator, I want `do-axi setup hooks` to install SessionStart hooks for Claude/Codex/OpenCode, so that ambient DO context appears every session (Principle 7).
38. As an operator, I want `npx -y doctl-axi` zero-setup and `npx skills add doctl-axi` skill install, so that I can try without global install.
39. As an operator, I want unknown or gap nouns to fail fast with a `VALIDATION_ERROR` that lists available nouns, so that I never invoke an unadvertised command (upstream AXI convention: unimplemented = unadvertised).
40. As a maintainer, I want `do-axi update` and `release-please` versioning, so that upgrades are decoupled from hook/skill installs.

## Implementation Decisions

- **AXI stack:** Use `axi-sdk-js` for CLI framing (`runAxiCli`, `home`, command registry, `getCommandHelp`, `resolveContext`, `AxiError`, `installSessionStartHooks`) and `@toon-format/toon` for encoding; Node `>=20`, `pnpm`. No `godo` dependency in v1; `docs` uses stdlib `fetch`.
- **Wrapper contract:** Default path is process execution of `doctl` with `--output json` (never `--format`). JSON envelopes are `[]` for list, `{}` for get, `{"errors":[{"detail"}]}` on error (stdout, exit 1) — stable across domains. Execution uses `10 MB` max buffer (1.1 MB for 162 Droplets would OOM at Node's 1 MB default). Token is injected as `-t` from shim order `flag > DIGITALOCEAN_ACCESS_TOKEN env > DIGITALOCEAN_API_TOKEN env (labs compat shim) > config.yaml context > stdin pipe`. `--context` is forwarded verbatim.
- **Single REST shim:** Only `docs` bypasses `doctl`: thin `fetch` of `llms.txt` traversal and `{path}index.html.md` with 30 minute in-memory cache, no token — mirroring `docs.mcp.digitalocean.com` 6 tools. All other gaps (`genai-batchinference`, `genai-custom-models`, `genai-inferencerouter`, `genai-evaluation`, `vector-database`, `inference-modelcatalog` search/get-card, `database` online-migration trio, `function` atomic `create-or-update-action` with inline `Code`) are out of v1 and simply unadvertised — unknown commands return `VALIDATION_ERROR` with available-noun suggestions (no `NOT_IMPLEMENTED` sentinel; amended 2026-08-21 after full-history review found no upstream precedent in axi/gh-axi/chrome-devtools-axi).
- **Glossary & taxonomy:** Canonical nouns are singular (gh-axi idiom) per `CONTEXT.md`: `droplet` (avoid `droplets`), `app`, `database`, `kubernetes` (alias `k8s`/`doks`), `registry` (avoid `docr`), `space` (keys only), `volume`, `nfs`, `account`/`balance`/`billing`/`invoice`/`region`, `dedicated-inference`, `insight`, `marketplace`, `docs`. `network` is consolidated: `domain`/`record`/`certificate`/`firewall`/`load-balancer`/`vpc`/`peering`/`cdn`/`reserved-ip` as subcommands (MCP groups VPC+peering inside networking; `doctl` scatters it across four top-levels — AXI consolidates).
- **TOON field policy (Principle 2/3/4/5):** 4 fields per list item + aggregates + definitive empty per prototype — from `prototype/toon-samples.md` (decision-rich inline, trimmed):
  ```toon
  count: 2 of 2 total
  status: active 2/2
  ---
  - id: 12345678
    name: web-01
    region: nyc1
    status: active
  help: ["droplet get 12345678 for detail", "do-axi droplet list --full"]
  ```
  Droplet: `id`/`name`/`region`/`size+status`; App: `id`/`name`/`region`/`phase+activeDeployment`; Database: `id`/`name`/`engine`/`version+region/status` + `engine` bucket aggregate; Network domain: `name`/`ttl`/`records`. Aggregates are `count` plus one domain bucket (`status`, `engine`) per list, not a full matrix. Empty is `0 droplets` (exit 0). `--fields` selects subset; `--full` disables truncation; field values >8k chars are truncated with `... [truncated N chars, use --full]`. Sensitive fields (`database` `connection.uri`, `user.password`, `region.sizes` bloat) are omitted from TOON by default.
- **Error & help contracts (Principle 6/9/10):** All errors are TOON `{error, code, help}` on stdout with appropriate exit code; unknown flags fail fast with validation error, not silent drop; mutations prefer idempotent no-op success when upstream reports 404 on delete; secrets never appear in argv (use `stdin` pipe for `auth`); after each output include `help:` next-step disclosure; per-command `--help` is concise plus `TOP_HELP` global.
- **Dashboard (Principle 8):** Bare invocation shows rich live state via `Promise.all` parallel fetches (`account get`, `balance get`, `droplet list`, `app list`, `database list`, `kubernetes cluster list`, `registry get`, `network domain list` — counts only). Individual failures degrade to `—` rather than crashing the dashboard.
- **Distribution:** Skill (`skills/do-axi/SKILL.md`, `user-invocable:false`, Hermes devops metadata, `npx skills add doctl-axi`) is primary zero-setup path; `npm` global (`npm i -g doctl-axi` + `npx -y doctl-axi`) plus `do-axi setup hooks` (writes `~/.claude/settings.json`, `~/.codex/hooks.json`, opencode plugin) is secondary ambient path. Versioning via `release-please`, self-update via `do-axi update`.
- **Packaging:** `name: doctl-axi`, bins `do-axi` + `doctl-axi` (bin alias required: npm exec resolves only bin==package name), `type: module`, `files: [dist, skills/do-axi, LICENSE, README.md]`, license MIT, standalone repo, community catalog entry in `kunchenguid/axi/catalog.yaml`.
- ** v1 inclusion (Principle: smallest that still replaces 21 MCPs):** 15 domains — 14 full via `doctl` (`droplet`, `kubernetes`, `app`, `database`, `registry`, `network`, `volume`, `nfs`, `space`, `account` surface, `dedicated-inference`, `insight`, `marketplace`, `region`) plus `docs` (only gap promoted). Deferred until proven need: `genai-*` (4), `vector-database`, `inference-modelcatalog` deep search, `database` migration trio, `function` atomic — each gated by usage trigger.
- **Validation:** `rejectUnknownFlags` per subcommand; `-R/--repo` analogue not needed (DO is single tenant), but `--context` is reserved global; repository/host targeting trims `process.env` mutation leakage.

## Testing Decisions

- **What makes a good test:** Test external behavior only — the CLI contract (argv → TOON stdout + exit code + `help:` disclosure) — not internal formatter units. A test that breaks when output wording is tightened is a bad test; a test that breaks when `count` drifts is good. No snapshots of internal JSON, no file-path assertions, no `execFile` call-count checks.
- **Seam:** Single highest seam — CLI boundary. Tests spawn the built binary (`node ./dist/bin/do-axi.js <noun> <verb>`) with a fake `doctl` on `PATH` returning canned `--output json` fixtures and a stubbed `global.fetch` for `docs`. Assert TOON decoding, aggregates, `0 <noun>` empties, `help:` hints, `--fields`/`--full` behavior, and error `{code}` mapping. Prior art: `gh-axi` CLI golden tests (spawn + TOON assert) — do-axi copies that harness. No second unit seam for `toFormat`/`mapError` unless CLI harness proves too slow.
- **Modules under test via seam:** All TOON field selection, truncation (8k), definitive empties, structured `AUTH_MISSING`/`UNKNOWN` errors, auth shim (both envs + `stdin`), dashboard `Promise.all` degradation, and per-command `rejectUnknownFlags` — all exercised through the CLI even though implementations live in wrapper, formatter, error, and docs modules.
- **Prior art:** `kunchenguid/gh-axi` (Vitest, CLI spawn, TOON golden) and `kunchenguid/chrome-devtools-axi` (bridge health + snapshot truncation) — use `vitest` with `tsx` and fixture `doctl` shims in temp `PATH`.

## Out of Scope

- `genai-batchinference`, `genai-custom-models`, `genai-inferencerouter`, `genai-evaluation`, `vector-database`, `inference-modelcatalog` deep search, `function` atomic `create-or-update-action/package/trigger` with inline `Code` and `invoke` data-plane, and `database` online-migration `start/stop/get-migration` — deferred to v2 (unadvertised until then).
- Bucket/object management for Spaces (S3 domain — keys only in v1).
- Terraform/Pulumi/state management, full API parity beyond `doctl`+labs catalog, web UI/hosted dashboard, and billing mutations beyond reading `balance`/`billing-history`/`invoice`.

## Further Notes

- Ponytail: fewest wrappers — `doctl` is Rung 2 reuse; thin shim is only rung lower. One-line `OR` shim for `API_TOKEN` saves a dep; `fetch` for `docs` saves `godo` for v1.
- Calibration knob remains: truncation threshold (8k), dashboard parallel fan-out (6 counts), and `MaxBuffer` (10 MB) are tuned not hard-coded deep; revisit only if 162-Droplet or large spec payloads hit limits.
- Catalog: after `npm publish`, append community entry to `kunchenguid/axi/catalog.yaml`, run `pnpm docs:gen`, and open PR per `CONTRIBUTING.md`.
- Decision log lives in `CONTEXT.md` (ubiquitous language) and would-grow `docs/adr/` — first ADRs should be `doctl-wrapper-boundary` and `network-consolidation`.

