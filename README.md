> **🧪 Proof of Concept - AXI Experiment built with AI**
>
> This is an experimental proof-of-concept AXI (Agent Experience Interface) - an AI-built wrapper around `doctl` as an alternative to 21 fragmented MCP services. Not production-hardened; expect sharp edges, token truncation at 8k, and `10 MB` maxBuffer limits. Use for evaluation and feedback, not critical deploys.

# do-axi

Agent-ergonomic CLI for DigitalOcean - one AXI wrapping `doctl --output json` → [TOON](https://github.com/toon-format/toon).

Replaces 21 fragmented MCP services (`*.mcp.digitalocean.com`) with a single `do-axi <noun> <verb>` surface. No global install required - the skill is the primary entry point.

## Quick start - skill is the intended usage

Requires [`doctl`](https://docs.digitalocean.com/reference/doctl/how-to/install/) authenticated (`doctl auth init` or `DIGITALOCEAN_ACCESS_TOKEN`).

You don't need `do-axi` installed globally. The agent discovers it via its skill:

```bash
npx skills add do-axi   # one-time: registers the skill (hermes devops, user-invocable: false)
```

Then just mention DigitalOcean jargon - `droplet`, `Kubernetes`/`k8s`, `App Platform`, `database`, `registry`, `network`/`VPC`, `Spaces`, `docs` - the agent auto-loads `skills/do-axi/SKILL.md` on keyword match and runs:

```bash
npx -y do-axi droplet list
npx -y do-axi droplet list --fields id,name
npx -y do-axi kubernetes cluster list
npx -y do-axi app list
npx -y do-axi database list
npx -y do-axi network domain list
npx -y do-axi docs search "droplet resize"
npx -y do-axi --help
npx -y do-axi droplet list --help
```

Bare `npx -y do-axi` (no args) prints the TOON dashboard - account, balance, and counts - on demand only. No per-session pre-fetch.

## Install alternatives (optional)

```bash
# ad-hoc, zero install - what the skill does under the hood
npx -y do-axi droplet list

# global, if you prefer a bare binary
npm i -g do-axi        # or pnpm add -g do-axi
do-axi droplet list
```

## Setup hooks - opt-in with performance penalty

By default **nothing runs at SessionStart** - clean sessions have zero overhead (skill stays on-demand via keyword).

If you want ambient inventory before the first turn, opt in explicitly:

```bash
do-axi setup hooks          # writes ~/.claude/settings.json + ~/.codex/hooks.json+config.toml + ~/.config/opencode/plugins/axi-do-axi.js
do-axi setup hooks --check  # TOON OK vs DRIFT
```

**Penalty:** every new Claude/Codex/OpenCode SessionStart spawns `do-axi` (bare dashboard → 8 parallel `doctl --output json` for `account, balance, and counts for droplets, apps, databases, Kubernetes clusters, registry, domains`). Typically `1–3s` depending on fleet size (10s timeout, degrades to `—` on failure). Skip it and the skill remains keyword-discoverable with no per-session cost.

See `skills/do-axi/SKILL.md` for the agent-facing workflow (When to use → Workflow → Commands → Tips).

## Development

```bash
pnpm build        # tsc + tsx scripts/build-skill.ts → dist/ + dist/skills
pnpm test         # pnpm build && vitest run - 131 CLI-seam tests (fake doctl on PATH)
```

Node >=20 required.

## License

MIT
