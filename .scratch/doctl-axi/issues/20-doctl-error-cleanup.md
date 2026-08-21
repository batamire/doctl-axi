# 20 — doctl.ts cleanup: merge AUTH_MISSING branches, drop dead _exitCode

**Status:** ready-for-agent

`src/lib/doctl.ts:79-88`: two consecutive ifs return byte-identical `AxiError(detail, "AUTH_MISSING", [...])` — merge conditions. Also the `_exitCode` parameter is accepted and ignored; issue 06's "preserving upstream exit codes" is unimplemented.

Upstream precedent (gh-axi `stack.ts`): exit-code preservation exists only where a consumer needs it, via a `StackError` subclass carrying the raw code, honored in `cli.ts`. Normal errors normalize to 1/2 via `exitCodeForError`.

- [ ] Merge the duplicated AUTH_MISSING branches
- [ ] Delete the ignored `_exitCode` param (simplest) OR implement passthrough gh-axi-style — pick one; deleting is fine for v1
- [ ] `pnpm test` green
