---
name: do-axi
description: DigitalOcean CLI — droplets, Kubernetes (k8s/doks), App Platform (apps), databases, registry, networks (domains/firewalls/VPCs/CDN), volumes, Spaces keys, docs — wraps doctl → TOON, replaces 21 MCPs
user-invocable: false
metadata:
  hermes:
    category: devops
---

# do-axi

Agent-ergonomic CLI for DigitalOcean — one AXI wrapping `doctl --output json` → TOON.

## Installation

```bash
npx skills add do-axi
# or
pnpm dlx skills add do-axi
```

Requires `doctl` on PATH and `DIGITALOCEAN_ACCESS_TOKEN` (or `doctl auth init`).

## Usage

```bash
do-axi                          # dashboard: account, balance, counts
do-axi droplet list
do-axi app list
do-axi database list
do-axi kubernetes cluster list
do-axi registry repository list
do-axi network domain list
do-axi docs search "droplet resize"
do-axi setup hooks              # install ambient SessionStart hooks
do-axi setup hooks --check      # verify hooks (OK / DRIFT)
```

## Skills integration

This skill is **not user-invocable** (`user-invocable: false`) — you don't type `/do-axi`. Installed via `npx skills add do-axi` (or catalog PR), the agent **auto-loads it when you mention `DigitalOcean`, `doctl`, `droplet`, `app platform`, `database`, `kubernetes`, `registry`, `network` etc.** via skill-search on the frontmatter `description` — no SessionStart cost. It then spawns `npx -y do-axi ...` explicitly on demand.

Hooks are **optional** ambient pre-fetch. Only if you run `do-axi setup hooks` does every Claude/Codex/OpenCode SessionStart spawn `do-axi` (bare dashboard `Promise.allSettled` ~2-3s on this fleet) and inject `account/balance + 6 counts` before first turn:
- `~/.claude/settings.json` (SessionStart)
- `~/.codex/hooks.json`
- `~/.config/opencode/plugins/axi-do-axi.js`
- `~/.codex/config.toml` (`hooks = true`)
For zero overhead clean sessions, skip `setup hooks` — the skill stays discoverable on keyword without any per-session fetch.

## Hermes

- **Category:** devops
- **Runtime:** Node >=20

## Examples

```bash
do-axi droplet list --fields id,name --full
do-axi account get
do-axi balance get
do-axi setup hooks --check
```
