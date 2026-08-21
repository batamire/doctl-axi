# Inventory: DO services vs doctl coverage matrix

Type: research
Status: resolved
Blocked by:

## Question

Produce the coverage matrix that every downstream decision depends on: for each of the 21 `digitalocean-labs/mcp-digitalocean` remote MCP services (`apps`, `accounts`, `databases`, `doks`, `droplets`, `docr`, `genai-batchinference`, `genai-custom-models`, `genai-inferencerouter`, `dedicated-inference`, `inference-modelcatalog`, `insights`, `marketplace`, `networking`, `functions`, `spaces`, `docs`, `genai-evaluation`, `nfs`, `volumes`, `vector-databases`) list the MCP tools exposed, then map to `doctl` commands (and `godo`/REST fallback). Mark parity / gap / superset. Output as a markdown table + `gap-domains` list that directly feeds v1 prioritization and wrapper-boundary tickets. Research only — no decisions.

## Notes for researcher

- Use `gh api` / webfetch on `digitalocean-labs/mcp-digitalocean` (README + `pkg/registry/*/README.md`) and `doctl` docs (`docs.digitalocean.com/reference/doctl`, or `doctl --help` locally if installed).
- Keep raw tool lists legible (small batches, not one huge dump).
- Branch hint: `research/do-services-coverage` if capturing artifact.

## Answer

Resolved 2026-08-20. Artifact: `.scratch/do-axi/research-01-coverage.md` (85 lines).

**Findings:** Inventoried 21 labs MCP services (~210 tools) vs `doctl 1.159.0`. **14 full** via doctl (apps, accounts, doks, droplets, docr, dedicated-inference, insights, marketplace, networking, spaces, nfs, volumes + common), **3 partial** (databases online-migration, functions atomic ops, inference-modelcatalog search/get-card), **7 gap** requiring godo/fetch: `genai-batchinference`, `genai-custom-models`, `genai-inferencerouter`, `genai-evaluation`, `vector-databases`, `docs`, `inference-modelcatalog` deep search. doctl is strict superset where it exists; gap domains are thin shims. Ponytail: default `execFile("doctl")`, REST only for gaps.

Closes inventory blocking tickets 04/05/06/07.
