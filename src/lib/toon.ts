import { encode } from "@toon-format/toon";

export const TRUNCATION_LIMIT = 8000;

export function truncateField(value: string, full: boolean): string {
  if (full) return value;
  if (value.length <= TRUNCATION_LIMIT) return value;
  const truncated = value.length - TRUNCATION_LIMIT;
  return `${value.slice(0, TRUNCATION_LIMIT)}... [truncated ${truncated} chars, use --full]`;
}

// Project each row onto the requested fields, preserving the requested order.
// `fields === null` means no --fields was given: rows pass through untouched.
export function projectFields<T extends Record<string, unknown>>(rows: T[], fields: string[] | null): T[] {
  if (!fields) return rows;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const f of fields) obj[f] = row[f];
    return obj as T;
  });
}

// Field coercion for mappers: `str` keeps a value only when it is already a
// string; `val` stringifies anything non-nullish. Both yield "" otherwise.
function str(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v : "";
}

function val(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return v === undefined || v === null ? "" : String(v);
}

// Single shared path-extraction helper. Walks `path` through nested objects;
// a string encountered at any level is terminal; an object at the end of the
// path yields its `slug` when that is a string. Replaces the per-noun
// extract*Region family.
function extractAt(raw: unknown, full: boolean, ...path: string[]): string {
  let cur: unknown = raw;
  for (const key of path) {
    if (typeof cur === "string") return truncateField(cur, full);
    if (!cur || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[key];
  }
  if (typeof cur === "string") return truncateField(cur, full);
  const obj = cur as Record<string, unknown> | null;
  if (obj && typeof obj.slug === "string") return truncateField(obj.slug, full);
  return "";
}

export type DropletRaw = {
  id?: number | string;
  name?: string;
  region?: string | { slug?: string; name?: string };
  status?: string;
  size_slug?: string;
  size?: string | { slug?: string };
  [key: string]: unknown;
};

export type DropletToon = {
  id: string;
  name: string;
  region: string;
  status: string;
  size: string;
};

function extractSize(raw: DropletRaw, full: boolean): string {
  if (typeof raw.size_slug === "string") return truncateField(raw.size_slug, full);
  const s = raw.size;
  if (typeof s === "string") return truncateField(s, full);
  if (s && typeof s === "object" && "slug" in s) {
    const slug = (s as { slug?: unknown }).slug;
    if (typeof slug === "string") return truncateField(slug, full);
  }
  return "";
}

export function toDropletToon(raw: DropletRaw, full: boolean): DropletToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    region: extractAt(raw, full, "region"),
    status: truncateField(str(raw, "status"), full),
    size: extractSize(raw, full),
  };
}

export type DropletDetailRaw = DropletRaw & {
  memory?: number | string;
  vcpus?: number | string;
  disk?: number | string;
};

export type DropletDetailToon = DropletToon & {
  memory: string;
  vcpus: string;
  disk: string;
};

function extractResourceCount(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  if (typeof v === "number") return String(v);
  if (typeof v === "string" && v.length > 0) return v;
  return "";
}

export function toDropletDetailToon(raw: DropletDetailRaw, full: boolean): DropletDetailToon {
  const base = toDropletToon(raw, full);
  return {
    ...base,
    memory: truncateField(extractResourceCount(raw, "memory"), full),
    vcpus: truncateField(extractResourceCount(raw, "vcpus"), full),
    disk: truncateField(extractResourceCount(raw, "disk"), full),
  };
}

// ---- Volume ----

export type VolumeRaw = {
  id?: string | number;
  name?: string;
  region?: string | { slug?: string };
  size_gigabytes?: number | string;
  size?: number | string;
  status?: string;
  [key: string]: unknown;
};

export type VolumeToon = {
  id: string;
  name: string;
  region: string;
  size: string;
  status: string;
};

export function toVolumeToon(raw: VolumeRaw, full: boolean): VolumeToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    region: extractAt(raw, full, "region"),
    size: truncateField(String(raw.size_gigabytes ?? raw.size ?? ""), full),
    status: truncateField(str(raw, "status"), full),
  };
}

// ---- NFS ----

export type NfsRaw = {
  id?: string | number;
  name?: string;
  region?: string | { slug?: string };
  status?: string;
  size?: string | number;
  [key: string]: unknown;
};

export type NfsToon = {
  id: string;
  name: string;
  region: string;
  status: string;
};

export function toNfsToon(raw: NfsRaw, full: boolean): NfsToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    region: extractAt(raw, full, "region"),
    status: truncateField(str(raw, "status"), full),
  };
}

// ---- Space Keys ----

export type SpaceKeyRaw = {
  name?: string;
  access_key?: string;
  accessKey?: string;
  accessKeyId?: string;
  created_at?: string;
  created?: string;
  creation_date?: string;
  [key: string]: unknown;
};

export type SpaceKeyToon = {
  name: string;
  accessKey: string;
  created: string;
};

export function toSpaceKeyToon(raw: SpaceKeyRaw, full: boolean): SpaceKeyToon {
  return {
    name: truncateField(str(raw, "name"), full),
    accessKey: truncateField(String(raw.access_key ?? raw.accessKey ?? raw.accessKeyId ?? ""), full),
    created: truncateField(String(raw.created_at ?? raw.created ?? raw.creation_date ?? ""), full),
  };
}

// ---- Dedicated Inference ----

export type DedicatedInferenceRaw = {
  id?: string | number;
  name?: string;
  region?: string | { slug?: string };
  status?: string;
  [key: string]: unknown;
};

export type DedicatedInferenceToon = {
  id: string;
  name: string;
  region: string;
  status: string;
};

export function toDedicatedInferenceToon(raw: DedicatedInferenceRaw, full: boolean): DedicatedInferenceToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    region: extractAt(raw, full, "region"),
    status: truncateField(str(raw, "status"), full),
  };
}

// ---- Insight Uptime ----

export type InsightRaw = {
  id?: string | number;
  name?: string;
  status?: string;
  target?: string;
  endpoint?: string;
  check_type?: string;
  [key: string]: unknown;
};

export type InsightToon = {
  id: string;
  name: string;
  status: string;
  target: string;
};

export function toInsightToon(raw: InsightRaw, full: boolean): InsightToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    status: truncateField(str(raw, "status"), full),
    target: truncateField(String(raw.target ?? raw.endpoint ?? raw.check_type ?? ""), full),
  };
}

// ---- Marketplace (1-click) ----

export type MarketplaceRaw = {
  slug?: string;
  name?: string;
  type?: string;
  id?: string | number;
  [key: string]: unknown;
};

export type MarketplaceToon = {
  slug: string;
  name: string;
  type: string;
};

export function toMarketplaceToon(raw: MarketplaceRaw, full: boolean): MarketplaceToon {
  const slug = raw.slug;
  return {
    slug: truncateField(typeof slug === "string" ? slug : String(raw.id ?? ""), full),
    name: truncateField(str(raw, "name"), full),
    type: truncateField(str(raw, "type"), full),
  };
}

// ---- Region ----

export type RegionRaw = {
  slug?: string;
  name?: string;
  available?: boolean | string;
  [key: string]: unknown;
};

export type RegionToon = {
  slug: string;
  name: string;
  available: string;
};

export function toRegionToon(raw: RegionRaw, full: boolean): RegionToon {
  return {
    slug: truncateField(str(raw, "slug"), full),
    name: truncateField(str(raw, "name"), full),
    available: truncateField(val(raw, "available"), full),
  };
}

// ---- Account ----

export type AccountRaw = {
  email?: string;
  uuid?: string;
  status?: string;
  droplet_limit?: number | string;
  dropletLimit?: number | string;
  [key: string]: unknown;
};

export type AccountToon = {
  email: string;
  uuid: string;
  status: string;
  dropletLimit: string;
};

export function toAccountToon(raw: AccountRaw, full: boolean): AccountToon {
  return {
    email: truncateField(str(raw, "email"), full),
    uuid: truncateField(str(raw, "uuid"), full),
    status: truncateField(str(raw, "status"), full),
    dropletLimit: truncateField(String(raw.droplet_limit ?? raw.dropletLimit ?? ""), full),
  };
}

// ---- Balance ----

export type BalanceRaw = {
  month_to_date_balance?: string;
  monthToDateBalance?: string;
  account_balance?: string;
  accountBalance?: string;
  generated_at?: string;
  [key: string]: unknown;
};

export type BalanceToon = {
  monthToDateBalance: string;
  accountBalance: string;
  generatedAt: string;
};

export function toBalanceToon(raw: BalanceRaw, full: boolean): BalanceToon {
  return {
    monthToDateBalance: truncateField(String(raw.month_to_date_balance ?? raw.monthToDateBalance ?? ""), full),
    accountBalance: truncateField(String(raw.account_balance ?? raw.accountBalance ?? ""), full),
    generatedAt: truncateField(String(raw.generated_at ?? raw.generatedAt ?? ""), full),
  };
}
export type NetworkDomainRaw = {
  name?: string;
  domain?: string;
  ttl?: number | string;
  records?: number | string;
  zone_file?: string;
  [key: string]: unknown;
};

export type NetworkDomainToon = {
  name: string;
  ttl: string;
  records: string;
};

export type NetworkRecordRaw = {
  id?: number | string;
  type?: string;
  name?: string;
  data?: string;
  ttl?: number | string;
  [key: string]: unknown;
};

export type NetworkRecordToon = {
  id: string;
  type: string;
  name: string;
  data: string;
  ttl: string;
};

export type NetworkFirewallRaw = {
  id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type NetworkFirewallToon = {
  id: string;
  name: string;
  status: string;
};

export type NetworkLoadBalancerRaw = {
  id?: string;
  name?: string;
  region?: string | { slug?: string };
  status?: string;
  [key: string]: unknown;
};

export type NetworkLoadBalancerToon = {
  id: string;
  name: string;
  region: string;
  status: string;
};

export type NetworkVpcRaw = {
  id?: string;
  name?: string;
  region?: string;
  ip_range?: string;
  ipRange?: string;
  [key: string]: unknown;
};

export type NetworkVpcToon = {
  id: string;
  name: string;
  region: string;
  ipRange: string;
};

export type NetworkPeeringRaw = {
  id?: string;
  name?: string;
  status?: string;
  vpc_ids?: string[];
  vpcIds?: string[];
  [key: string]: unknown;
};

export type NetworkPeeringToon = {
  id: string;
  name: string;
  status: string;
  vpcIds: string;
};

export type NetworkCdnRaw = {
  id?: string;
  origin?: string;
  endpoint?: string;
  ttl?: number | string;
  [key: string]: unknown;
};

export type NetworkCdnToon = {
  id: string;
  origin: string;
  endpoint: string;
  ttl: string;
};

export type NetworkCertificateRaw = {
  id?: string;
  name?: string;
  state?: string;
  type?: string;
  [key: string]: unknown;
};

export type NetworkCertificateToon = {
  id: string;
  name: string;
  state: string;
  type: string;
};

export type NetworkReservedIpRaw = {
  ip?: string;
  region?: string | { slug?: string; name?: string };
  droplet?: { id?: number | string } | null;
  droplet_id?: number | string;
  [key: string]: unknown;
};

export type NetworkReservedIpToon = {
  ip: string;
  region: string;
  dropletId: string;
};

export function toNetworkDomainToon(raw: NetworkDomainRaw, full: boolean): NetworkDomainToon {
  const name = typeof raw.name === "string" ? raw.name : str(raw, "domain");
  return {
    name: truncateField(name, full),
    ttl: truncateField(val(raw, "ttl"), full),
    records: truncateField(val(raw, "records"), full),
  };
}

export function toNetworkRecordToon(raw: NetworkRecordRaw, full: boolean): NetworkRecordToon {
  return {
    id: truncateField(val(raw, "id"), full),
    type: truncateField(str(raw, "type"), full),
    name: truncateField(str(raw, "name"), full),
    data: truncateField(str(raw, "data"), full),
    ttl: truncateField(val(raw, "ttl"), full),
  };
}

export function toNetworkFirewallToon(raw: NetworkFirewallRaw, full: boolean): NetworkFirewallToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    status: truncateField(str(raw, "status"), full),
  };
}

export function toNetworkLoadBalancerToon(raw: NetworkLoadBalancerRaw, full: boolean): NetworkLoadBalancerToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    region: extractAt(raw, full, "region"),
    status: truncateField(str(raw, "status"), full),
  };
}

export function toNetworkVpcToon(raw: NetworkVpcRaw, full: boolean): NetworkVpcToon {
  const ipRange = typeof raw.ip_range === "string" ? raw.ip_range : str(raw, "ipRange");
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    region: truncateField(str(raw, "region"), full),
    ipRange: truncateField(ipRange, full),
  };
}

export function toNetworkPeeringToon(raw: NetworkPeeringRaw, full: boolean): NetworkPeeringToon {
  const vpcIds = Array.isArray(raw.vpc_ids) ? raw.vpc_ids.join(",") : Array.isArray(raw.vpcIds) ? (raw.vpcIds as string[]).join(",") : typeof raw.vpc_ids === "string" ? raw.vpc_ids : "";
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    status: truncateField(str(raw, "status"), full),
    vpcIds: truncateField(vpcIds, full),
  };
}

export function toNetworkCdnToon(raw: NetworkCdnRaw, full: boolean): NetworkCdnToon {
  return {
    id: truncateField(val(raw, "id"), full),
    origin: truncateField(str(raw, "origin"), full),
    endpoint: truncateField(str(raw, "endpoint"), full),
    ttl: truncateField(val(raw, "ttl"), full),
  };
}

export function toNetworkCertificateToon(raw: NetworkCertificateRaw, full: boolean): NetworkCertificateToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    state: truncateField(str(raw, "state"), full),
    type: truncateField(str(raw, "type"), full),
  };
}

export function toNetworkReservedIpToon(raw: NetworkReservedIpRaw, full: boolean): NetworkReservedIpToon {
  let dropletId = "";
  if (raw.droplet && typeof raw.droplet === "object" && "id" in raw.droplet) {
    const did = (raw.droplet as { id?: unknown }).id;
    if (did !== undefined && did !== null) dropletId = String(did);
  } else if (raw.droplet_id !== undefined && raw.droplet_id !== null) {
    dropletId = String(raw.droplet_id);
  } else if (typeof raw.droplet === "string") dropletId = raw.droplet;
  return {
    ip: truncateField(str(raw, "ip"), full),
    region: extractAt(raw, full, "region"),
    dropletId: truncateField(dropletId, full),
  };
}
// ---- App ----

export type AppRaw = {
  id?: string;
  spec?: { name?: string };
  name?: string;
  region?: string | { slug?: string; label?: string };
  tier_slug?: string;
  active_deployment?: { id?: string; phase?: string } | null;
  activeDeployment?: { id?: string; phase?: string } | null;
  phase?: string;
  [key: string]: unknown;
};

export type AppToon = {
  id: string;
  name: string;
  region: string;
  phase: string;
  activeDeployment: string;
};

function extractAppName(raw: AppRaw, full: boolean): string {
  if (typeof raw.name === "string") return truncateField(raw.name, full);
  if (raw.spec && typeof raw.spec === "object" && "name" in raw.spec) {
    const n = (raw.spec as { name?: unknown }).name;
    if (typeof n === "string") return truncateField(n, full);
  }
  return "";
}

function extractAppPhase(raw: AppRaw, full: boolean): string {
  const ad = raw.active_deployment ?? raw.activeDeployment;
  if (ad && typeof ad === "object" && "phase" in (ad as Record<string, unknown>)) {
    const p = (ad as { phase?: unknown }).phase;
    if (typeof p === "string") return truncateField(p, full);
  }
  if (typeof raw.phase === "string") return truncateField(raw.phase, full);
  return "";
}

function extractAppActiveDeployment(raw: AppRaw, full: boolean): string {
  const ad = raw.active_deployment ?? raw.activeDeployment;
  if (ad && typeof ad === "object" && "id" in (ad as Record<string, unknown>)) {
    const id = (ad as { id?: unknown }).id;
    if (id !== undefined && id !== null) return truncateField(String(id), full);
  }
  return "";
}

export function toAppToon(raw: AppRaw, full: boolean): AppToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: extractAppName(raw, full),
    region: extractAt(raw, full, "region"),
    phase: extractAppPhase(raw, full),
    activeDeployment: extractAppActiveDeployment(raw, full),
  };
}

// ---- App Deployment ----

export type AppDeploymentRaw = {
  id?: string;
  phase?: string;
  cause?: string;
  progress?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type AppDeploymentToon = {
  id: string;
  phase: string;
  cause: string;
  progress: string;
};

export function toAppDeploymentToon(raw: AppDeploymentRaw, full: boolean): AppDeploymentToon {
  return {
    id: truncateField(val(raw, "id"), full),
    phase: truncateField(str(raw, "phase"), full),
    cause: truncateField(str(raw, "cause"), full),
    progress: truncateField(str(raw, "progress"), full),
  };
}

// ---- Registry Repository ----

export type RegistryRepositoryRaw = {
  name?: string;
  registry_name?: string;
  registryName?: string;
  tag_count?: number | string;
  tagCount?: number | string;
  manifest_count?: number | string;
  manifestCount?: number | string;
  [key: string]: unknown;
};

export type RegistryRepositoryToon = {
  name: string;
  registry: string;
  tagCount: string;
  manifestCount: string;
};

export function toRegistryRepositoryToon(raw: RegistryRepositoryRaw, full: boolean): RegistryRepositoryToon {
  return {
    name: truncateField(str(raw, "name"), full),
    registry: truncateField(String(raw.registry_name ?? raw.registryName ?? ""), full),
    tagCount: truncateField(String(raw.tag_count ?? raw.tagCount ?? ""), full),
    manifestCount: truncateField(String(raw.manifest_count ?? raw.manifestCount ?? ""), full),
  };
}

// ---- Registry Tag ----

export type RegistryTagRaw = {
  repository?: string;
  repo?: string;
  tag?: string;
  manifest_digest?: string;
  manifestDigest?: string;
  digest?: string;
  updated_at?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type RegistryTagToon = {
  repository: string;
  tag: string;
  digest: string;
  updatedAt: string;
};

export function toRegistryTagToon(raw: RegistryTagRaw, full: boolean): RegistryTagToon {
  return {
    repository: truncateField(String(raw.repository ?? raw.repo ?? ""), full),
    tag: truncateField(val(raw, "tag"), full),
    digest: truncateField(String(raw.manifest_digest ?? raw.manifestDigest ?? raw.digest ?? ""), full),
    updatedAt: truncateField(String(raw.updated_at ?? raw.updatedAt ?? ""), full),
  };
}

// ---- Registry Manifest ----

export type RegistryManifestRaw = {
  repository?: string;
  repo?: string;
  digest?: string;
  tags?: string[] | string;
  size_bytes?: number | string;
  sizeBytes?: number | string;
  compressed_size_bytes?: number | string;
  compressedSizeBytes?: number | string;
  updated_at?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type RegistryManifestToon = {
  repository: string;
  digest: string;
  tags: string;
  size: string;
};

export function toRegistryManifestToon(raw: RegistryManifestRaw, full: boolean): RegistryManifestToon {
  const tags = Array.isArray(raw.tags) ? raw.tags.join(",") : typeof raw.tags === "string" ? raw.tags : "";
  return {
    repository: truncateField(String(raw.repository ?? raw.repo ?? ""), full),
    digest: truncateField(val(raw, "digest"), full),
    tags: truncateField(tags, full),
    size: truncateField(String(raw.size_bytes ?? raw.sizeBytes ?? raw.compressed_size_bytes ?? raw.compressedSizeBytes ?? ""), full),
  };
}

// ---- Registry Garbage Collection ----

export type RegistryGCRaw = {
  uuid?: string;
  id?: string;
  registry_name?: string;
  registryName?: string;
  status?: string;
  blobs_deleted?: number | string;
  blobsDeleted?: number | string;
  created_at?: string;
  [key: string]: unknown;
};

export type RegistryGCToon = {
  id: string;
  registry: string;
  status: string;
  blobsDeleted: string;
};

export function toRegistryGCToon(raw: RegistryGCRaw, full: boolean): RegistryGCToon {
  return {
    id: truncateField(String(raw.uuid ?? raw.id ?? ""), full),
    registry: truncateField(String(raw.registry_name ?? raw.registryName ?? ""), full),
    status: truncateField(str(raw, "status"), full),
    blobsDeleted: truncateField(String(raw.blobs_deleted ?? raw.blobsDeleted ?? ""), full),
  };
}


// ---- Kubernetes ----

export type KubernetesRaw = {
  id?: string;
  name?: string;
  region?: string | { slug?: string };
  status?: string;
  version?: string;
  [key: string]: unknown;
};

export type KubernetesToon = {
  id: string;
  name: string;
  region: string;
  status: string;
};

export type DatabaseRaw = {
  id?: string;
  name?: string;
  engine?: string;
  version?: string | number;
  region?: string;
  status?: string;
  [key: string]: unknown;
};

export type DatabaseToon = {
  id: string;
  name: string;
  engine: string;
  version: string;
  region: string;
  status: string;
};

export type NodePoolRaw = {
  id?: string;
  name?: string;
  size?: string;
  count?: number;
  status?: string;
  [key: string]: unknown;
};

export type NodePoolToon = {
  id: string;
  name: string;
  size: string;
  count: string;
  status: string;
};

export function toKubernetesToon(raw: KubernetesRaw, full: boolean): KubernetesToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    region: extractAt(raw, full, "region"),
    status: truncateField(str(raw, "status"), full),
  };
}

export function toDatabaseToon(raw: DatabaseRaw, full: boolean): DatabaseToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    engine: truncateField(str(raw, "engine"), full),
    version: truncateField(val(raw, "version"), full),
    region: truncateField(str(raw, "region"), full),
    status: truncateField(str(raw, "status"), full),
  };
}

// ---- Database Sub-resources ----
// Mappers for database users/topics/pools. Field-mapped on purpose: raw doctl
// records carry credentials (user.password) and bloat we never print.

export type DatabaseUserRaw = {
  name?: string;
  role?: string;
  type?: string;
  [key: string]: unknown;
};

export type DatabaseUserToon = {
  name: string;
  role: string;
  type: string;
};

export function toDatabaseUserToon(raw: DatabaseUserRaw, full: boolean): DatabaseUserToon {
  return {
    name: truncateField(str(raw, "name"), full),
    role: truncateField(str(raw, "role"), full),
    type: truncateField(str(raw, "type"), full),
  };
}

export type DatabaseTopicRaw = {
  name?: string;
  state?: string;
  partitions?: number | string;
  [key: string]: unknown;
};

export type DatabaseTopicToon = {
  name: string;
  state: string;
  partitions: string;
};

export function toDatabaseTopicToon(raw: DatabaseTopicRaw, full: boolean): DatabaseTopicToon {
  return {
    name: truncateField(str(raw, "name"), full),
    state: truncateField(str(raw, "state"), full),
    partitions: truncateField(val(raw, "partitions"), full),
  };
}

export type DatabasePoolRaw = {
  name?: string;
  mode?: string;
  size?: number | string;
  [key: string]: unknown;
};

export type DatabasePoolToon = {
  name: string;
  mode: string;
  size: string;
};

export function toDatabasePoolToon(raw: DatabasePoolRaw, full: boolean): DatabasePoolToon {
  return {
    name: truncateField(str(raw, "name"), full),
    mode: truncateField(str(raw, "mode"), full),
    size: truncateField(val(raw, "size"), full),
  };
}

export function toNodePoolToon(raw: NodePoolRaw, full: boolean): NodePoolToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    size: truncateField(str(raw, "size"), full),
    count: truncateField(val(raw, "count"), full),
    status: truncateField(str(raw, "status"), full),
  };
}

