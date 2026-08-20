# do-axi

Agent-ergonomic CLI for DigitalOcean — one AXI replacing 21 fragmented MCP services, wrapping `doctl --output json` → TOON.

## Language

**Droplet**:
A virtual machine on DigitalOcean (the compute primitive).
_Avoid_: Instance, VM, server, droplets

**App**:
A DigitalOcean App Platform application (from spec/repo, with deployments).
_Avoid_: Application, apps, service

**Database**:
A managed database cluster (Postgres, MySQL, Redis, Mongo, Kafka, OpenSearch).
_Avoid_: DBaaS, dbaas, db, cluster (ambiguous without qualifier), databases

**Kubernetes**:
A DOKS-managed Kubernetes cluster with node pools. CLI noun is `kubernetes` (alias `k8s`, `doks`).
_Avoid_: cluster (bare), k8s-cluster, DOKS (as noun)

**Registry**:
A DigitalOcean Container Registry (DOCR) with repositories, tags, manifests.
_Avoid_: DOCR, docr, container-registry, docker-registry

**Space**:
An S3-compatible object storage namespace (Spaces); this CLI only manages access keys, not buckets/objects.
_Avoid_: Bucket, s3, spaces

**Network**:
The consolidated networking surface: domains, DNS records, certificates, firewalls, load balancers, VPCs, VPC peerings, CDNs, reserved IPs/BYOIP.
_Avoid_: Networking (as noun), vpc (as top-level), domain (as top-level), firewall (as top-level)

**Volume**:
A block storage volume attachable to a droplet.
_Avoid_: Block storage, disk, volumes

**NFS**:
A managed NFS file share.
_Avoid_: File share, nfs-share

**Function**:
A serverless function (namespace → package → action → trigger → activation).
_Avoid_: Lambda, serverless, functions

**Account**:
The DigitalOcean account identity; owns balance, billing, SSH keys, and actions.
_Avoid_: User, team, organization (unless GH-style org), accounts

**Project**:
A DigitalOcean Projects grouping that tags resources — not a GitHub Project.
_Avoid_: Project (GitHub), workspace

### Command taxonomy (canonical, singular)

- `droplet` — list/get/create/delete, actions (reboot/resize/snapshot…)
- `kubernetes` — cluster + node-pool ops (alias _Avoid_: k8s, doks)
- `app` — create/get/list/update/delete, deployments, logs
- `database` — cluster, user, topic, pool, config, firewall
- `registry` — repository, tag, manifest, garbage collection
- `space` — keys only (keys create/list/get/update/delete)
- `network` — subcommands: `domain`, `record`, `certificate`, `firewall`, `load-balancer`, `vpc`, `peering`, `cdn`, `reserved-ip`
- `volume`, `nfs` — respective CRUD + snapshot/attach
- `function` — namespace/package/action/trigger/activation
- `account`, `balance`, `billing`, `invoice`, `region` — account surface
- `dedicated-inference`, `marketplace`, `insight` (uptime), `docs`, `vector-database`, `genai-*` — deferred/gap domains (see map)

Global: `--output` is always `--output json` internally; `--fields` selects TOON fields; `--full` disables truncation.
