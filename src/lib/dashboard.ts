import { doctlJson } from "./doctl.js";

const PLACEHOLDER = "—";

type AccountRaw = { account?: Record<string, unknown>; email?: string; [k: string]: unknown };
type BalanceRaw = { balance?: Record<string, unknown>; account_balance?: string; accountBalance?: string; month_to_date_balance?: string; monthToDateBalance?: string; [k: string]: unknown };

function extractAccount(raw: unknown): { email: string; team: string } {
  const obj = raw as AccountRaw;
  const acct = (obj?.account as Record<string, unknown>) ?? (obj as Record<string, unknown>);
  const email = typeof acct?.email === "string" ? acct.email : typeof obj?.email === "string" ? obj.email : PLACEHOLDER;
  // team: try team field, else droplet_limit etc? fallback to email domain or placeholder
  const teamRaw = (acct as Record<string, unknown>)?.team ?? (acct as Record<string, unknown>)?.name ?? (obj as Record<string, unknown>)?.team;
  const team = typeof teamRaw === "string" && teamRaw.length > 0 ? teamRaw : PLACEHOLDER;
  return { email: email || PLACEHOLDER, team: team || PLACEHOLDER };
}

function extractBalance(raw: unknown): string {
  const obj = raw as BalanceRaw;
  const bal = (obj?.balance as Record<string, unknown>) ?? (obj as Record<string, unknown>);
  const v =
    (bal as Record<string, unknown>)?.account_balance ??
    (bal as Record<string, unknown>)?.accountBalance ??
    (obj as Record<string, unknown>)?.account_balance ??
    (obj as Record<string, unknown>)?.accountBalance ??
    (bal as Record<string, unknown>)?.month_to_date_balance ??
    (bal as Record<string, unknown>)?.monthToDateBalance;
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "number") return String(v);
  // if raw is string itself
  if (typeof raw === "string" && raw.length > 0) return raw;
  return PLACEHOLDER;
}

function countFromArray(raw: unknown): number | string {
  if (Array.isArray(raw)) return raw.length;
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    // some doctl outputs wrapper object: { droplets: [...] } etc.
    for (const key of ["droplets", "apps", "databases", "kubernetes_clusters", "clusters", "repositories", "domains"]) {
      if (Array.isArray(rec[key])) return (rec[key] as unknown[]).length;
    }
  }
  return PLACEHOLDER;
}

function engineBuckets(raw: unknown): string {
  if (!Array.isArray(raw)) {
    if (raw && typeof raw === "object") {
      const rec = raw as Record<string, unknown>;
      const arr = rec.databases ?? rec.clusters ?? null;
      if (Array.isArray(arr)) raw = arr;
      else return PLACEHOLDER;
    } else return PLACEHOLDER;
  }
  const arr = raw as Array<Record<string, unknown>>;
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const eng = typeof item.engine === "string" ? item.engine : "unknown";
    counts[eng] = (counts[eng] ?? 0) + 1;
  }
  const keys = Object.keys(counts).sort();
  if (keys.length === 0) return PLACEHOLDER;
  return keys.map((k) => `${k}=${counts[k]}`).join(", ");
}

export async function buildDashboardPayload(): Promise<Record<string, unknown>> {
  const fetches: Promise<unknown>[] = [
    doctlJson<unknown>(["account", "get"]).catch(() => null),
    doctlJson<unknown>(["balance", "get"]).catch(() => null),
    doctlJson<unknown>(["compute", "droplet", "list"]).catch(() => null),
    doctlJson<unknown>(["apps", "list"]).catch(() => null),
    doctlJson<unknown>(["databases", "list"]).catch(() => null),
    doctlJson<unknown>(["kubernetes", "cluster", "list"]).catch(() => null),
    doctlJson<unknown>(["registry", "repository", "list-v2"]).catch(() => null),
    doctlJson<unknown>(["compute", "domain", "list"]).catch(() => null),
  ];

  const results = await Promise.allSettled(fetches);
  // map: 0 account,1 balance,2 droplet,3 app,4 database,5 kubernetes,6 registry,7 domain
  const get = (idx: number): unknown => {
    const r = results[idx];
    if (r.status === "fulfilled") return r.value;
    return null;
  };

  const accountRaw = get(0);
  const balanceRaw = get(1);
  const dropletRaw = get(2);
  const appRaw = get(3);
  const databaseRaw = get(4);
  const k8sRaw = get(5);
  const registryRaw = get(6);
  const domainRaw = get(7);

  const account = accountRaw ? extractAccount(accountRaw) : { email: PLACEHOLDER, team: PLACEHOLDER };
  const balance = balanceRaw ? extractBalance(balanceRaw) : PLACEHOLDER;

  const dropletCount = dropletRaw !== null ? countFromArray(dropletRaw) : PLACEHOLDER;
  const appCount = appRaw !== null ? countFromArray(appRaw) : PLACEHOLDER;
  const databaseCount = databaseRaw !== null ? countFromArray(databaseRaw) : PLACEHOLDER;
  const k8sCount = k8sRaw !== null ? countFromArray(k8sRaw) : PLACEHOLDER;
  const registryCount = registryRaw !== null ? countFromArray(registryRaw) : PLACEHOLDER;
  const domainCount = domainRaw !== null ? countFromArray(domainRaw) : PLACEHOLDER;

  const databaseEngine = databaseRaw !== null && databaseCount !== PLACEHOLDER ? engineBuckets(databaseRaw) : PLACEHOLDER;

  // If droplet fetch is placeholder due to failure, engineBuckets already placeholder
  // Ensure database payload always includes count

  const payload: Record<string, unknown> = {
    account,
    balance,
    droplet: { count: dropletCount },
    app: { count: appCount },
    database: { count: databaseCount, engine: databaseEngine },
    kubernetes: { count: k8sCount },
    registry: { count: registryCount },
    domain: { count: domainCount },
    help: ["doctl-axi droplet list"],
  };

  return payload;
}
