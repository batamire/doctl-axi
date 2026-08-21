// balance mappers — extracted verbatim from the former lib/toon.ts monolith.
import { truncateField } from "./common.js";

// ---- Balance ----

export type BalanceRaw = {
  month_to_date_balance?: string;
  monthToDateBalance?: string;
  account_balance?: string;
  accountBalance?: string;
  generated_at?: string;
  [key: string]: unknown;
};

export type BalanceToon = {
  monthToDateBalance: string;
  accountBalance: string;
  generatedAt: string;
};

export function toBalanceToon(raw: BalanceRaw, full: boolean): BalanceToon {
  return {
    monthToDateBalance: truncateField(String(raw.month_to_date_balance ?? raw.monthToDateBalance ?? ""), full),
    accountBalance: truncateField(String(raw.account_balance ?? raw.accountBalance ?? ""), full),
    generatedAt: truncateField(String(raw.generated_at ?? raw.generatedAt ?? ""), full),
  };
}
