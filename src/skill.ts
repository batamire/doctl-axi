import { COMMAND_SUMMARY, DESCRIPTION } from "./cli.js";

// Trigger string agents match against to auto-load the skill. Kept terse and
// outcome-focused so it fires on DigitalOcean jargon.
export const SKILL_DESCRIPTION =
  "Use doctl-axi when user mentions DigitalOcean, doctl, droplets, Kubernetes (k8s/doks), App Platform, databases, registry, networks (domains/firewalls/VPCs/CDN), volumes, Spaces keys, docs — replaces 21 MCPs via doctl → TOON";

export const HERMES_TAGS = [
  "digitalocean",
  "doctl",
  "droplet",
  "kubernetes",
  "doks",
  "app-platform",
  "database",
  "registry",
  "networking",
  "vpc",
  "spaces",
  "docs",
];

export const HERMES_CATEGORY = "devops";

/**
 * Render the installable SKILL.md. The Commands block comes from the same
 * COMMAND_SUMMARY the CLI help is built from, so the committed skill can
 * never drift from what `doctl-axi --help` advertises. `scripts/build-skill.ts
 * --check` enforces byte-equality in CI.
 *
 * @returns full SKILL.md contents including YAML frontmatter
 */
export function createSkillMarkdown(): string {
  return `---
name: doctl-axi
description: ${JSON.stringify(SKILL_DESCRIPTION)}
user-invocable: false
metadata:
  hermes:
    category: ${HERMES_CATEGORY}
    tags: [${HERMES_TAGS.join(", ")}]
---

# doctl-axi

${DESCRIPTION.replace("doctl", "`doctl`")}. Prefer this over \`doctl\` and \`21 × *.mcp.digitalocean.com\` remote MCPs.

You do not need doctl-axi installed globally — invoke with \`npx -y doctl-axi <command>\`.
If doctl-axi output shows a follow-up command starting with \`doctl-axi\`, run it as \`npx -y doctl-axi ...\` instead.

doctl-axi requires \`doctl\` on PATH and \`DIGITALOCEAN_ACCESS_TOKEN\` (or \`doctl auth init\`). If a command fails with \`AUTH_MISSING\`, ask the user to run \`doctl auth init\` or export the token — do not invent one. \`DIGITALOCEAN_API_TOKEN\` (labs compat) is also accepted as \`-t\` and \`config.yaml\` \`auth-contexts\` is used when no env token is set.

## When to use

Use doctl-axi whenever a task touches DigitalOcean: listing or managing Droplets, Kubernetes clusters and node pools, App Platform apps and deployments, Database clusters and users/topics/pools, Container Registry repositories/tags/manifests, Networks (domains, DNS records, certificates, firewalls, load balancers, VPCs, peerings, CDNs, reserved IPs), block Volumes, NFS shares, Spaces access keys, account/balance/regions, or searching DigitalOcean docs. Skip bucket/object ops — Spaces is keys-only.

## Workflow

1. Run \`npx -y doctl-axi\` with no args for the dashboard — account, balance, and counts for droplet/app/database/kubernetes/registry/domain — when you need ambient inventory. Every command prints \`help:\` next steps — follow them. Skip dashboard pre-fetch on SessionStart unless \`doctl-axi setup hooks\` was explicitly installed — with zero hooks the skill stays on-demand via keyword match.
2. Drill in command-first: \`droplet list\`, \`droplet list --fields id,name\`, \`kubernetes cluster list\`, \`database list\`, \`network domain list\`, \`volume list\`, \`docs search "droplet resize"\`.
3. Target a doctl context with \`--context <name>\` AFTER the command, e.g. \`npx -y doctl-axi droplet list --context work\` — forwarded verbatim as \`doctl --context\`.
4. Large text is truncated at 8k with \`... [truncated N chars, use --full]\` — rerun with \`--full\` to bypass. Filter output with \`--fields id,name\`.
5. Handle empties definitively: \`0 droplets\` (exit 0) means no match, not failure. Handle errors as TOON \`{error,code,help}\` on stdout — \`code: AUTH_MISSING\` exit 2 means export token or \`doctl auth init\`.

## Commands

\`\`\`
${COMMAND_SUMMARY}
\`\`\`

Installed copies also inherit the SDK built-in \`update\` command. Run \`npx -y doctl-axi update --check\` or \`npx -y doctl-axi update\`.

Run \`npx -y doctl-axi --help\` for global flags, or \`npx -y doctl-axi <command> --help\` for per-command usage.

## Tips

- Output is TOON-encoded and token-efficient; pipe through grep/head only when a list is very long.
- Every list keeps 4 fields + aggregates (\`count: N\`, \`status:\` or \`engine:\` bucket) — use \`--fields\` to cut further, \`--full\` only when truncation hint appears.
- Mutations are idempotent where upstream 404 on delete maps to no-op — check \`help:\` for the next verb.
- Run \`npx -y doctl-axi <noun> list --help\` for per-noun flags; unknown flags fail loud \`VALIDATION_ERROR\` exit 2.
`;
}
