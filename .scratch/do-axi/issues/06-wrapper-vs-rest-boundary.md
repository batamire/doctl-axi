# Wrapper vs REST boundary

Type: grilling
Status: resolved
Blocked by: 01, 03

## Question

Lock the implementation boundary: `do-axi` wraps `doctl` via `execFile` (like `gh-axi/src/gh.ts`) as primary path — but where does it augment with direct REST (`fetch` to `api.digitalocean.com/v2` or `godo`-style) because `doctl` lacks coverage or JSON is unstable? Decide per deferred/gap domain (e.g., GenAI inference routers, vectorDB, dedicated inference, model catalog, insights). Rule: fewest wrappers, boring over clever; direct REST only where `doctl` gap is proven by ticket 01. Define error mapping (doctl stderr → `AxiError` codes) and buffer/limits.

## Notes

- Use the coverage gaps from 01 and JSON contract from 03.
- Call out if any domain needs chrome-devtools-axi-style persistent bridge (unlikely — doctl is process-per-call; justify if proposed).

## Answer

Resolved 2026-08-20. Grilling completed (1 question).

**Decision: Strict doctl + docs only. Ponytail rung 2 → 6.**

- **Primary:** `src/doctl.ts` as direct port of `gh-axi/src/gh.ts:21` — `execFile("doctl", buildArgs, {maxBuffer:10<<20})` with 4 shapes `doctlJson/doctlExec/doctlRaw/doctlExecWithStdin`. `buildArgs` will inject `-t $token` shim (reads `DIGITALOCEAN_ACCESS_TOKEN` || `DIGITALOCEAN_API_TOKEN` per research 03) and `--output json` (never `--format`). JSON envelopes: list `[]`, get `{}`, error `{"errors":[{"detail"}]}` (stdout, exit 1). Map stderr via `mapDoctlError` table (like `gh-axi/src/errors.ts:24-108`) preserving upstream exit codes; forward `doctl --context` unchanged.

- **Only REST shim in v1:** `docs` — thin `fetch` of `https://docs.digitalocean.com/llms.txt` + `{path}index.html.md` with 30m in-memory cache, no token, no godo — mirrors `docs.mcp.digitalocean.com` 6 tools (`search/get-page/find-for-service/get-quickstart/troubleshoot/get-related`). No persistent bridge (unlike chrome-devtools-axi) — process-per-call is fine.

- **Deferred gaps return structured error:** For any GenAI/vector/modelcatalog trigger, functions atomic, or DB migration trio invoked in v1, return `AxiError("NOT_IMPLEMENTED", code="NOT_IMPLEMENTED", suggestions=["deferred to v2, use https://*.mcp.digitalocean.com/mcp or godo"])` encoded as TOON `{error,code,help}` + exit 2 (like gh-axi validation). No silent fallback, no half-shim.

**Implications:** Tickets 07/08 now scoped: TOON fields only for 14 doctl domains + docs; `function` excluded from v1 prototype. Ticket 09 packaging knows to depend on `axi-sdk-js` + `@toon-format/toon` only (plus `fetch` stdlib for docs, no godo dep in v1).
