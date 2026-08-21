# 27 — Capture pipeline + app goldens + deployment unwrap fix

**What to build:** The contract-fidelity path proven end-to-end on one noun: a capture script records real `doctl --output json` responses and redacts string values (names, IDs, IPs, repo refs — structure, nesting, and types preserved) before writing golden fixtures; the `app` noun's seam tests replay those goldens through the fake doctl instead of hand-authored JSON; and `app get-deployment` / `create-deployment` correctly unwrap doctl's array-wrapped deployment response, so the previously empty TOON now shows real populated fields. Per ADR 0001, hand-authored doctl fixtures are prohibited from here on.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Capture script produces redacted goldens from live doctl; re-running it is idempotent and never writes unredacted output to the repo
- [ ] Fake-doctl helper replays golden fixture files (prefactor away inline JSON strings)
- [ ] All `app` noun seam tests pass against captured goldens
- [ ] `app get-deployment <app> <deploy>` prints populated `id/phase/cause/progress` — golden encodes the real array-wrapped shape
- [ ] `app create-deployment` same unwrap treatment; suite green (`pnpm test`)
