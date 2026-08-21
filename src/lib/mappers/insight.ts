// insight mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val } from "./common.js";

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
