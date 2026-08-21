// droplet mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val, extractAt } from "./common.js";

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
