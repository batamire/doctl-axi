# 28 — Migrate remaining nouns' fixtures to goldens

**What to build:** Every remaining CLI-seam test (droplet, kubernetes/database, registry, network, small nouns, docs, dashboard/hooks) replays captured-redacted golden fixtures instead of hand-authored JSON, completing the ADR 0001 migration. Mechanical batched migration, one test file at a time, suite green after each batch.

**Blocked by:** 27 — Capture pipeline + app goldens + deployment unwrap fix.

**Status:** ready-for-agent

- [ ] All seam tests replay golden fixture files; no hand-authored doctl JSON remains in tests
- [ ] Migration batched per test file with suite green between batches
- [ ] Goldens for read-only nouns captured without needing mutation; mutating verbs reuse captured list/get shapes where the response envelope is what's under test
- [ ] `pnpm test` fully green; no test asserts a fixture round-tripping through the encoder as its only oracle
