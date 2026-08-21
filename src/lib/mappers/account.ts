// account mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str } from "./common.js";

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
