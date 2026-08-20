# v1 domain prioritization & scope cut

Type: grilling
Status: resolved
Blocked by: 01, 04

## Question

Decide which DO product domains are in `do-axi` v1 and which are explicitly deferred. Candidate core: `droplets`, `doks`, `apps`, `databases`, `networking`, `spaces`, `account`. Full catalog is 21. Use the coverage matrix (01) and domain language (04) to cut scope: apply Ponytail — smallest shippable that still justifies "instead of multiple DO MCPs" (covers ~80% agent tasks). For each excluded domain, state deferral reason + graduation trigger. Output: `v1` inclusion list + `deferred` list with rationale. This is the biggest scoping decision — get human sign-off.

## Notes

- Grill breadth-first across usage frequency, doctl maturity, and agent pain (21 MCPs → context blowup).
- If v1 = full 21, justify cost vs token blowup risk (Principle 2: minimal schemas).

## Answer

Resolved 2026-08-20. Grilling completed (2 questions).

**Decision: v1 = 15 domains — 14 full via doctl + `docs`.**

**Included (15):**
- `droplet` (compute droplets, images, sizes, actions)
- `kubernetes` (cluster + node-pool, kubeconfig)
- `app` (apps + deployments)
- `database` (clusters, firewalls, topics, configs, users, pools — online `start/stop/get-migration` trio deferred within domain, still listed as available via note)
- `registry` (DOCR repos, tags, manifests, GC)
- `network` (consolidated: domain, record, certificate, firewall, load-balancer, vpc, peering, cdn, reserved-ip, byoip)
- `volume` (block volumes + snapshots)
- `nfs` (file shares + snapshots)
- `space` (keys only — bucket/object out-of-scope per map)
- `account` (account, balance, billing-history, invoice, ssh-key, action, region)
- `dedicated-inference` (instances + tokens/sizes — doctl superset)
- `insight` (uptime checks + alerts — `monitoring uptime`)
- `marketplace` (1-click droplet/k8s)
- `region` (via common — `region list`; folded into account/balance dashboard)
- `docs` (read-only `llms.txt` traversal — 6 tools, no auth, high agent value, trivial webfetch shim — only gap promoted to v1)

**Deferred (6 gaps + 2 partial trios) — out of v1, trigger = proven AI workload need or v1 stable:**
- `genai-batchinference`, `genai-custom-models`, `genai-inferencerouter`, `genai-evaluation` — Deferred; add when batch/custom/router/eval requests appear (requires `/v2/gen-ai` REST, policy complexity).
- `vector-database` — Deferred (Weaviate `tor1` preview, `/v2/vectordbs`).
- `inference-modelcatalog` search/get-card — Deferred beyond `doctl gradient list-models` flat; add when model discovery filtering needed (pricing/context).
- `database` `start/stop/get-migration` — Deferred within included domain (online migration async, needs godo).
- `function` atomic `create-or-update-action/package/trigger` with inline `Code` + data-plane `invoke` — Deferred; `doctl serverless deploy` project flow not in v1 (serverless is partial; add thin godo shim only if function usage grows).

**Rationale:** "All 14 full" maximizes "instead of 21 MCPs" justification at near-zero extra code (execFile→TOON per domain). Gaps need REST (rung 6 of Ponytail ladder) — deferred via YAGNI except `docs` which is cacheable webfetch, no token, copies `docs.mcp.digitalocean.com` behavior verbatim and unblocks `docs-search/get-page` agent tasks.

**Implications:** Tickets 06/07/08/09 now scoped to these 15. Not yet specified fog updated: REST augmentation detail narrows to 6 deferred GenAI/vector domains + 2 partial trios.
