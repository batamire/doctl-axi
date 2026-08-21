# 19 — Data-driven field mapping (kill 7 region extractors + filter* dupes)

**Status:** ready-for-agent

`src/lib/toon.ts` has seven near-identical `(raw, full) => string` region-coercion helpers — `extractRegion`, `extractVolumeRegion`, `extractNfsRegion`, `extractDIRegion`, `extractNetworkRegion`, `extractAppRegion`, `extractK8sRegion` (lines ~30, 142, 188, 260, 550, 700, 970) — plus `filterKubernetesFields`/`filterDatabaseFields` duplicating `filterFields`.

Reference: gh-axi's `toon.ts` uses a `FieldDef` discriminated union (field/pluck/joinArray/relativeTime/boolYesNo/mapEnum/custom) with ONE `extract(item, schema)` interpreter; per-noun extras are data tables in `fields.ts`. Zero per-noun coercion functions.

- [ ] Introduce a small FieldDef-style schema (or at minimum a shared `extractRegion(raw, full, path)` parameterized by field path)
- [ ] Replace the seven extractors and the two filter* clones
- [ ] `pnpm test` green; TOON output byte-identical (snapshot a few commands before/after)
