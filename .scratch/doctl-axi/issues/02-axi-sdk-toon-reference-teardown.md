# Teardown: axi-sdk-js + TOON + gh-axi / chrome-devtools-axi pattern

Type: research
Status: resolved
Blocked by:

## Question

Extract the build contract for `do-axi` from the AXI source material: `kunchenguid/axi` principles.yaml + `.agents/skills/axi/SKILL.md`, `axi-sdk-js` API (runAxiCli, home, commands, hooks, suggestions, errors), `@toon-format/toon` encoding, and the two reference AXIs' actual wiring (`gh-axi/src/gh.ts` execFile pattern, `chrome-devtools-axi/src/bridge.ts` MCP persist pattern, `src/cli.ts` command registration, `src/format.ts`/`toon.ts` truncation). Deliver: (a) minimal scaffold checklist to copy for `do-axi`, (b) per-principle implementation note (what `axi-sdk-js` already gives vs what we must build), (c) pitfalls (generation-tagged refs, host handling, stdin secrets pattern). Research only.

## Notes for researcher

- Read `kunchenguid/axi` repo, `kunchenguid/gh-axi`, `kunchenguid/chrome-devtools-axi` via `gh api .../contents`.
- Prefer precise file:line citations.
- Branch hint: `research/axi-sdk-teardown`.

## Answer

Resolved 2026-08-20. Artifact: `.scratch/do-axi/research-02-axi-teardown.md`.

**Findings:** 10 principles extracted; `axi-sdk-js@0.1.10` API is `runAxiCli({description,version,topLevelHelp,commands,home,getCommandHelp,resolveContext})` + `AxiError` + `installSessionStartHooks` (writes `~/.claude/settings.json`, `~/.codex/hooks.json`, opencode plugin). `gh-axi` pattern is template for `do-axi`: `execFile("gh", buildArgs, {maxBuffer:10MB})` → 4 shapes `ghJson/ghExec/ghRaw/ghExecWithStdin` (src/gh.ts:7-95), `FieldDef` DSL + TOON 3-4 fields, aggregates, truncation, ENOENT trap. `chrome-devtools-axi` persistent MCP bridge + anti-rebinding is **not** needed for doctl (process-per-call). Checklist delivered: `src/version.ts` leaf → `bin/do-axi.ts` fast-path → `src/cli.ts` → `src/doctl.ts` (gh.ts port) → errors/format/toon/args → home + per-noun commands → setup/hooks → skills + catalog.

Pitfalls noted: 10MB buffer, --output json vs --format, process.env mutation leak, rejectUnknownFlags, stdin for secrets.
