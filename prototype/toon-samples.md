# Prototype: TOON samples for doctl-axi (ticket 07)

Chosen: 4 fields + aggregates. Mirrors gh-axi pattern: src/toon.ts FieldDef DSL + src/format.ts aggregates.

## droplet list (TOON)
```toon
count: 2 of 2 total
status: active 2/2
---
- id: 12345678
  name: web-01
  region: nyc1
  status: active
  size: s-1vcpu-1gb
- id: 12345679
  name: db-01
  region: ams3
  status: active
  size: s-2vcpu-4gb
help: ["droplet get 12345678 for detail", "doctl-axi droplet list --full for complete fields"]
```

## app list (TOON)
```toon
count: 1 of 1 total
---
- id: abc-def
  name: my-app
  region: nyc
  phase: ACTIVE
  activeDeployment: abc123
```

## database list (TOON)
```toon
count: 3 total
engine: pg=2, mysql=1
---
- id: db-xyz
  name: prod-pg
  engine: pg
  version: "15"
  region: nyc1
  status: online
```

## network domain list (TOON)
```toon
count: 2 total
---
- name: example.com
  ttl: 3600
  records: 12
- name: api.example.com
  ttl: 1800
  records: 3
```

## docs search (TOON, via fetch)
```toon
count: 5 results for "droplet resize"
---
- path: /products/droplets/how-to/resize
  title: Resize Droplets
  excerpt: "Resize a Droplet to adjust CPU..."
help: ["docs get /products/droplets/how-to/resize for full page", "docs search \"droplet\" --full for complete excerpt"]
```

## Truncation rule
- List items: truncate field value >8000 chars → `... [truncated N chars, use --full]`
- Snapshot equivalent: `gh-axi/src/snapshot.ts:truncateText(8k)` mirrored
- Empty: `0 droplets` (exit 0, definitive) not `[]`
