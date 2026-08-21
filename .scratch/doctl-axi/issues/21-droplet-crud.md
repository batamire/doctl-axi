# 21 — Droplet CRUD: get/create/delete/actions (stories 2-5) + phantom help fix

**Status:** ready-for-agent

Spec stories 2-5 asked for single-droplet get, create, idempotent delete, and actions (reboot/power-cycle/resize/snapshot/rebuild). `src/commands/droplet.ts` implements ONLY `list` and its help disclosure advertises `droplet get <id>` — a command that does not exist.

- [ ] `droplet get <id>` — detail view via TOON field map (help already promises it)
- [ ] `droplet create` — required flags validated, unknown flags rejected
- [ ] `droplet delete <id>` — idempotent per story 4/31 (see ticket 22 pattern)
- [ ] `droplet <action>` — reboot/power-cycle/resize/snapshot/rebuild via `doctl compute droplet-action`
- [ ] Help text generated from the registered command table so advertised == implemented (gh-axi keys COMMAND_HELP exactly to handlers)
