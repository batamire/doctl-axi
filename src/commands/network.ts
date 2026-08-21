import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import {
  toNetworkDomainToon,
  toNetworkRecordToon,
  toNetworkFirewallToon,
  toNetworkLoadBalancerToon,
  toNetworkVpcToon,
  toNetworkPeeringToon,
  toNetworkCdnToon,
  toNetworkCertificateToon,
  toNetworkReservedIpToon,
} from "../lib/toon.js";
import { encode } from "@toon-format/toon";

const KNOWN_FLAGS = new Set([
  "--full",
  "--fields",
  "--context",
  "--help",
  "-h",
]);

const KNOWN_FLAGS_WITH_VALUE = new Set(["--fields", "--context"]);

function rejectUnknownFlags(args: string[], command: string, sub: string): void {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-")) continue;
    if (KNOWN_FLAGS.has(a)) {
      if (KNOWN_FLAGS_WITH_VALUE.has(a)) {
        // value may be next arg or = form handled elsewhere; skip validation of next
        continue;
      }
      continue;
    }
    if (a.startsWith("--fields=") || a.startsWith("--context=")) continue;
    // negated? treat as unknown
    throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", [
      `Run \`doctl-axi ${command} ${sub} --help\` for available flags`,
    ]);
  }
}

function takeBoolFlag(args: string[], flag: string): boolean {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

function takeFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1) {
    const val = args[idx + 1];
    if (val === undefined || val.startsWith("-")) {
      throw new AxiError(`Flag ${flag} requires a value`, "VALIDATION_ERROR", [
        `Run \`doctl-axi network --help\` for usage`,
      ]);
    }
    args.splice(idx, 2);
    return val;
  }
  const prefix = `${flag}=`;
  const foundIndex = args.findIndex((a) => a.startsWith(prefix));
  if (foundIndex !== -1) {
    const raw = args[foundIndex];
    const val = raw.slice(prefix.length);
    args.splice(foundIndex, 1);
    return val;
  }
  return undefined;
}

export const NETWORK_HELP = encode({
  command: "network",
  description: "Manage Network resources (domains, firewalls, VPCs, etc.)",
  usage: "doctl-axi network <subcommand> <verb> [args] [flags]",
  subcommands: {
    domain: "Manage DNS domains",
    record: "Manage DNS records",
    certificate: "Manage certificates",
    firewall: "Manage cloud firewalls",
    "load-balancer": "Manage load balancers",
    vpc: "Manage VPCs",
    peering: "Manage VPC peerings",
    cdn: "Manage CDNs",
    "reserved-ip": "Manage reserved IPs",
  },
  verbs: {
    list: "List resources",
    get: "Retrieve a resource",
    create: "Create a resource",
    delete: "Delete a resource",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display",
    "--context": "doctl context name",
    "--help": "Show help for a command",
  },
  examples: [
    "doctl-axi network domain list",
    "doctl-axi network record list example.com",
    "doctl-axi network firewall list --fields id,name",
    "doctl-axi network vpc list --full",
  ],
});

const SUBCOMMANDS = [
  "domain",
  "record",
  "certificate",
  "firewall",
  "load-balancer",
  "vpc",
  "peering",
  "cdn",
  "reserved-ip",
] as const;
type Sub = typeof SUBCOMMANDS[number];
const KNOWN_SUBS = new Set<string>(SUBCOMMANDS);

const VERBS = ["list", "get", "create", "delete"] as const;
const KNOWN_VERBS = new Set<string>(VERBS);

const DOMAIN_FIELDS = ["name", "ttl", "records"];
const RECORD_FIELDS = ["id", "type", "name", "data", "ttl"];
const FIREWALL_FIELDS = ["id", "name", "status"];
const LB_FIELDS = ["id", "name", "region", "status"];
const VPC_FIELDS = ["id", "name", "region", "ipRange"];
const PEERING_FIELDS = ["id", "name", "status", "vpcIds"];
const CDN_FIELDS = ["id", "origin", "endpoint", "ttl"];
const CERT_FIELDS = ["id", "name", "state", "type"];
const RIP_FIELDS = ["ip", "region", "dropletId"];

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) return v;
    }
    // some doctl returns object with single item for get
    // treat object itself as single-item if it looks like a record (has id or name)
    if ("id" in obj || "name" in obj || "ip" in obj || "domain" in obj || "origin" in obj) {
      return [raw];
    }
  }
  return [];
}

function parseFieldsArg(fieldsArg: string | undefined, allowed: string[], sub: string, verb: string): string[] | null {
  if (fieldsArg === undefined) return null;
  const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
  if (requested.length === 0) {
    throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", [
      `Available: ${allowed.join(",")}`,
    ]);
  }
  for (const f of requested) {
    if (!allowed.includes(f)) {
      throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", [
        `Available: ${allowed.join(",")}`,
      ]);
    }
  }
  return requested;
}

function filterByFields<T extends Record<string, unknown>>(items: T[], fields: string[] | null): Record<string, unknown>[] {
  if (!fields) return items as unknown as Record<string, unknown>[];
  return items.map((it) => {
    const obj: Record<string, unknown> = {};
    for (const f of fields) obj[f] = it[f];
    return obj;
  });
}

export async function networkCommand(args: string[], _context: unknown): Promise<string> {
  // top-level --help
  if (args.length === 0 || args.includes("--help") && args.length === 1 || args.includes("-h") && args.length === 1) {
    // if args is exactly --help or empty, show help
    if (args.length === 0) {
      throw new AxiError("Missing subcommand for network", "VALIDATION_ERROR", [
        `Available: ${SUBCOMMANDS.join(", ")}`,
        "Run `doctl-axi network --help`",
      ]);
    }
    // args contains help flag and no sub? Already handled missing sub below
  }
  // Check if first arg is help flag
  if (args[0] === "--help" || args[0] === "-h") {
    return NETWORK_HELP;
  }

  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    throw new AxiError("Missing subcommand for network", "VALIDATION_ERROR", [
      `Available: ${SUBCOMMANDS.join(", ")}`,
      "Run `doctl-axi network --help`",
    ]);
  }
  if (!KNOWN_SUBS.has(sub)) {
    throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
      `Available: ${SUBCOMMANDS.join(", ")}`,
      "Run `doctl-axi network --help`",
    ]);
  }

  const remaining = args.slice(1);
  // sub-level help: network domain --help
  if (remaining.length === 1 && (remaining[0] === "--help" || remaining[0] === "-h")) {
    return NETWORK_HELP;
  }
  if (remaining.length === 0) {
    throw new AxiError(`Missing verb for network ${sub}`, "VALIDATION_ERROR", [
      `Available: ${VERBS.join(", ")}`,
      `Run \`doctl-axi network ${sub} --help\``,
    ]);
  }

  const verb = remaining[0];
  if (verb.startsWith("-")) {
    throw new AxiError(`Missing verb for network ${sub}`, "VALIDATION_ERROR", [
      `Available: ${VERBS.join(", ")}`,
      `Run \`doctl-axi network ${sub} --help\``,
    ]);
  }
  if (!KNOWN_VERBS.has(verb)) {
    throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [
      `Available: ${VERBS.join(", ")}`,
      `Run \`doctl-axi network ${sub} --help\``,
    ]);
  }

  const verbArgs = remaining.slice(1);

  // verb-level help
  if (verbArgs.includes("--help") || verbArgs.includes("-h")) {
    // if verbArgs only contains help, return network help
    if (verbArgs.length === 1) return NETWORK_HELP;
    // otherwise strip help and treat as help request (return help)
    if (verbArgs.length === 1 && (verbArgs[0] === "--help" || verbArgs[0] === "-h")) return NETWORK_HELP;
  }
  // Early help detection: if any --help in verbArgs and no other logic, return help
  if (verbArgs.includes("--help") || verbArgs.includes("-h")) {
    // if help flag present among verbArgs, return help (after validating unknown flags? skip)
    return NETWORK_HELP;
  }

  switch (sub as Sub) {
    case "domain":
      return handleDomain(verb, verbArgs, sub);
    case "record":
      return handleRecord(verb, verbArgs, sub);
    case "certificate":
      return handleCertificate(verb, verbArgs, sub);
    case "firewall":
      return handleFirewall(verb, verbArgs, sub);
    case "load-balancer":
      return handleLoadBalancer(verb, verbArgs, sub);
    case "vpc":
      return handleVpc(verb, verbArgs, sub);
    case "peering":
      return handlePeering(verb, verbArgs, sub);
    case "cdn":
      return handleCdn(verb, verbArgs, sub);
    case "reserved-ip":
      return handleReservedIp(verb, verbArgs, sub);
    default:
      throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
        `Available: ${SUBCOMMANDS.join(", ")}`,
      ]);
  }
}

async function handleDomain(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      `Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`,
    ]);
  }
  const fields = parseFieldsArg(fieldsArg, DOMAIN_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length > 0) {
      throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [
        `Run \`doctl-axi network ${sub} ${verb} --help\``,
      ]);
    }
    const raw = await doctlJson<unknown>(["compute", "domain", "list"], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network domains";
    const mapped = arr.map((item) => toNetworkDomainToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    const payload: Record<string, unknown> = {
      count: `${mapped.length} total`,
      domains: filtered,
      help: [`network domain get ${mapped[0].name} for detail`, "doctl-axi network domain list --full for complete fields"],
    };
    return encode(payload);
  }
  if (verb === "get") {
    if (args.length === 0) throw new AxiError("Missing domain name for get", "VALIDATION_ERROR", [`Run \`doctl-axi network domain get --help\``]);
    if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network domain get --help\``]);
    const domain = args[0];
    const raw = await doctlJson<unknown>(["compute", "domain", "get", domain], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkDomainToon(item as Record<string, unknown> as never, full);
    const filtered = filterByFields([mapped as unknown as Record<string, unknown>], fields);
    return encode({ domain: filtered[0], help: ["doctl-axi network domain list --full for complete fields"] });
  }
  if (verb === "create") {
    if (args.length === 0) throw new AxiError("Missing domain name for create", "VALIDATION_ERROR", [`Run \`doctl-axi network domain create --help\``]);
    const domain = args[0];
    const extra = args.slice(1);
    const raw = await doctlJson<unknown>(["compute", "domain", "create", domain, ...extra], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkDomainToon(item as Record<string, unknown> as never, full);
    return encode({ domain: mapped, help: ["doctl-axi network domain list", "doctl-axi network domain get " + domain + " for detail"] });
  }
  if (verb === "delete") {
    if (args.length === 0) throw new AxiError("Missing domain name for delete", "VALIDATION_ERROR", [`Run \`doctl-axi network domain delete --help\``]);
    const domain = args[0];
    // doctl delete requires --force to avoid prompt; add if not present
    const raw = await doctlJson<unknown>(["compute", "domain", "delete", domain, "--force"], contextFlag);
    return encode({ deleted: domain, help: ["doctl-axi network domain list"] });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}

async function handleRecord(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      `Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`,
    ]);
  }
  const fields = parseFieldsArg(fieldsArg, RECORD_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length === 0) throw new AxiError("Missing domain for record list", "VALIDATION_ERROR", [`Run \`doctl-axi network record list --help\``]);
    const domain = args[0];
    if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network record list --help\``]);
    const raw = await doctlJson<unknown>(["compute", "domain", "records", "list", domain], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network records";
    const mapped = arr.map((item) => toNetworkRecordToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    const payload: Record<string, unknown> = {
      count: `${mapped.length} total`,
      records: filtered,
      help: ["doctl-axi network record list --full for complete fields"],
    };
    return encode(payload);
  }
  if (verb === "get") {
    if (args.length < 2) throw new AxiError("Missing arguments for record get: <domain> <record-id>", "VALIDATION_ERROR", [`Run \`doctl-axi network record get --help\``]);
    const domain = args[0];
    const id = args[1];
    // doctl has no `compute domain records get <domain> <id>` verb; fallback to list+filter is the correct contract.
    // We fetch the domain's records and filter by id locally, returning the matched record or the raw payload if not found.
    const raw = await doctlJson<unknown>(["compute", "domain", "records", "list", domain], contextFlag);
    const arr = extractArray(raw);
    const found = arr.find((it) => {
      if (it && typeof it === "object" && "id" in (it as Record<string, unknown>)) {
        const v = (it as Record<string, unknown>)["id"];
        return String(v) === String(id);
      }
      return false;
    }) ?? raw;
    const mapped = toNetworkRecordToon(found as Record<string, unknown> as never, full);
    return encode({ record: mapped, help: ["doctl-axi network record list " + domain] });
  }
  if (verb === "create") {
    if (args.length === 0) throw new AxiError("Missing domain for record create", "VALIDATION_ERROR", [`Run \`doctl-axi network record create --help\``]);
    const domain = args[0];
    const extra = args.slice(1);
    const raw = await doctlJson<unknown>(["compute", "domain", "records", "create", domain, ...extra], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkRecordToon(item as Record<string, unknown> as never, full);
    return encode({ record: mapped });
  }
  if (verb === "delete") {
    if (args.length < 2) throw new AxiError("Missing arguments for record delete: <domain> <record-id>", "VALIDATION_ERROR", [`Run \`doctl-axi network record delete --help\``]);
    const domain = args[0];
    const id = args[1];
    await doctlJson<unknown>(["compute", "domain", "records", "delete", domain, id], contextFlag);
    return encode({ deleted: id, help: ["doctl-axi network record list " + domain] });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}

async function handleFirewall(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`]);
  const fields = parseFieldsArg(fieldsArg, FIREWALL_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\``]);
    const raw = await doctlJson<unknown>(["compute", "firewall", "list"], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network firewalls";
    const mapped = arr.map((item) => toNetworkFirewallToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    return encode({ count: `${mapped.length} total`, firewalls: filtered, help: ["doctl-axi network firewall list --full for complete fields"] });
  }
  if (verb === "get") {
    if (args.length === 0) throw new AxiError("Missing id for firewall get", "VALIDATION_ERROR", [`Run \`doctl-axi network firewall get --help\``]);
    const id = args[0];
    const raw = await doctlJson<unknown>(["compute", "firewall", "get", id], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkFirewallToon(item as Record<string, unknown> as never, full);
    return encode({ firewall: mapped });
  }
  if (verb === "create") {
    const raw = await doctlJson<unknown>(["compute", "firewall", "create", ...args], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkFirewallToon(item as Record<string, unknown> as never, full);
    return encode({ firewall: mapped });
  }
  if (verb === "delete") {
    if (args.length === 0) throw new AxiError("Missing id for firewall delete", "VALIDATION_ERROR", [`Run \`doctl-axi network firewall delete --help\``]);
    const id = args[0];
    await doctlJson<unknown>(["compute", "firewall", "delete", id, "--force"], contextFlag);
    return encode({ deleted: id, help: ["doctl-axi network firewall list"] });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}

async function handleLoadBalancer(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`]);
  const fields = parseFieldsArg(fieldsArg, LB_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\``]);
    const raw = await doctlJson<unknown>(["compute", "load-balancer", "list"], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network load-balancers";
    const mapped = arr.map((item) => toNetworkLoadBalancerToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    return encode({ count: `${mapped.length} total`, load_balancers: filtered, help: ["doctl-axi network load-balancer list --full for complete fields"] });
  }
  if (verb === "get") {
    if (args.length === 0) throw new AxiError("Missing id for load-balancer get", "VALIDATION_ERROR", [`Run \`doctl-axi network load-balancer get --help\``]);
    const id = args[0];
    const raw = await doctlJson<unknown>(["compute", "load-balancer", "get", id], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkLoadBalancerToon(item as Record<string, unknown> as never, full);
    return encode({ load_balancer: mapped });
  }
  if (verb === "create") {
    const raw = await doctlJson<unknown>(["compute", "load-balancer", "create", ...args], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkLoadBalancerToon(item as Record<string, unknown> as never, full);
    return encode({ load_balancer: mapped });
  }
  if (verb === "delete") {
    if (args.length === 0) throw new AxiError("Missing id for load-balancer delete", "VALIDATION_ERROR", [`Run \`doctl-axi network load-balancer delete --help\``]);
    const id = args[0];
    await doctlJson<unknown>(["compute", "load-balancer", "delete", id, "--force"], contextFlag);
    return encode({ deleted: id });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}

async function handleVpc(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`]);
  const fields = parseFieldsArg(fieldsArg, VPC_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\``]);
    const raw = await doctlJson<unknown>(["vpcs", "list"], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network vpcs";
    const mapped = arr.map((item) => toNetworkVpcToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    return encode({ count: `${mapped.length} total`, vpcs: filtered, help: ["doctl-axi network vpc list --full for complete fields"] });
  }
  if (verb === "get") {
    if (args.length === 0) throw new AxiError("Missing id for vpc get", "VALIDATION_ERROR", [`Run \`doctl-axi network vpc get --help\``]);
    const id = args[0];
    const raw = await doctlJson<unknown>(["vpcs", "get", id], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkVpcToon(item as Record<string, unknown> as never, full);
    return encode({ vpc: mapped });
  }
  if (verb === "create") {
    const raw = await doctlJson<unknown>(["vpcs", "create", ...args], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkVpcToon(item as Record<string, unknown> as never, full);
    return encode({ vpc: mapped });
  }
  if (verb === "delete") {
    if (args.length === 0) throw new AxiError("Missing id for vpc delete", "VALIDATION_ERROR", [`Run \`doctl-axi network vpc delete --help\``]);
    const id = args[0];
    await doctlJson<unknown>(["vpcs", "delete", id, "--force"], contextFlag);
    return encode({ deleted: id });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}

async function handlePeering(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`]);
  const fields = parseFieldsArg(fieldsArg, PEERING_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\``]);
    const raw = await doctlJson<unknown>(["vpcs", "peerings", "list"], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network peerings";
    const mapped = arr.map((item) => toNetworkPeeringToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    return encode({ count: `${mapped.length} total`, peerings: filtered, help: ["doctl-axi network peering list --full for complete fields"] });
  }
  if (verb === "get") {
    if (args.length === 0) throw new AxiError("Missing id for peering get", "VALIDATION_ERROR", [`Run \`doctl-axi network peering get --help\``]);
    const id = args[0];
    const raw = await doctlJson<unknown>(["vpcs", "peerings", "get", id], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkPeeringToon(item as Record<string, unknown> as never, full);
    return encode({ peering: mapped });
  }
  if (verb === "create") {
    const raw = await doctlJson<unknown>(["vpcs", "peerings", "create", ...args], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkPeeringToon(item as Record<string, unknown> as never, full);
    return encode({ peering: mapped });
  }
  if (verb === "delete") {
    if (args.length === 0) throw new AxiError("Missing id for peering delete", "VALIDATION_ERROR", [`Run \`doctl-axi network peering delete --help\``]);
    const id = args[0];
    await doctlJson<unknown>(["vpcs", "peerings", "delete", id, "--force"], contextFlag);
    return encode({ deleted: id });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}

async function handleCdn(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`]);
  const fields = parseFieldsArg(fieldsArg, CDN_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\``]);
    const raw = await doctlJson<unknown>(["compute", "cdn", "list"], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network cdns";
    const mapped = arr.map((item) => toNetworkCdnToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    return encode({ count: `${mapped.length} total`, cdns: filtered, help: ["doctl-axi network cdn list --full for complete fields"] });
  }
  if (verb === "get") {
    if (args.length === 0) throw new AxiError("Missing id for cdn get", "VALIDATION_ERROR", [`Run \`doctl-axi network cdn get --help\``]);
    const id = args[0];
    const raw = await doctlJson<unknown>(["compute", "cdn", "get", id], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkCdnToon(item as Record<string, unknown> as never, full);
    return encode({ cdn: mapped });
  }
  if (verb === "create") {
    const raw = await doctlJson<unknown>(["compute", "cdn", "create", ...args], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkCdnToon(item as Record<string, unknown> as never, full);
    return encode({ cdn: mapped });
  }
  if (verb === "delete") {
    if (args.length === 0) throw new AxiError("Missing id for cdn delete", "VALIDATION_ERROR", [`Run \`doctl-axi network cdn delete --help\``]);
    const id = args[0];
    await doctlJson<unknown>(["compute", "cdn", "delete", id, "--force"], contextFlag);
    return encode({ deleted: id });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}

async function handleCertificate(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`]);
  const fields = parseFieldsArg(fieldsArg, CERT_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\``]);
    const raw = await doctlJson<unknown>(["compute", "certificate", "list"], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network certificates";
    const mapped = arr.map((item) => toNetworkCertificateToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    return encode({ count: `${mapped.length} total`, certificates: filtered, help: ["doctl-axi network certificate list --full for complete fields"] });
  }
  if (verb === "get") {
    if (args.length === 0) throw new AxiError("Missing id for certificate get", "VALIDATION_ERROR", [`Run \`doctl-axi network certificate get --help\``]);
    const id = args[0];
    const raw = await doctlJson<unknown>(["compute", "certificate", "get", id], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkCertificateToon(item as Record<string, unknown> as never, full);
    return encode({ certificate: mapped });
  }
  if (verb === "create") {
    const raw = await doctlJson<unknown>(["compute", "certificate", "create", ...args], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkCertificateToon(item as Record<string, unknown> as never, full);
    return encode({ certificate: mapped });
  }
  if (verb === "delete") {
    if (args.length === 0) throw new AxiError("Missing id for certificate delete", "VALIDATION_ERROR", [`Run \`doctl-axi network certificate delete --help\``]);
    const id = args[0];
    await doctlJson<unknown>(["compute", "certificate", "delete", id, "--force"], contextFlag);
    return encode({ deleted: id });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}

async function handleReservedIp(verb: string, rawArgs: string[], sub: string): Promise<string> {
  rejectUnknownFlags(rawArgs, "network", `${sub} ${verb}`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\` for available flags`]);
  const fields = parseFieldsArg(fieldsArg, RIP_FIELDS, sub, verb);
  if (verb === "list") {
    if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [`Run \`doctl-axi network ${sub} ${verb} --help\``]);
    const raw = await doctlJson<unknown>(["compute", "reserved-ip", "list"], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return "0 network reserved-ips";
    const mapped = arr.map((item) => toNetworkReservedIpToon(item as Record<string, unknown> as never, full));
    const filtered = filterByFields(mapped as unknown as Record<string, unknown>[], fields);
    return encode({ count: `${mapped.length} total`, reserved_ips: filtered, help: ["doctl-axi network reserved-ip list --full for complete fields"] });
  }
  if (verb === "get") {
    if (args.length === 0) throw new AxiError("Missing ip for reserved-ip get", "VALIDATION_ERROR", [`Run \`doctl-axi network reserved-ip get --help\``]);
    const ip = args[0];
    const raw = await doctlJson<unknown>(["compute", "reserved-ip", "get", ip], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkReservedIpToon(item as Record<string, unknown> as never, full);
    return encode({ reserved_ip: mapped });
  }
  if (verb === "create") {
    const raw = await doctlJson<unknown>(["compute", "reserved-ip", "create", ...args], contextFlag);
    const arr = extractArray(raw);
    const item = arr[0] ?? raw;
    const mapped = toNetworkReservedIpToon(item as Record<string, unknown> as never, full);
    return encode({ reserved_ip: mapped });
  }
  if (verb === "delete") {
    if (args.length === 0) throw new AxiError("Missing ip for reserved-ip delete", "VALIDATION_ERROR", [`Run \`doctl-axi network reserved-ip delete --help\``]);
    const ip = args[0];
    await doctlJson<unknown>(["compute", "reserved-ip", "delete", ip, "--force"], contextFlag);
    return encode({ deleted: ip });
  }
  throw new AxiError(`Unknown verb: ${verb}`, "VALIDATION_ERROR", [`Available: ${VERBS.join(", ")}`]);
}
