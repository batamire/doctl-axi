import { AxiError } from "axi-sdk-js";
import { doctlDelete, doctlJson } from "../lib/doctl.js";
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
import { projectFields } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];


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
const KNOWN_SUBS = new Set<string>(SUBCOMMANDS);

const VERBS = ["list", "get", "create", "delete"] as const;
const KNOWN_VERBS = new Set<string>(VERBS);


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


export async function networkCommand(args: string[], _context: unknown): Promise<string> {
  if (args.length === 0) {
    throw new AxiError("Missing subcommand for network", "VALIDATION_ERROR", [
      `Available: ${SUBCOMMANDS.join(", ")}`,
      "Run `doctl-axi network --help`",
    ]);
  }
  if (args[0] === "--help" || args[0] === "-h") return NETWORK_HELP;

  const sub = args[0];
  if (sub.startsWith("-")) {
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
  if (remaining.length === 0) {
    throw new AxiError(`Missing verb for network ${sub}`, "VALIDATION_ERROR", [
      `Available: ${VERBS.join(", ")}`,
      `Run \`doctl-axi network ${sub} --help\``,
    ]);
  }
  // sub-level help: network domain --help
  if (remaining.length === 1 && (remaining[0] === "--help" || remaining[0] === "-h")) {
    return NETWORK_HELP;
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
  return handleSubResource(verb as Verb, verbArgs, SUBRESOURCES[sub]);
}

// The nine network subcommands share one verb surface (list|get|create|delete);
// they differ only in the doctl path, row mapper, allowed --fields, envelope
// keys, positional arity, and a few per-sub quirks captured below.
type Verb = (typeof VERBS)[number];

type SubResourceConfig = {
  sub: string;
  /** doctl path segments preceding the verb segment */
  path: string[];
  /** allowed --fields values */
  fields: string[];
  /** maps a raw doctl record onto its TOON row */
  toToon: (raw: never, full: boolean) => unknown;
  /** envelope key for the list payload / every other payload */
  listKey: string;
  singularKey: string;
  /** definitive empty-list output */
  zeroLine: string;
  /** [min, max?] positionals per verb; max omitted = unbounded */
  arity: Partial<Record<Verb, [number, number] | [number]>>;
  /** exact error message when a verb falls under its minimum positionals */
  missing: Partial<Record<Verb, string>>;
  /** contextual help lines appended to envelopes */
  help: (verb: Verb, positionals: string[], rows: Record<string, unknown>[]) => string[];
  /** get projects the mapped record through --fields (domain) */
  projectGet?: boolean;
  /** get lists the parent's records and matches the id locally (record) */
  matchById?: boolean;
  /** delete omits doctl's --force flag (record) */
  omitForce?: boolean;
  /** successful delete carries a help line (domain/record/firewall only) */
  deleteSuccessHelp?: boolean;
  /** extra payload keys merged into the already-deleted response */
  alreadyExtra?: (positionals: string[]) => Record<string, unknown>;
};

// firewall/load-balancer/vpc/peering/cdn/certificate/reserved-ip take a single
// id positional ("ip" for reserved-ip) and share identical verb behavior.
function idStyle(
  sub: string,
  path: string[],
  fields: string[],
  toToon: SubResourceConfig["toToon"],
  listKey: string,
  singularKey: string,
  idNoun: string,
): SubResourceConfig {
  return {
    sub,
    path,
    fields,
    toToon,
    listKey,
    singularKey,
    zeroLine: `0 network ${sub}s`,
    arity: { list: [0], get: [1], create: [0], delete: [1] },
    missing: {
      get: `Missing ${idNoun} for ${sub} get`,
      delete: `Missing ${idNoun} for ${sub} delete`,
    },
    help: (verb) =>
      verb === "list"
        ? [`doctl-axi network ${sub} list --full for complete fields`]
        : verb === "delete"
          ? [`doctl-axi network ${sub} list`]
          : [],
  };
}

const SUBRESOURCES: Record<string, SubResourceConfig> = {
  domain: {
    sub: "domain",
    path: ["compute", "domain"],
    fields: ["name", "ttl", "records"],
    toToon: toNetworkDomainToon,
    listKey: "domains",
    singularKey: "domain",
    zeroLine: "0 network domains",
    arity: { list: [0], get: [1, 1], create: [1], delete: [1] },
    missing: {
      get: "Missing domain name for get",
      create: "Missing domain name for create",
      delete: "Missing domain name for delete",
    },
    help: (verb, pos, rows) => {
      if (verb === "list") {
        return [`network domain get ${String(rows[0]?.name)} for detail`, "doctl-axi network domain list --full for complete fields"];
      }
      if (verb === "get") return ["doctl-axi network domain list --full for complete fields"];
      if (verb === "create") return ["doctl-axi network domain list", `doctl-axi network domain get ${pos[0]} for detail`];
      return ["doctl-axi network domain list"];
    },
    projectGet: true,
    deleteSuccessHelp: true,
  },
  record: {
    sub: "record",
    path: ["compute", "domain", "records"],
    fields: ["id", "type", "name", "data", "ttl"],
    toToon: toNetworkRecordToon,
    listKey: "records",
    singularKey: "record",
    zeroLine: "0 network records",
    arity: { list: [1, 1], get: [2], create: [1], delete: [2] },
    missing: {
      list: "Missing domain for record list",
      get: "Missing arguments for record get: <domain> <record-id>",
      create: "Missing domain for record create",
      delete: "Missing arguments for record delete: <domain> <record-id>",
    },
    help: (verb, pos) => {
      if (verb === "list") return ["doctl-axi network record list --full for complete fields"];
      if (verb === "create") return [];
      return pos.length > 0 ? [`doctl-axi network record list ${pos[0]}`] : [];
    },
    matchById: true,
    omitForce: true,
    deleteSuccessHelp: true,
    alreadyExtra: (pos) => ({ domain: pos[0] }),
  },
  certificate: idStyle("certificate", ["compute", "certificate"], ["id", "name", "state", "type"], toNetworkCertificateToon, "certificates", "certificate", "id"),
  firewall: {
    ...idStyle("firewall", ["compute", "firewall"], ["id", "name", "status"], toNetworkFirewallToon, "firewalls", "firewall", "id"),
    deleteSuccessHelp: true,
  },
  "load-balancer": idStyle("load-balancer", ["compute", "load-balancer"], ["id", "name", "region", "status"], toNetworkLoadBalancerToon, "load_balancers", "load_balancer", "id"),
  vpc: idStyle("vpc", ["vpcs"], ["id", "name", "region", "ipRange"], toNetworkVpcToon, "vpcs", "vpc", "id"),
  peering: idStyle("peering", ["vpcs", "peerings"], ["id", "name", "status", "vpcIds"], toNetworkPeeringToon, "peerings", "peering", "id"),
  cdn: idStyle("cdn", ["compute", "cdn"], ["id", "origin", "endpoint", "ttl"], toNetworkCdnToon, "cdns", "cdn", "id"),
  "reserved-ip": idStyle("reserved-ip", ["compute", "reserved-ip"], ["ip", "region", "dropletId"], toNetworkReservedIpToon, "reserved_ips", "reserved_ip", "ip"),
};

async function handleSubResource(verb: Verb, rawArgs: string[], cfg: SubResourceConfig): Promise<string> {
  const hint = `Run \`doctl-axi network ${cfg.sub} ${verb} --help\``;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, `${hint} for available flags`);
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [`${hint} for available flags`]);
  }
  const fields = parseFields(fieldsArg, cfg.fields);

  const [minArgs, maxArgs] = cfg.arity[verb] ?? [0];
  if (args.length < minArgs) throw new AxiError(cfg.missing[verb]!, "VALIDATION_ERROR", [hint]);
  if (maxArgs !== undefined && args.length > maxArgs) {
    throw new AxiError(`Unexpected argument: ${args[maxArgs]}`, "VALIDATION_ERROR", [hint]);
  }

  const mapRow = (item: unknown): Record<string, unknown> =>
    cfg.toToon(item as Record<string, unknown> as never, full) as Record<string, unknown>;

  if (verb === "list") {
    const raw = await doctlJson<unknown>([...cfg.path, "list", ...args], contextFlag);
    const arr = extractArray(raw);
    if (arr.length === 0) return cfg.zeroLine;
    const mapped = arr.map((item) => mapRow(item));
    const filtered = projectFields(mapped, fields);
    return encode({ count: `${mapped.length} total`, [cfg.listKey]: filtered, help: cfg.help("list", args, mapped) });
  }
  if (verb === "get") {
    if (cfg.matchById) {
      // doctl has no `compute domain records get <domain> <id>` verb; fetch the
      // domain's records and match by id locally, returning the matched record
      // or the raw payload if not found.
      const [parent, id] = args;
      const raw = await doctlJson<unknown>([...cfg.path, "list", parent], contextFlag);
      const arr = extractArray(raw);
      const found =
        arr.find((it) => {
          if (it && typeof it === "object" && "id" in (it as Record<string, unknown>)) {
            return String((it as Record<string, unknown>)["id"]) === String(id);
          }
          return false;
        }) ?? raw;
      return encode({ [cfg.singularKey]: mapRow(found), help: cfg.help("get", args, []) });
    }
    const raw = await doctlJson<unknown>([...cfg.path, "get", ...args.slice(0, minArgs)], contextFlag);
    const arr = extractArray(raw);
    const mapped = mapRow(arr[0] ?? raw);
    if (cfg.projectGet) {
      const filtered = projectFields([mapped], fields)[0];
      return encode({ [cfg.singularKey]: filtered, help: cfg.help("get", args, [mapped]) });
    }
    return encode({ [cfg.singularKey]: mapped });
  }
  if (verb === "create") {
    const raw = await doctlJson<unknown>([...cfg.path, "create", ...args], contextFlag);
    const arr = extractArray(raw);
    const mapped = mapRow(arr[0] ?? raw);
    const help = cfg.help("create", args, [mapped]);
    return help.length > 0 ? encode({ [cfg.singularKey]: mapped, help }) : encode({ [cfg.singularKey]: mapped });
  }

  // delete
  const ids = args.slice(0, minArgs);
  const argv = [...cfg.path, "delete", ...ids];
  // doctl delete requires --force to avoid prompt; add unless the sub omits it
  if (!cfg.omitForce) argv.push("--force");
  const deletedId = ids[ids.length - 1];
  const raw = await doctlDelete<unknown>(argv, contextFlag);
  if (raw === null) {
    return encode({
      delete: "already_deleted",
      [cfg.singularKey]: deletedId,
      ...(cfg.alreadyExtra?.(args) ?? {}),
      help: cfg.help("delete", args, []),
    });
  }
  if (cfg.deleteSuccessHelp) return encode({ deleted: deletedId, help: cfg.help("delete", args, []) });
  return encode({ deleted: deletedId });
}
