// database mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val } from "./common.js";

export type DatabaseRaw = {
  id?: string;
  name?: string;
  engine?: string;
  version?: string | number;
  region?: string;
  status?: string;
  [key: string]: unknown;
};

export type DatabaseToon = {
  id: string;
  name: string;
  engine: string;
  version: string;
  region: string;
  status: string;
};

export function toDatabaseToon(raw: DatabaseRaw, full: boolean): DatabaseToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    engine: truncateField(str(raw, "engine"), full),
    version: truncateField(val(raw, "version"), full),
    region: truncateField(str(raw, "region"), full),
    status: truncateField(str(raw, "status"), full),
  };
}

// ---- Database Sub-resources ----
// Mappers for database users/topics/pools. Field-mapped on purpose: raw doctl
// records carry credentials (user.password) and bloat we never print.

export type DatabaseUserRaw = {
  name?: string;
  role?: string;
  type?: string;
  [key: string]: unknown;
};

export type DatabaseUserToon = {
  name: string;
  role: string;
  type: string;
};

export function toDatabaseUserToon(raw: DatabaseUserRaw, full: boolean): DatabaseUserToon {
  return {
    name: truncateField(str(raw, "name"), full),
    role: truncateField(str(raw, "role"), full),
    type: truncateField(str(raw, "type"), full),
  };
}

export type DatabaseTopicRaw = {
  name?: string;
  state?: string;
  partitions?: number | string;
  [key: string]: unknown;
};

export type DatabaseTopicToon = {
  name: string;
  state: string;
  partitions: string;
};

export function toDatabaseTopicToon(raw: DatabaseTopicRaw, full: boolean): DatabaseTopicToon {
  return {
    name: truncateField(str(raw, "name"), full),
    state: truncateField(str(raw, "state"), full),
    partitions: truncateField(val(raw, "partitions"), full),
  };
}

export type DatabasePoolRaw = {
  name?: string;
  mode?: string;
  size?: number | string;
  [key: string]: unknown;
};

export type DatabasePoolToon = {
  name: string;
  mode: string;
  size: string;
};

export function toDatabasePoolToon(raw: DatabasePoolRaw, full: boolean): DatabasePoolToon {
  return {
    name: truncateField(str(raw, "name"), full),
    mode: truncateField(str(raw, "mode"), full),
    size: truncateField(val(raw, "size"), full),
  };
}
