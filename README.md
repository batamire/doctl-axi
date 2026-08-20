# do-axi

Agent-ergonomic CLI for DigitalOcean — one AXI wrapping `doctl --output json` → [TOON](https://github.com/toon-format/toon).

Replaces 21 fragmented MCP services with a single `do-axi <noun> <verb>` surface.

## Install

```bash
npm i -g do-axi
# or with pnpm
pnpm add -g do-axi
```

Requires [`doctl`](https://docs.digitalocean.com/reference/doctl/how-to/install/) and `DIGITALOCEAN_ACCESS_TOKEN` (or `doctl auth init`).

## Usage

```bash
do-axi                          # dashboard: account, balance, counts + help
do-axi droplet list
do-axi droplet list --fields id,name
do-axi app list
do-axi database list
do-axi kubernetes cluster list
do-axi registry repository list
do-axi network domain list
do-axi docs search "droplet resize"
do-axi setup hooks
do-axi setup hooks --check
```

Bare `do-axi` prints a TOON dashboard via parallel `doctl` fetches; individual failures degrade to `—` instead of crashing.

## Setup hooks

```bash
do-axi setup hooks          # idempotent install for Claude/Codex/OpenCode
do-axi setup hooks --check  # reports OK or DRIFT as TOON
```

Installs SessionStart hooks that run `do-axi` ambiently:
- `~/.claude/settings.json`
- `~/.codex/hooks.json` + `~/.codex/config.toml`
- `~/.config/opencode/plugins/axi-do-axi.js`

## Skills

```bash
npx skills add do-axi
```

See `skills/do-axi/SKILL.md` (user-invocable: false, category: devops / Hermes).

## Development

```bash
pnpm build
pnpm test
```

Node >=20 required.

## License

MIT
