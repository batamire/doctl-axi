// region mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val } from "./common.js";

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
