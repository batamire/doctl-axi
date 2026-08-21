# 29 — Shape-mismatch guard + contract probe

**What to build:** The two drift alarms from ADR 0001. Runtime: in the shared doctl→TOON mapping path, non-empty raw JSON where zero expected keys extract raises `SHAPE_MISMATCH` (exit 2) with help pointing at re-capture — the silent empty-TOON failure mode (the original `get-deployment` bug) becomes loud. Test-time: a contract-probe test, skipped unless `DOCTL_CONTRACT=1` and doctl is authed, validates each golden's shape (array-vs-object at root, key presence) against the live read-only verbs, catching doctl shape drift between captures.

**Blocked by:** 27 — Capture pipeline + app goldens + deployment unwrap fix.

**Status:** ready-for-agent

- [ ] Mapping a non-empty response with all fields missing yields `SHAPE_MISMATCH` AxiError, exit 2, help suggests re-running capture and reporting doctl version
- [ ] Legitimate empties unaffected: `0 droplets`-style empty lists and genuinely sparse objects still exit 0
- [ ] Probe test runs all goldens against live doctl shapes when `DOCTL_CONTRACT=1`; skips silently otherwise; README documents the pre-release ritual
- [ ] Probe failure output names the golden file and the shape difference
- [ ] `pnpm test` green without the env flag (probe skipped)
