# 23 — Sensitive-field TOON filtering for databaseUser (and raw-passthrough paths)

**Status:** ready-for-agent

Spec: "Sensitive fields (database connection.uri, user.password, region.sizes bloat) are omitted from TOON by default". `databaseUser get/create` encode the raw doctl record verbatim (`encode({user: rec})`) — no mapping, no filtering. Same raw-passthrough in several create/delete paths.

Upstream precedent: gh-axi `secret.ts` listSchema omits the value field entirely ("values are never printed"); `api.ts` strips noisy keys unless `--full`.

- [ ] Field-map databaseUser (name/role/permissions; never password)
- [ ] Audit other `encode(<raw doctl record>)` call sites and map or strip sensitive/bloat fields
- [ ] Test: password/connection.uri never appear in TOON output
