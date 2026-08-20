# Probe: doctl auth & JSON contract

Type: research
Status: resolved
Blocked by:

## Question

Determine the runtime contract `do-axi` will wrap: how `doctl` authenticates (env `DIGITALOCEAN_ACCESS_TOKEN` vs `~/.config/doctl/config.yaml`, token scopes, interop with `DIGITALOCEAN_API_TOKEN`), how stable `doctl <svc> list --output json` is across commands (field names, pagination, exit codes, stderr on missing token, idempotency of create/delete), buffer limits (`MAX_BUFFER`), and whether `--format json` vs registry-style JSON needs normalization. Test locally if `doctl` is installed; otherwise document via docs + labs MCP's `godo` auth comparison. Deliver: auth interop note + JSON stability verdict per top domains. Research only.

## Notes for researcher

- If `doctl` present, sample: `doctl account get --output json`, `doctl compute droplet list --output json`, `doctl apps list --output json`.
- Compare with labs MCP env var `DIGITALOCEAN_API_TOKEN`.
- Branch hint: `research/doctl-contract`.

## Answer

Resolved 2026-08-20. Artifact: `.scratch/do-axi/research-03-doctl-contract.md` (221 lines).

**Findings:** Probed `doctl 1.159.0` locally. Auth order: `-t/--access-token` flag > `DIGITALOCEAN_ACCESS_TOKEN` env > `config.yaml` (`~/Library/Application Support/doctl/config.yaml` macOS) + `--context`. `DIGITALOCEAN_API_TOKEN` (labs MCP) is **ignored** by doctl — needs shim: `do-axi` reads both and passes as `-t`. Missing token → `access token is required` exit 1; 401/404 → `{"errors":[{detail:"GET …: <code>"}]}` on stdout exit 1. `--output json` is correct (`--format json` errors). List→`[]`, get→`{}`, error→`{"errors":[...]}`. Pagination internal, no wrapper. Field names stable snake_case. Must raise `MAX_BUFFER` to 10MB (1.1MB for 162 droplets fails at 1MB default). Per-domain verdict: droplets/doks/databases/apps/networking/volumes/account stable; caveats: droplet `region.sizes` bloat (omit in TOON), databases leaks `connection.uri/password` (redact), `balance get` 403 scoped.

Proposes fallback: `1) --access-token 2) DIGITALOCEAN_ACCESS_TOKEN 3) DIGITALOCEAN_API_TOKEN shim 4) config.yaml 5) TTY prompt` → `execFile("doctl",["-t",token,…],{maxBuffer:10<<20})`.
