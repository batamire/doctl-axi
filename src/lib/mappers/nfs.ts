// nfs mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val, extractAt } from "./common.js";

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
