# Contract-fidelity testing: goldens, probe, guard

Type: grilling
Status: resolved
Blocked by: None

## Question

How should `doctl-axi` tests stay honest to real `doctl --output json` shapes?
Hand-authored fixtures encode the same assumptions as the code under test —
demonstrated by `app get-deployment` emitting empty TOON (exit 0) because its
fixture was a bare object while doctl returns an array-wrapped deployment.
Confirm mutual understanding of the three-layer proposal: captured goldens,
contract probe, extraction-miss guard — and pin the open semantics.

## Notes

- Repo is public (GitHub + npm); verbatim captures would leak skade/daytwo
  account data (resource names, IDs, repo refs).
- Existing precedent: ticket 03 probed list/get envelope shapes (`[]` lists,
  `{}` gets) but never recorded `get-deployment`'s one-element-array shape.
- Ticket 10 convention "tests via CLI seam, no added unit seam" stays intact —
  this changes what feeds the seam, not the seam itself.

## Answer

Resolved 2026-08-21. Grilling completed (2 rounds, 6 questions).

**Decisions:**

1. **Goldens: capture → redact.** All doctl fixtures are captured verbatim from
   real `doctl --output json`, then redacted by script (string values →
   placeholders; structure, nesting, types preserved). Redaction runs inside the
   capture script so re-captures can't leak. Authored fixtures prohibited going
   forward.
2. **Scope: all three layers.**
   - Capture script (`scripts/capture-fixtures.ts`) + goldens under
     `tests/fixtures/doctl/`; `makeFakeDoctl` replays golden files.
   - Contract probe: vitest file skipped unless `DOCTL_CONTRACT=1` + authed
     doctl; compares golden shapes (array vs object, key presence) against live
     read-only verbs. Local/manual trigger only — run before releases and after
     doctl upgrades.
   - Extraction-miss guard in the shared mapping path: non-empty raw JSON +
     zero expected keys extracted → `AxiError("SHAPE_MISMATCH")`, exit 2, help
     suggests re-running capture / reporting doctl version. No per-noun config;
     partial single-key renames remain the probe's job.
3. **Recorded:** `docs/adr/0001-captured-redacted-golden-fixtures.md`.

**Known accepted gaps:** guard misses single-key renames; probe relies on human
discipline (no CI gate, no scheduled run). Revisit if a drift event slips
through both.
