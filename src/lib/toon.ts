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
  const idRaw = raw.id;
  const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const region = extractAt(raw, full, "region");
  const statusRaw = typeof raw.status === "string" ? raw.status : "";
  const size = extractSize(raw, full);

  const out: DropletToon = {
    id: truncateField(id, full),
    name: truncateField(nameRaw, full),
    region,
    status: truncateField(statusRaw, full),
    size,
  };
  return out;
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

function extractVolumeSize(raw: VolumeRaw, full: boolean): string {
  const sz = raw.size_gigabytes ?? raw.size;
  if (sz !== undefined && sz !== null) return truncateField(String(sz), full);
  return "";
}

export function toVolumeToon(raw: VolumeRaw, full: boolean): VolumeToon {
  const idRaw = raw.id;
  const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : "";
  return {
    id: truncateField(id, full),
    name: truncateField(typeof raw.name === "string" ? raw.name : "", full),
    region: extractAt(raw, full, "region"),
    size: extractVolumeSize(raw, full),
    status: truncateField(typeof raw.status === "string" ? raw.status : "", full),
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
  const idRaw = raw.id;
  return {
    id: truncateField(String(idRaw ?? ""), full),
    name: truncateField(typeof raw.name === "string" ? raw.name : "", full),
    region: extractAt(raw, full, "region"),
    status: truncateField(typeof raw.status === "string" ? raw.status : "", full),
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

function extractSpaceCreated(raw: SpaceKeyRaw, full: boolean): string {
  const v = raw.created_at ?? raw.created ?? raw.creation_date;
  if (typeof v === "string") return truncateField(v, full);
  if (v !== undefined && v !== null) return truncateField(String(v), full);
  return "";
}

export function toSpaceKeyToon(raw: SpaceKeyRaw, full: boolean): SpaceKeyToon {
  const access = raw.access_key ?? raw.accessKey ?? raw.accessKeyId;
  return {
    name: truncateField(typeof raw.name === "string" ? raw.name : "", full),
    accessKey: truncateField(access !== undefined && access !== null ? String(access) : "", full),
    created: extractSpaceCreated(raw, full),
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
  const idRaw = raw.id;
  return {
    id: truncateField(String(idRaw ?? ""), full),
    name: truncateField(typeof raw.name === "string" ? raw.name : "", full),
    region: extractAt(raw, full, "region"),
    status: truncateField(typeof raw.status === "string" ? raw.status : "", full),
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
  const idRaw = raw.id;
  const tgt = raw.target ?? raw.endpoint ?? raw.check_type;
  return {
    id: truncateField(String(idRaw ?? ""), full),
    name: truncateField(typeof raw.name === "string" ? raw.name : "", full),
    status: truncateField(typeof raw.status === "string" ? raw.status : "", full),
    target: truncateField(tgt !== undefined && tgt !== null ? String(tgt) : "", full),
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
  return {
    slug: truncateField(typeof raw.slug === "string" ? raw.slug : String(raw.id ?? ""), full),
    name: truncateField(typeof raw.name === "string" ? raw.name : "", full),
    type: truncateField(typeof raw.type === "string" ? raw.type : "", full),
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
  const avail = raw.available;
  return {
    slug: truncateField(typeof raw.slug === "string" ? raw.slug : "", full),
    name: truncateField(typeof raw.name === "string" ? raw.name : "", full),
    available: truncateField(avail !== undefined && avail !== null ? String(avail) : "", full),
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
  const limit = raw.droplet_limit ?? raw.dropletLimit;
  return {
    email: truncateField(typeof raw.email === "string" ? raw.email : "", full),
    uuid: truncateField(typeof raw.uuid === "string" ? raw.uuid : "", full),
    status: truncateField(typeof raw.status === "string" ? raw.status : "", full),
    dropletLimit: truncateField(limit !== undefined && limit !== null ? String(limit) : "", full),
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
  const mtd = raw.month_to_date_balance ?? raw.monthToDateBalance;
  const acct = raw.account_balance ?? raw.accountBalance;
  const gen = raw.generated_at ?? (raw as Record<string, unknown>).generatedAt;
  return {
    monthToDateBalance: truncateField(mtd !== undefined && mtd !== null ? String(mtd) : "", full),
    accountBalance: truncateField(acct !== undefined && acct !== null ? String(acct) : "", full),
    generatedAt: truncateField(gen !== undefined && gen !== null ? String(gen as string) : "", full),
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
  const nameRaw = typeof raw.name === "string" ? raw.name : typeof raw.domain === "string" ? raw.domain : "";
  const ttlRaw = raw.ttl !== undefined && raw.ttl !== null ? String(raw.ttl) : "";
  const recRaw = raw.records !== undefined && raw.records !== null ? String(raw.records) : "";
  return {
    name: truncateField(nameRaw, full),
    ttl: truncateField(ttlRaw, full),
    records: truncateField(recRaw, full),
  };
}

export function toNetworkRecordToon(raw: NetworkRecordRaw, full: boolean): NetworkRecordToon {
  const idRaw = raw.id !== undefined && raw.id !== null ? String(raw.id) : "";
  const typeRaw = typeof raw.type === "string" ? raw.type : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const dataRaw = typeof raw.data === "string" ? raw.data : "";
  const ttlRaw = raw.ttl !== undefined && raw.ttl !== null ? String(raw.ttl) : "";
  return {
    id: truncateField(idRaw, full),
    type: truncateField(typeRaw, full),
    name: truncateField(nameRaw, full),
    data: truncateField(dataRaw, full),
    ttl: truncateField(ttlRaw, full),
  };
}

export function toNetworkFirewallToon(raw: NetworkFirewallRaw, full: boolean): NetworkFirewallToon {
  const idRaw = raw.id !== undefined && raw.id !== null ? String(raw.id) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const statusRaw = typeof raw.status === "string" ? raw.status : "";
  return {
    id: truncateField(idRaw, full),
    name: truncateField(nameRaw, full),
    status: truncateField(statusRaw, full),
  };
}

export function toNetworkLoadBalancerToon(raw: NetworkLoadBalancerRaw, full: boolean): NetworkLoadBalancerToon {
  const idRaw = raw.id !== undefined && raw.id !== null ? String(raw.id) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const region = extractAt(raw, full, "region");
  const statusRaw = typeof raw.status === "string" ? raw.status : "";
  return {
    id: truncateField(idRaw, full),
    name: truncateField(nameRaw, full),
    region,
    status: truncateField(statusRaw, full),
  };
}

export function toNetworkVpcToon(raw: NetworkVpcRaw, full: boolean): NetworkVpcToon {
  const idRaw = raw.id !== undefined && raw.id !== null ? String(raw.id) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const regionRaw = typeof raw.region === "string" ? raw.region : "";
  const ipRaw = typeof raw.ip_range === "string" ? raw.ip_range : typeof raw.ipRange === "string" ? raw.ipRange : "";
  return {
    id: truncateField(idRaw, full),
    name: truncateField(nameRaw, full),
    region: truncateField(regionRaw, full),
    ipRange: truncateField(ipRaw, full),
  };
}

export function toNetworkPeeringToon(raw: NetworkPeeringRaw, full: boolean): NetworkPeeringToon {
  const idRaw = raw.id !== undefined && raw.id !== null ? String(raw.id) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const statusRaw = typeof raw.status === "string" ? raw.status : "";
  const vpcIdsRaw = Array.isArray(raw.vpc_ids) ? raw.vpc_ids.join(",") : Array.isArray(raw.vpcIds) ? (raw.vpcIds as string[]).join(",") : typeof raw.vpc_ids === "string" ? raw.vpc_ids : "";
  return {
    id: truncateField(idRaw, full),
    name: truncateField(nameRaw, full),
    status: truncateField(statusRaw, full),
    vpcIds: truncateField(vpcIdsRaw, full),
  };
}

export function toNetworkCdnToon(raw: NetworkCdnRaw, full: boolean): NetworkCdnToon {
  const idRaw = raw.id !== undefined && raw.id !== null ? String(raw.id) : "";
  const originRaw = typeof raw.origin === "string" ? raw.origin : "";
  const endpointRaw = typeof raw.endpoint === "string" ? raw.endpoint : "";
  const ttlRaw = raw.ttl !== undefined && raw.ttl !== null ? String(raw.ttl) : "";
  return {
    id: truncateField(idRaw, full),
    origin: truncateField(originRaw, full),
    endpoint: truncateField(endpointRaw, full),
    ttl: truncateField(ttlRaw, full),
  };
}

export function toNetworkCertificateToon(raw: NetworkCertificateRaw, full: boolean): NetworkCertificateToon {
  const idRaw = raw.id !== undefined && raw.id !== null ? String(raw.id) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const stateRaw = typeof raw.state === "string" ? raw.state : "";
  const typeRaw = typeof raw.type === "string" ? raw.type : "";
  return {
    id: truncateField(idRaw, full),
    name: truncateField(nameRaw, full),
    state: truncateField(stateRaw, full),
    type: truncateField(typeRaw, full),
  };
}

export function toNetworkReservedIpToon(raw: NetworkReservedIpRaw, full: boolean): NetworkReservedIpToon {
  const ipRaw = typeof raw.ip === "string" ? raw.ip : "";
  const region = extractAt(raw, full, "region");
  let dropletId = "";
  if (raw.droplet && typeof raw.droplet === "object" && "id" in raw.droplet) {
    const did = (raw.droplet as { id?: unknown }).id;
    if (did !== undefined && did !== null) dropletId = String(did);
  } else if (raw.droplet_id !== undefined && raw.droplet_id !== null) {
    dropletId = String(raw.droplet_id);
  } else if (typeof raw.droplet === "string") dropletId = raw.droplet;
  return {
    ip: truncateField(ipRaw, full),
    region,
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
  const idRaw = raw.id;
  const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : "";
  return {
    id: truncateField(id, full),
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
    id: truncateField(raw.id !== undefined && raw.id !== null ? String(raw.id) : "", full),
    phase: truncateField(typeof raw.phase === "string" ? raw.phase : "", full),
    cause: truncateField(typeof raw.cause === "string" ? raw.cause : "", full),
    progress: truncateField(typeof raw.progress === "string" ? raw.progress : "", full),
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
  const reg = raw.registry_name ?? raw.registryName;
  const tc = raw.tag_count ?? raw.tagCount;
  const mc = raw.manifest_count ?? raw.manifestCount;
  return {
    name: truncateField(typeof raw.name === "string" ? raw.name : "", full),
    registry: truncateField(reg !== undefined && reg !== null ? String(reg) : "", full),
    tagCount: truncateField(tc !== undefined && tc !== null ? String(tc) : "", full),
    manifestCount: truncateField(mc !== undefined && mc !== null ? String(mc) : "", full),
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
  const repo = raw.repository ?? raw.repo;
  const tag = raw.tag;
  const digest = raw.manifest_digest ?? raw.manifestDigest ?? raw.digest;
  const updated = raw.updated_at ?? raw.updatedAt;
  return {
    repository: truncateField(repo !== undefined && repo !== null ? String(repo) : "", full),
    tag: truncateField(typeof tag === "string" ? tag : tag !== undefined && tag !== null ? String(tag) : "", full),
    digest: truncateField(digest !== undefined && digest !== null ? String(digest) : "", full),
    updatedAt: truncateField(typeof updated === "string" ? updated : updated !== undefined && updated !== null ? String(updated) : "", full),
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
  const repo = raw.repository ?? raw.repo;
  const digest = raw.digest;
  const tagsRaw = raw.tags;
  let tags = "";
  if (Array.isArray(tagsRaw)) tags = tagsRaw.join(",");
  else if (typeof tagsRaw === "string") tags = tagsRaw;
  const size = raw.size_bytes ?? raw.sizeBytes ?? raw.compressed_size_bytes ?? raw.compressedSizeBytes;
  return {
    repository: truncateField(repo !== undefined && repo !== null ? String(repo) : "", full),
    digest: truncateField(digest !== undefined && digest !== null ? String(digest) : "", full),
    tags: truncateField(tags, full),
    size: truncateField(size !== undefined && size !== null ? String(size) : "", full),
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
  const id = raw.uuid ?? raw.id;
  const reg = raw.registry_name ?? raw.registryName;
  const bd = raw.blobs_deleted ?? raw.blobsDeleted;
  return {
    id: truncateField(id !== undefined && id !== null ? String(id) : "", full),
    registry: truncateField(reg !== undefined && reg !== null ? String(reg) : "", full),
    status: truncateField(typeof raw.status === "string" ? raw.status : "", full),
    blobsDeleted: truncateField(bd !== undefined && bd !== null ? String(bd) : "", full),
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
  const idRaw = raw.id;
  const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const region = extractAt(raw, full, "region");
  const statusRaw = typeof raw.status === "string" ? raw.status : "";
  return {
    id: truncateField(id, full),
    name: truncateField(nameRaw, full),
    region,
    status: truncateField(statusRaw, full),
  };
}

export function toDatabaseToon(raw: DatabaseRaw, full: boolean): DatabaseToon {
  const idRaw = raw.id;
  const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const engineRaw = typeof raw.engine === "string" ? raw.engine : "";
  const versionRaw = raw.version !== undefined && raw.version !== null ? String(raw.version) : "";
  const regionRaw = typeof raw.region === "string" ? raw.region : "";
  const statusRaw = typeof raw.status === "string" ? raw.status : "";
  return {
    id: truncateField(id, full),
    name: truncateField(nameRaw, full),
    engine: truncateField(engineRaw, full),
    version: truncateField(versionRaw, full),
    region: truncateField(regionRaw, full),
    status: truncateField(statusRaw, full),
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
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const roleRaw = typeof raw.role === "string" ? raw.role : "";
  const typeRaw = typeof raw.type === "string" ? raw.type : "";
  return {
    name: truncateField(nameRaw, full),
    role: truncateField(roleRaw, full),
    type: truncateField(typeRaw, full),
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
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const stateRaw = typeof raw.state === "string" ? raw.state : "";
  const partitionsRaw = raw.partitions !== undefined && raw.partitions !== null ? String(raw.partitions) : "";
  return {
    name: truncateField(nameRaw, full),
    state: truncateField(stateRaw, full),
    partitions: truncateField(partitionsRaw, full),
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
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const modeRaw = typeof raw.mode === "string" ? raw.mode : "";
  const sizeRaw = raw.size !== undefined && raw.size !== null ? String(raw.size) : "";
  return {
    name: truncateField(nameRaw, full),
    mode: truncateField(modeRaw, full),
    size: truncateField(sizeRaw, full),
  };
}

export function toNodePoolToon(raw: NodePoolRaw, full: boolean): NodePoolToon {
  const idRaw = raw.id;
  const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : "";
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const sizeRaw = typeof raw.size === "string" ? raw.size : "";
  const countRaw = raw.count !== undefined && raw.count !== null ? String(raw.count) : "";
  const statusRaw = typeof raw.status === "string" ? raw.status : "";
  return {
    id: truncateField(id, full),
    name: truncateField(nameRaw, full),
    size: truncateField(sizeRaw, full),
    count: truncateField(countRaw, full),
    status: truncateField(statusRaw, full),
  };
}

