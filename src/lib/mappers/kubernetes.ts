// kubernetes mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val, extractAt } from "./common.js";

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

export function toNodePoolToon(raw: NodePoolRaw, full: boolean): NodePoolToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    size: truncateField(str(raw, "size"), full),
    count: truncateField(val(raw, "count"), full),
    status: truncateField(str(raw, "status"), full),
  };
}
