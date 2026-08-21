// registry mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val } from "./common.js";

// ---- Registry Repository ----

export type RegistryRepositoryRaw = {
  name?: string;
  registry_name?: string;
  registryName?: string;
  tag_count?: number | string;
  tagCount?: number | string;
  manifest_count?: number | string;
  manifestCount?: number | string;
  [key: string]: unknown;
};

export type RegistryRepositoryToon = {
  name: string;
  registry: string;
  tagCount: string;
  manifestCount: string;
};

export function toRegistryRepositoryToon(raw: RegistryRepositoryRaw, full: boolean): RegistryRepositoryToon {
  return {
    name: truncateField(str(raw, "name"), full),
    registry: truncateField(String(raw.registry_name ?? raw.registryName ?? ""), full),
    tagCount: truncateField(String(raw.tag_count ?? raw.tagCount ?? ""), full),
    manifestCount: truncateField(String(raw.manifest_count ?? raw.manifestCount ?? ""), full),
  };
}

// ---- Registry Tag ----

export type RegistryTagRaw = {
  repository?: string;
  repo?: string;
  tag?: string;
  manifest_digest?: string;
  manifestDigest?: string;
  digest?: string;
  updated_at?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type RegistryTagToon = {
  repository: string;
  tag: string;
  digest: string;
  updatedAt: string;
};

export function toRegistryTagToon(raw: RegistryTagRaw, full: boolean): RegistryTagToon {
  return {
    repository: truncateField(String(raw.repository ?? raw.repo ?? ""), full),
    tag: truncateField(val(raw, "tag"), full),
    digest: truncateField(String(raw.manifest_digest ?? raw.manifestDigest ?? raw.digest ?? ""), full),
    updatedAt: truncateField(String(raw.updated_at ?? raw.updatedAt ?? ""), full),
  };
}

// ---- Registry Manifest ----

export type RegistryManifestRaw = {
  repository?: string;
  repo?: string;
  digest?: string;
  tags?: string[] | string;
  size_bytes?: number | string;
  sizeBytes?: number | string;
  compressed_size_bytes?: number | string;
  compressedSizeBytes?: number | string;
  updated_at?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type RegistryManifestToon = {
  repository: string;
  digest: string;
  tags: string;
  size: string;
};

export function toRegistryManifestToon(raw: RegistryManifestRaw, full: boolean): RegistryManifestToon {
  const tags = Array.isArray(raw.tags) ? raw.tags.join(",") : typeof raw.tags === "string" ? raw.tags : "";
  return {
    repository: truncateField(String(raw.repository ?? raw.repo ?? ""), full),
    digest: truncateField(val(raw, "digest"), full),
    tags: truncateField(tags, full),
    size: truncateField(String(raw.size_bytes ?? raw.sizeBytes ?? raw.compressed_size_bytes ?? raw.compressedSizeBytes ?? ""), full),
  };
}

// ---- Registry Garbage Collection ----

export type RegistryGCRaw = {
  uuid?: string;
  id?: string;
  registry_name?: string;
  registryName?: string;
  status?: string;
  blobs_deleted?: number | string;
  blobsDeleted?: number | string;
  created_at?: string;
  [key: string]: unknown;
};

export type RegistryGCToon = {
  id: string;
  registry: string;
  status: string;
  blobsDeleted: string;
};

export function toRegistryGCToon(raw: RegistryGCRaw, full: boolean): RegistryGCToon {
  return {
    id: truncateField(String(raw.uuid ?? raw.id ?? ""), full),
    registry: truncateField(String(raw.registry_name ?? raw.registryName ?? ""), full),
    status: truncateField(str(raw, "status"), full),
    blobsDeleted: truncateField(String(raw.blobs_deleted ?? raw.blobsDeleted ?? ""), full),
  };
}
