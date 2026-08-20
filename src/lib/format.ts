export type CountLineOptions = {
  count: number;
  totalCount?: number;
  limit?: number;
  displayLimit?: number;
  apiLimitHit?: boolean;
};

export function formatCountLine(opts: CountLineOptions): string {
  const { count, totalCount, limit, displayLimit, apiLimitHit } = opts;
  if (apiLimitHit) return `count: ${count}+ (limit reached)`;
  if (typeof totalCount === "number" && totalCount >= count) {
    return `count: ${count} of ${totalCount} total`;
  }
  if (typeof displayLimit === "number") {
    return `count: ${count} (showing first ${displayLimit})`;
  }
  if (typeof limit === "number" && count >= limit) {
    return `count: ${count} (showing first ${count})`;
  }
  return `count: ${count}`;
}

export function formatStatusAggregate(droplets: Array<{ status?: string }>): string | null {
  if (droplets.length === 0) return null;
  const active = droplets.filter((d) => d.status === "active").length;
  return `status: active ${active}/${droplets.length}`;
}
