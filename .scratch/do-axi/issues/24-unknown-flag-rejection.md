# 24 — Unknown-flag rejection gaps (story 27 violations)

**Status:** ready-for-agent

Spec story 27: "unknown flags fail fast with validation error, not silent drop". Violations:

- `databaseCreate` comments "do not reject unknown flags for create" and forwards them silently
- `takeSubActionArgs` silently ignores `--fields`
- kubeconfig ignores `--fields`

Depends on ticket 17 (shared args module) landing first so there is one rejection path.

- [ ] Enable `rejectUnknownFlags` on database create and sub-action paths
- [ ] Decide `--fields` semantics per verb: reject where unsupported (or support it); no silent ignore
- [ ] Test: unknown flag → VALIDATION_ERROR exit 2 on every subcommand
