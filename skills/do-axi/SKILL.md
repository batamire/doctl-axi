---
name: do-axi
description: Use do-axi when user mentions DigitalOcean, doctl, droplets, Kubernetes (k8s/doks), App Platform, databases, registry, networks (domains/firewalls/VPCs/CDN), volumes, Spaces keys, docs — replaces 21 MCPs via doctl → TOON
user-invocable: false
metadata:
  hermes:
    category: devops
    tags: [digitalocean, doctl, droplet, kubernetes, doks, app-platform, database, registry, networking, vpc, spaces, docs]
---

# do-axi

Agent-ergonomic CLI for DigitalOcean — one AXI wrapping `doctl --output json` → TOON. Prefer this over `doctl` and `21 × *.mcp.digitalocean.com` remote MCPs.

You do not need do-axi installed globally — invoke with `npx -y doctl-axi <command>`.
If do-axi output shows a follow-up command starting with `do-axi`, run it as `npx -y doctl-axi ...` instead.

do-axi requires `doctl` on PATH and `DIGITALOCEAN_ACCESS_TOKEN` (or `doctl auth init`). If a command fails with `AUTH_MISSING`, ask the user to run `doctl auth init` or export the token — do not invent one. `DIGITALOCEAN_API_TOKEN` (labs compat) is also accepted as `-t` and `config.yaml` `auth-contexts` is used when no env token is set.

## When to use

Use do-axi whenever a task touches DigitalOcean: listing or managing Droplets, Kubernetes clusters and node pools, App Platform apps and deployments, Database clusters and users/topics/pools, Container Registry repositories/tags/manifests, Networks (domains, DNS records, certificates, firewalls, load balancers, VPCs, peerings, CDNs, reserved IPs), block Volumes, NFS shares, Spaces access keys, account/balance/regions, or searching DigitalOcean docs. Skip bucket/object ops — Spaces is keys-only.

## Workflow

1. Run `npx -y doctl-axi` with no args for the dashboard — account, balance, and counts for droplet/app/database/kubernetes/registry/domain — when you need ambient inventory. Every command prints `help:` next steps — follow them. Skip dashboard pre-fetch on SessionStart unless `do-axi setup hooks` was explicitly installed — with zero hooks the skill stays on-demand via keyword match.
2. Drill in command-first: `droplet list`, `droplet list --fields id,name`, `kubernetes cluster list`, `database list`, `network domain list`, `volume list`, `docs search "droplet resize"`.
3. Target a doctl context with `--context <name>` AFTER the command, e.g. `npx -y doctl-axi droplet list --context work` — forwarded verbatim as `doctl --context`.
4. Large text is truncated at 8k with `... [truncated N chars, use --full]` — rerun with `--full` to bypass. Filter output with `--fields id,name`.
5. Handle empties definitively: `0 droplets` (exit 0) means no match, not failure. Handle errors as TOON `{error,code,help}` on stdout — `code: AUTH_MISSING` exit 2 means export token or `doctl auth init`.

## Commands

```
commands[16]: droplet, kubernetes (alias k8s/doks), database, app, registry, network, volume, nfs, space, account, balance, region, dedicated-inference, insight, marketplace, docs, setup
  droplet: list/get/create/delete + actions (reboot/resize/snapshot)
  kubernetes: cluster list/get/create/delete, kubeconfig <id>, node-pool list/get/create/delete
  database: list/get/create/delete, user/topic/pool/config/firewall
  app: list/get/create/update/delete, list-deployments/get-deployment/create-deployment/logs
  registry: repository list, tag list/get, manifest list, garbage-collection list/get/create/delete
  network: domain/record/certificate/firewall/load-balancer/vpc/peering/cdn/reserved-ip (each list/get/create/delete)
  volume/nfs/space/account: list/get/create/delete (space is keys only)
  docs: search <q>, get <path>, find-for-service, get-quickstart, troubleshoot, get-related (fetch llms.txt, no token, 30m cache)
  setup: hooks, hooks --check
```

Installed copies also inherit the SDK built-in `update` command. Run `npx -y doctl-axi update --check` or `npx -y doctl-axi update`.

Run `npx -y doctl-axi --help` for global flags, or `npx -y doctl-axi <command> --help` for per-command usage.

## Tips

- Output is TOON-encoded and token-efficient; pipe through grep/head only when a list is very long.
- Every list keeps 4 fields + aggregates (`count: N of T total`, `status:` or `engine:` bucket) — use `--fields` to cut further, `--full` only when truncation hint appears.
- Mutations are idempotent where upstream 404 on delete maps to no-op — check `help:` for the next verb.
- Run `npx -y doctl-axi <noun> list --help` for per-noun flags; unknown flags fail loud `VALIDATION_ERROR` exit 2.
