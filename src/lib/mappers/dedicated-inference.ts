// dedicated-inference mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField, str, val, extractAt } from "./common.js";

// ---- Dedicated Inference ----

export type DedicatedInferenceRaw = {
  id?: string | number;
  name?: string;
  region?: string | { slug?: string };
  status?: string;
  [key: string]: unknown;
};

export type DedicatedInferenceToon = {
  id: string;
  name: string;
  region: string;
  status: string;
};

export function toDedicatedInferenceToon(raw: DedicatedInferenceRaw, full: boolean): DedicatedInferenceToon {
  return {
    id: truncateField(val(raw, "id"), full),
    name: truncateField(str(raw, "name"), full),
    region: extractAt(raw, full, "region"),
    status: truncateField(str(raw, "status"), full),
  };
}
