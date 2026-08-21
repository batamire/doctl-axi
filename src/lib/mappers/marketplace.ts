// marketplace mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str } from "./common.js";

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
