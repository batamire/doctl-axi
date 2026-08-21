// space mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str } from "./common.js";

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

export function toSpaceKeyToon(raw: SpaceKeyRaw, full: boolean): SpaceKeyToon {
  return {
    name: truncateField(str(raw, "name"), full),
    accessKey: truncateField(String(raw.access_key ?? raw.accessKey ?? raw.accessKeyId ?? ""), full),
    created: truncateField(String(raw.created_at ?? raw.created ?? raw.creation_date ?? ""), full),
  };
}
