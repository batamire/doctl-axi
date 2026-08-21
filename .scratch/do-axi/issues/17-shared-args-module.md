# 17 — Extract shared args module (flag-parsing trio ×14)

**Status:** ready-for-agent

`rejectUnknownFlags`/`takeBoolFlag`/`takeFlagValue` are copy-pasted into all 14 files in `src/commands/` with drifting variants: `droplet.ts` handles `--` and skips `--help/-h` inside the loop; `volume.ts` does neither there but handles help at call sites; error text differs (`flag ${flag} requires a value` vs `Missing value for ${flag}`). One shared `src/lib/args.ts` deletes ~40 lines × 14 and unifies unknown-flag rejection semantics.

Reference implementation: `.slim/clonedeps/repos/kunchenguid__gh-axi/src/args.ts` (single module, centralized `rejectUnknownFlags`, `--`/`-h` pass-through).

- [ ] Create `src/lib/args.ts` with the trio + one canonical unknown-flag error message
- [ ] Migrate all 14 command files to import from it; delete local copies
- [ ] Pick one behavior for `--` / in-loop `--help` handling (droplet's is the superset) and apply everywhere
- [ ] `pnpm test` green (131+)
