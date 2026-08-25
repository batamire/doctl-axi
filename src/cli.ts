import { runAxiCli, AxiError } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import { VERSION } from "./version.js";
import { dropletCommand, DROPLET_HELP } from "./commands/droplet.js";
import { docsCommand, DOCS_HELP } from "./commands/docs.js";
import { kubernetesCommand, KUBERNETES_HELP } from "./commands/kubernetes.js";
import { databaseCommand, DATABASE_HELP } from "./commands/database.js";
import { networkCommand, NETWORK_HELP } from "./commands/network.js";
import { volumeCommand, VOLUME_HELP } from "./commands/volume.js";
import { nfsCommand, NFS_HELP } from "./commands/nfs.js";
import { spaceCommand, SPACE_HELP } from "./commands/space.js";
import { accountCommand, ACCOUNT_HELP } from "./commands/account.js";
import { balanceCommand, BALANCE_HELP } from "./commands/balance.js";
import { regionCommand, REGION_HELP } from "./commands/region.js";
import { dedicatedInferenceCommand, DEDICATED_INFERENCE_HELP } from "./commands/dedicated-inference.js";
import { insightCommand, INSIGHT_HELP } from "./commands/insight.js";
import { marketplaceCommand, MARKETPLACE_HELP } from "./commands/marketplace.js";
import { appCommand, APP_HELP } from "./commands/app.js";
import { registryCommand, REGISTRY_HELP } from "./commands/registry.js";
import { setupCommand, SETUP_HELP } from "./commands/setup.js";
import { rawCommand, RAW_HELP } from "./commands/raw.js";
import { buildDashboardPayload } from "./lib/dashboard.js";
import { parseContextArgs, type DoctlContext, type ParsedContextArgs } from "./lib/args.js";
export const DESCRIPTION = "Agent-ergonomic CLI for DigitalOcean — one AXI wrapping doctl → TOON";
export const TOP_HELP = encode({
  usage: "doctl-axi <command> [args] [flags]",
  description: DESCRIPTION,
  commands: {
    droplet: "Manage Droplets (virtual machines)",
    kubernetes: "Manage Kubernetes clusters and node pools",
    database: "Manage Database clusters",
    app: "Manage App Platform applications",
    registry: "Manage Container Registry",
    network: "Manage Network resources (domains, firewalls, VPCs, etc.)",
    volume: "Manage block storage volumes",
    nfs: "Manage NFS file shares",
    space: "Manage Spaces access keys",
    account: "Get account information",
    balance: "Get account balance",
    region: "List regions",
    "dedicated-inference": "Manage dedicated inference",
    insight: "Manage insight / uptime checks",
    marketplace: "List marketplace offerings",
    docs: "Search and fetch DigitalOcean documentation (no token required)",
    setup: "Manage doctl-axi setup including ambient hooks",
    raw: "Escape hatch — forward args verbatim to doctl",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display",
    "--context": "doctl context name",
    "--help": "Show help for a command",
    "--version": "Show version",
  },
  examples: [
    "doctl-axi droplet list",
    "doctl-axi droplet list --fields id,name",
    "doctl-axi droplet list --full",
    "doctl-axi kubernetes cluster list",
    "doctl-axi database list",
    "doctl-axi network domain list",
    "doctl-axi volume list",
    "doctl-axi space key list",
    "doctl-axi dedicated-inference list",
    "doctl-axi insight uptime list",
    "doctl-axi marketplace list",
    "doctl-axi raw apps get <id> --format ActiveDeploymentPhase",
  ],
});

const COMMAND_HELP: Record<string, string> = {
  droplet: DROPLET_HELP,
  kubernetes: KUBERNETES_HELP,
  database: DATABASE_HELP,
  app: APP_HELP,
  registry: REGISTRY_HELP,
  network: NETWORK_HELP,
  docs: DOCS_HELP,
  k8s: KUBERNETES_HELP,
  doks: KUBERNETES_HELP,
  volume: VOLUME_HELP,
  nfs: NFS_HELP,
  space: SPACE_HELP,
  account: ACCOUNT_HELP,
  balance: BALANCE_HELP,
  region: REGION_HELP,
  "dedicated-inference": DEDICATED_INFERENCE_HELP,
  insight: INSIGHT_HELP,
  marketplace: MARKETPLACE_HELP,
  setup: SETUP_HELP,
  raw: RAW_HELP,
};

export const COMMANDS: Record<string, (args: string[], ctx?: DoctlContext) => Promise<string>> = {
  droplet: dropletCommand,
  kubernetes: kubernetesCommand,
  k8s: kubernetesCommand,
  doks: kubernetesCommand,
  database: databaseCommand,
  app: appCommand,
  registry: registryCommand,
  network: networkCommand,
  docs: docsCommand,
  volume: volumeCommand,
  nfs: nfsCommand,
  space: spaceCommand,
  account: accountCommand,
  balance: balanceCommand,
  region: regionCommand,
  "dedicated-inference": dedicatedInferenceCommand,
  insight: insightCommand,
  marketplace: marketplaceCommand,
  setup: setupCommand,
  raw: withContext(rawCommand),
};

// Canonical per-noun command summary shared by TOP_HELP consumers and the
// generated skill (src/skill.ts) so advertised commands can never drift.
// The count is derived from COMMANDS (aliases excluded); the noun list and
// verb summaries are hand-written because they carry detail COMMANDS lacks.
const SUMMARY_ALIASES = ["k8s", "doks"];
export const COMMAND_SUMMARY = `commands[${Object.keys(COMMANDS).filter((c) => !SUMMARY_ALIASES.includes(c)).length}]: droplet, kubernetes (alias k8s/doks), database, app, registry, network, volume, nfs, space, account, balance, region, dedicated-inference, insight, marketplace, docs, setup, raw
  droplet: list/get/create/delete + actions (reboot/resize/snapshot)
  kubernetes: cluster list/get/create/delete, kubeconfig <id>, node-pool list/get/create/delete
  database: list/get/create/delete, user/topic/pool/config/firewall
  app: list/get/create/update/delete, list-deployments/get-deployment/create-deployment/logs
  registry: repository list, tag list/get, manifest list, garbage-collection list/get/create/delete
  network: domain/record/certificate/firewall/load-balancer/vpc/peering/cdn/reserved-ip (each list/get/create/delete)
  volume/nfs/space/account: list/get/create/delete (space is keys only)
  docs: search <q>, get <path>, find-for-service, get-quickstart, troubleshoot, get-related (fetch llms.txt, no token, 30m cache)
  setup: hooks, hooks --check
  raw: <doctl args…> — escape hatch forwarding verbatim to doctl`;
type CommandFn = (args: string[], ctx?: DoctlContext) => Promise<string>;

// Strip the global --context flag from args before the subcommand sees them;
// the resolved context is threaded via runAxiCli's ctx parameter instead of
// every subcommand parsing --context itself. The SDK hands the SAME args
// array to resolveContext and the command wrapper, so one WeakMap memo keeps
// the parse to a single run per invocation.
const contextParseCache = new WeakMap<string[], ParsedContextArgs>();
function parsedContextArgs(args: string[]): ParsedContextArgs {
  let parsed = contextParseCache.get(args);
  if (!parsed) {
    parsed = parseContextArgs(args);
    contextParseCache.set(args, parsed);
  }
  return parsed;
}

function withContext(handler: CommandFn): CommandFn {
  return (args, ctx) => handler(parsedContextArgs(args).strippedArgs, ctx);
}
function getCommandHelp(cmd: string): string | null {
  return COMMAND_HELP[cmd] ?? null;
}

function formatError(error: unknown): { output: string; exitCode: number } {
  if (error instanceof AxiError) {
    const code = error.code;
    const finalExit = code === "VALIDATION_ERROR" || code === "AUTH_MISSING" ? 2 : 1;
    const obj: Record<string, unknown> = { error: error.message, code };
    if (error.suggestions.length > 0) obj.help = error.suggestions;
    return { output: `${encode(obj)}\n`, exitCode: finalExit };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { output: `${encode({ error: message, code: "UNKNOWN" })}\n`, exitCode: 1 };
}

async function homeCommand(args: string[], ctx?: DoctlContext): Promise<string> {
  const payload = await buildDashboardPayload(ctx?.context);
  return encode(payload);
}

export async function main(): Promise<void> {
  try {
    await runAxiCli<DoctlContext | undefined>({
      description: DESCRIPTION,
      version: VERSION,
      topLevelHelp: `${TOP_HELP}\n`,
      commands: Object.fromEntries(Object.entries(COMMANDS).map(([name, handler]) => [name, withContext(handler)])),
      home: homeCommand,
      getCommandHelp,
      formatError,
      resolveContext: ({ args }) => {
        const { context } = parsedContextArgs(args);
        return context !== undefined ? { context } : undefined;
      },
    });
  } catch (error) {
    // resolveContext runs outside the SDK's own error handling; keep its
    // failures on the same structured {error,code,help} channel.
    const { output, exitCode } = formatError(error);
    process.stdout.write(output);
    process.exitCode = exitCode;
  }
}
