---
name: do-axi
description: Agent-ergonomic CLI for DigitalOcean wrapping doctl → TOON
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

This skill is **not user-invocable** (`user-invocable: false`). It is loaded ambiently via SessionStart hooks that run `do-axi` to inject dashboard context for the agent.

Hooks installed:
- `~/.claude/settings.json` (SessionStart)
- `~/.codex/hooks.json`
- `~/.config/opencode/plugins/axi-do-axi.js`
- `~/.codex/config.toml` (`hooks = true`)

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
