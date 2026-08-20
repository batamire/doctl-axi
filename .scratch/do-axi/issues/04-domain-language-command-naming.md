# Domain language & command naming

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Lock the ubiquitous language for `do-axi`: what is a **Product / Service / Resource** in DO terms, and how does it map to CLI nouns? Decide: `droplet` vs `droplets`, `database` vs `dbaas` vs `db`, `k8s` vs `doks`, `app` vs `apps`, `space` vs `spaces`, `networking` subdomains (`domain`, `firewall`, `vpc`, `cdn` as subcommands or flat?). Align with `doctl` naming and `gh-axi` conventions (`issue`, `pr`, `run` singular) and produce glossary for `CONTEXT.md` + canonical command table (including rejected aliases under _Avoid_). Needs tickets 01+02 — inventory + AXI naming conventions.

## Notes

- Invoke `/domain-modeling` in session; write `CONTEXT.md` incrementally as terms resolve.
- One 100k-token session; grill one question at a time, challenge overloaded `account`/`project` terms.

## Answer

Resolved 2026-08-20. Grilling completed in-session (3 questions).

**Decisions:**
- **Singular canonicals** (gh-axi style): `droplet` not `droplets`, `app` not `apps`, `database` not `dbaas/db`, `kubernetes` (alias `k8s`/`doks`) not bare `cluster`, `registry` not `docr`, `space` not `spaces`, `volume`, `nfs`, `function`. Plurals listed under _Avoid_ in CONTEXT.md.
- **Consolidated `network`**: VPC is part of networking (MCP networking README lists VPC + peering inside same service). So `do-axi network domain|record|certificate|firewall|load-balancer|vpc|peering|cdn|reserved-ip` — single noun with subcommands, not scattered top-levels. Verified via research-01 + `pkg/registry/networking/README.md`.
- **K8s+database+registry**: chose vendor-neutral `kubernetes` (alias k8s/doks), `database`, `registry` — aligns with `doctl kubernetes` / `doctl registry` while keeping CLI short via aliases.

**Artifact:** `CONTEXT.md` created at repo root (12 terms + command taxonomy). All terms tight (1-2 sentences), grouped with _Avoid_ lists per CONTEXT-FORMAT.md. Command taxonomy covers 10+ canonicals + deferred gap domains.

**Gists for map:** `Singular gh-axi-style nouns + consolidated network (vpc under network) + kubernetes/database/registry canonicals → CONTEXT.md written.`
