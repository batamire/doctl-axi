# AGENTS.md

## Agent skills

### Issue tracker

Local markdown — issues live as files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

## Cloned Dependency Source

Read-only dependency source repositories are available under
`.slim/clonedeps/repos/` for inspection. Do not edit these clones.

- `.slim/clonedeps/repos/kunchenguid__axi/` — `axi` at `main`; framework repo
  with `axi-sdk-js` (runAxiCli, AxiError, built-in self-update, setup hooks)
  that doctl-axi's design follows.
- `.slim/clonedeps/repos/kunchenguid__gh-axi/` — `gh-axi` at `main`; reference
  AXI example showing shared args/toon/fields/errors modules and idempotent
  mutations.
- `.slim/clonedeps/repos/kunchenguid__chrome-devtools-axi/` —
  `chrome-devtools-axi` at `main`; second reference AXI example (session
  verbs, suggestions engine, SDK built-in update wiring).
