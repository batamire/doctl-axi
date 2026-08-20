# 15 — Docs fetch slice

**What to build:** The only REST shim in v1: `docs` — no token required. An agent can `do-axi docs search <query>` and `docs get /path` (plus `find-for-service`/`get-quickstart`/`troubleshoot`/`get-related`) via stdlib `fetch` traversing `https://docs.digitalocean.com/llms.txt` and `{path}index.html.md` with 30 minute in-memory cache, reformatted to TOON `count` + `path/title/excerpt` + `help:` — mirroring `docs.mcp.digitalocean.com` 6 tools.

**Blocked by:** 10 — Foundation + Droplet slice

**Status:** resolved

- [x] `do-axi docs search <q>` via stubbed `fetch` of `llms.txt` returns TOON `count` results for query with `help: docs get ...`
- [x] `do-axi docs get /products/droplets/how-to/resize` via stubbed `fetch` of `{path}index.html.md` returns TOON excerpt (truncated at 8k with `--full` escape)
- [x] Cache: second identical query hits in-memory 30m cache (no extra `fetch`); cache is process-local and not persisted
- [x] No token injected for docs; `help:` discloses `find-for-service`/`get-related` next steps; CLI seam tests stub `global.fetch`

## Answer
Docs fetch REST shim shipped — only v1 gap promoted. Stdlib `fetch` traversing `https://docs.digitalocean.com/llms.txt` + `{path}index.html.md` with process-local 30m Map cache (no extra fetch on second identical query). `do-axi docs search <q>` → TOON `count: N results for "q"` + `path/title/excerpt` + `help: ["docs get /path for full page", "docs search \"q\" --full"]`; path now truncated at 8k via truncateExcerpt (fixed `full ? r.path : r.path` bug), title/excerpt truncated. `docs get /products/droplets/how-to/resize` → TOON excerpt truncated 8k with `--full` escape, title derived from markdown `#` heading fallback else basename (fixed title=path bug). Subcommands `find-for-service`/`get-quickstart`/`troubleshoot`/`get-related` same shim, no token injected (fetch without Authorization), help discloses next steps. CLI seam 16 docs tests green (stubbed global.fetch, search llms.txt count+help, get excerpt trunc+full, cache no extra fetch via vi.fn count, no token).

Verified: pnpm build green, tsc green, pnpm test 124/124 green.
