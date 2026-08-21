// app mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val, extractAt } from "./common.js";

// ---- App ----

export type AppRaw = {
  id?: string;
  spec?: { name?: string };
  name?: string;
  region?: string | { slug?: string; label?: string };
  tier_slug?: string;
  active_deployment?: { id?: string; phase?: string } | null;
  activeDeployment?: { id?: string; phase?: string } | null;
  phase?: string;
  [key: string]: unknown;
};

export type AppToon = {
  id: string;
  name: string;
  region: string;
  phase: string;
  activeDeployment: string;
};

function extractAppName(raw: AppRaw, full: boolean): string {
  if (typeof raw.name === "string") return truncateField(raw.name, full);
  if (raw.spec && typeof raw.spec === "object" && "name" in raw.spec) {
    const n = (raw.spec as { name?: unknown }).name;
    if (typeof n === "string") return truncateField(n, full);
  }
  return "";
}

function extractAppPhase(raw: AppRaw, full: boolean): string {
  const ad = raw.active_deployment ?? raw.activeDeployment;
  if (ad && typeof ad === "object" && "phase" in (ad as Record<string, unknown>)) {
    const p = (ad as { phase?: unknown }).phase;
    if (typeof p === "string") return truncateField(p, full);
  }
  if (typeof raw.phase === "string") return truncateField(raw.phase, full);
  return "";
}

function extractAppActiveDeployment(raw: AppRaw, full: boolean): string {
  const ad = raw.active_deployment ?? raw.activeDeployment;
  if (ad && typeof ad === "object" && "id" in (ad as Record<string, unknown>)) {
    const id = (ad as { id?: unknown }).id;
    if (id !== undefined && id !== null) return truncateField(String(id), full);
  }
  return "";
}

export function toAppToon(raw: AppRaw, full: boolean): AppToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: extractAppName(raw, full),
    region: extractAt(raw, full, "region"),
    phase: extractAppPhase(raw, full),
    activeDeployment: extractAppActiveDeployment(raw, full),
  };
}

// ---- App Deployment ----

export type AppDeploymentRaw = {
  id?: string;
  phase?: string;
  cause?: string;
  progress?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type AppDeploymentToon = {
  id: string;
  phase: string;
  cause: string;
  progress: string;
};

export function toAppDeploymentToon(raw: AppDeploymentRaw, full: boolean): AppDeploymentToon {
  return {
    id: truncateField(val(raw, "id"), full),
    phase: truncateField(str(raw, "phase"), full),
    cause: truncateField(str(raw, "cause"), full),
    progress: truncateField(str(raw, "progress"), full),
  };
}
