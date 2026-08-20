# Prototype: TOON fields & aggregates for core resources

Type: prototype
Status: resolved
Blocked by: 01, 02, 04

## Question

Raise fidelity with concrete TOON stubs for 2-3 core resources (e.g., droplet, app, database) so field-selection decisions are visible. Prototype: minimal 3-4 fields per list item (like `gh-axi`'s 3-field issue list), pre-computed aggregates (`count: N`, `region: X`, `status: running/N`), truncation (`... [truncated N chars, use --full]`) and empty state (`0 droplets` not `[]`). Link prototype artifact (e.g., `prototype/toon-samples.md` or throwaway branch) and capture human reaction. Blocked by 01+02+04 — needs inventory, SDK pattern, and noun choices.

## Notes

- Invoke `/prototype` skill; keep artifact throwaway.
- Show `bare` vs `list --full` side-by-side; ask: too terse vs still verbose?

## Answer

Resolved 2026-08-20. Grilling completed + prototype artifact linked.

**Decision: 4 fields + aggregates per list.**

Prototype: `prototype/toon-samples.md` (linked) showing droplet/app/database/domain/docs TOON with:
- droplet → `id/name/region/size+status` + aggregates `count`, `status:active/total`
- app → `id/name/region/phase+activeDeployment`
- database → `id/name/engine/version+region/status` + `engine: pg=2` aggregate
- domain → `name/ttl/records`
- docs → `path/title/excerpt`

**Rules locked:** truncate >8k chars with `[truncated, use --full]` (mirrors `gh-axi/src/snapshot.ts`), definitive `0 droplets` empty (exit 0), `--full` disables truncation, `--fields` selects subset (Principle 2/3). Aggregates are additive not verbose: `count`, plus one domain-specific bucket (`status`, `engine`) per list, not per-field matrix.

**Artifact:** `prototype/toon-samples.md` — throwaway prototype for human reaction; approved as "4 fields + aggregates".
