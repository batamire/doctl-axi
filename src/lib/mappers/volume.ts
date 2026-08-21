// volume mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val, extractAt } from "./common.js";

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
