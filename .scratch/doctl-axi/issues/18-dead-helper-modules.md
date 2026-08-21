# 18 — Route commands through toon helpers; delete dead output modules

**Status:** ready-for-agent

Three "shared helper" surfaces exist while commands inline the logic anyway:

- `src/lib/format.ts` (`formatCountLine`/`formatStatusAggregate`) — zero importers
- `src/lib/toon.ts` exports `encodeDropletList`/`filterFields`/`encodeErrorToon` — zero external callers
- `src/commands/droplet.ts:170-183` hand-rolls the exact payload `encodeDropletList` builds (`status: \`active ${active}/${mapped.length}\`` ≡ `toon.ts:96-97`)

Reference: gh-axi routes ALL command output through `toon.ts` renderers; commands never hand-roll payloads.

- [ ] Either route droplet list through `encodeDropletList` or delete it — no third state
- [ ] Delete unused `format.ts` and unused toon exports (or wire them; pick per actual call sites)
- [ ] `pnpm test` green
