# Auth & ambient dashboard contract

Type: grilling
Status: resolved
Blocked by: 03, 05

## Question

Decide auth interop + content-first contract: (a) which token wins — `DIGITALOCEAN_API_TOKEN` env (labs MCP convention) vs `doctl` config vs both (fallback order), `password: true` prompting vs `stdin` secret pattern (`gh-axi/src/secretValue.ts`), (b) what `do-axi` with no args shows — account overview (balance, droplet/app/db counts, recent deployments) vs help (Principle 8: content-first), (c) distribution paths — skill (`npx skills add ...`) vs `npm i -g do-axi` + `do-axi setup hooks` (`SessionStart` ambient context). Needs 03 (auth probing) + 05 (which domains' counts to show).

## Notes

- Principle 7 (ambient context) + Principle 8 (content-first) tradeoff.
- Reference `gh-axi` home (`src/commands/home.ts`) and `chrome-devtools-axi/src/hooks.ts`.

## Answer

Resolved 2026-08-20. Grilling completed (2 questions).

**Decision:**

- **Auth shim:** Read `DIGITALOCEAN_ACCESS_TOKEN` || `DIGITALOCEAN_API_TOKEN` (labs compat) → pass as `-t` to doctl via `buildArgs`. Forward `--context`/`DIGITALOCEAN_CONTEXT` unchanged to doctl (research 03). Also support `stdin` secret pattern `echo $TOKEN | do-axi auth init --stdin` (like `gh-axi/src/secretValue.ts` avoiding argv leak). Missing token → `AxiError(code=AUTH_MISSING, help=["export DIGITALOCEAN_ACCESS_TOKEN or DIGITALOCEAN_API_TOKEN, or run: doctl auth init"])` encoded TOON + exit 2. This satisfies both doctl users and labs MCP users.

- **Dashboard (content-first, Principle 8):** Rich dashboard via `Promise.all` (like `gh-axi/src/commands/home.ts`) — bare `do-axi` fetches in parallel: `account get`, `balance get`, `droplet list`, `app list`, `database list`, `kubernetes cluster list`, `registry get`, `network domain list` (counts only, not full lists, so truncated). Shows `account: email/team`, `balance: $`, aggregates `droplet: N, app: N, database: N, kubernetes: N, registry: N repos, domain: N` plus `help: ["do-axi droplet list", "do-axi app list --full"]` disclosure (Principle 9). Stays within 10MB buffer since list calls are already capped for counts; individual failures degrade to `—` not crash.

- **Distribution:** Skill (`npx skills add do-axi`) as primary (per gh-axi), plus `npm i -g do-axi` + `do-axi setup hooks` installing SessionStart for Claude/Codex/OpenCode (via `axi-sdk-js` `installSessionStartHooks`, writing `~/.claude/settings.json` etc.). Both offered, hooks optional like gh-axi.

