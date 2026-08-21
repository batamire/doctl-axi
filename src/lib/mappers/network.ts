// network mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val, extractAt } from "./common.js";

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
