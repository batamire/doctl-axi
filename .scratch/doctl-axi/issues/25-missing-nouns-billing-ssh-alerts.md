# 25 — Missing nouns: billing/invoices/SSH keys (story 21) + insight alerts (story 23)

**Status:** ready-for-human

Spec story 21 lists "account/balance/billing-history/invoices/SSH keys/regions"; only `account get`, `balance get`, `region list` exist. Story 23 asks for "list uptime checks and alerts via insight"; `insight.ts` has only uptime list/get — no alerts.

Filed as ready-for-human because scope is a product call: these are read-only nouns with no blocker, but each needs a TOON field-map decision and adds surface area. Split into per-noun tickets when picked up:

- [ ] `billing-history list` / `invoice list` (doctl: `compute billing-history list`, `compute invoice list`)
- [ ] `ssh-key list/get/create/delete` (full CRUD candidate)
- [ ] `insight alert list/get` (doctl: `monitoring alert list`)
