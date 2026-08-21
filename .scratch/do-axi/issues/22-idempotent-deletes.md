# 22 — Idempotent deletes: 404 → no-op success (stories 4/31)

**Status:** ready-for-agent

Spec: "retrying a delete after success is a no-op with a clear message, not an error"; "mutations prefer idempotent no-op success when upstream reports 404 on delete". Current `mapDoctlError` maps 404 to `NOT_FOUND` AxiError exit 1; no delete handler catches it.

Reference implementation: `.slim/clonedeps/repos/kunchenguid__gh-axi/src/commands/release.ts:317-349` — pre-check existence; on `NOT_FOUND` return `encode({delete:'already_deleted', tag})` + help as SUCCESS. Same pattern across label/pr/workflow/project/run.

- [ ] Apply the pattern to every delete subcommand (droplet, kubernetes node-pool, database, app, registry, network domain/route/firewall, volume, space, nfs)
- [ ] Test: delete twice → second call exit 0 with `already_deleted`
