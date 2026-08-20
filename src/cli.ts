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
import { buildDashboardPayload } from "./lib/dashboard.js";
export const DESCRIPTION = "Agent-ergonomic CLI for DigitalOcean — one AXI wrapping doctl → TOON";
export const TOP_HELP = encode({
  usage: "do-axi <command> [args] [flags]",
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
    setup: "Manage do-axi setup including ambient hooks",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display",
    "--context": "doctl context name",
    "--help": "Show help for a command",
    "--version": "Show version",
  },
  examples: [
    "do-axi droplet list",
    "do-axi droplet list --fields id,name",
    "do-axi droplet list --full",
    "do-axi kubernetes cluster list",
    "do-axi database list",
    "do-axi network domain list",
    "do-axi volume list",
    "do-axi space key list",
    "do-axi dedicated-inference list",
    "do-axi insight uptime list",
    "do-axi marketplace list",
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
};

const COMMANDS: Record<string, (args: string[], ctx: unknown) => Promise<string>> = {
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
};
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

async function homeCommand(): Promise<string> {
  const payload = await buildDashboardPayload();
  return encode(payload);
}

export async function main(): Promise<void> {
  await runAxiCli({
    description: DESCRIPTION,
    version: VERSION,
    topLevelHelp: `${TOP_HELP}\n`,
    commands: COMMANDS,
    home: homeCommand,
    getCommandHelp,
    formatError,
  });
}
