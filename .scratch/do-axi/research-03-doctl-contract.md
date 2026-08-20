# Research 03 — doctl auth & JSON contract probe

**Date:** 2026-08-20
**doctl:** `1.159.0-release` (latest 1.167.0 available) at `/opt/homebrew/bin/doctl`
**Config path (macOS default):** `~/Library/Application Support/doctl/config.yaml` (note: docs reference `$HOME/.config/doctl/config.yaml` on Linux; on macOS the XDG fallback is the Application Support path — `-c` overrides)
**Account probed:** `batamire@gmail.com` / Example team `REDACTED_TEAM_UUID`, N droplets, M apps, K databases

---

## 1. Auth interop

### 1.1 What doctl actually reads

| Source | Env / flag | Evidence | Precedence |
|---|---|---|---|
| `config.yaml` `access-token` + `auth-contexts.*` | `-c / --config`, `--context` | Local file `~/Library/Application Support/doctl/config.yaml` contained `auth-contexts: { my-context: <64-hex>, my-context-2: dop_v1_..., default: "true" }` and `context: my-context`. `doctl account get --output json` succeeded with **no env vars set** (`DIGITALOCEAN_*` unset) — so stored context supplies token. | 2nd (if `--access-token` not given) |
| Direct token flag | `-t` / `--access-token` | `doctl account get --access-token dop_v1_fake --output json` → API 401 (proves flag is injected into request). `doctl --help` documents `DIGITALOCEAN_ACCESS_TOKEN` as session override for this flag. | 1st (highest) |
| Env var `DIGITALOCEAN_ACCESS_TOKEN` | env fallback for `--access-token` | **Verified via isolated config:** `DIGITALOCEAN_ACCESS_TOKEN=dop_v1_fake doctl --config $TMP/empty.yaml account get --output json` → `401 Unable to authenticate` (not `access token is required`). Without env: same empty config → `{"errors":[{"detail":"Unable to initialize DigitalOcean API client: access token is required. (hint: run 'doctl auth init')"}]}` exit 1. So env **is** read automatically (viper binding), equivalent to `-t`. `README.md: Environment variables` section confirms: `DIGITALOCEAN_ACCESS_TOKEN=my-do-token doctl`. | 1st (same as `-t`) |
| Env var `DIGITALOCEAN_CONTEXT` | env fallback for `--context` | Documented in README ("Use instead of --context argument: `DIGITALOCEAN_CONTEXT=my-context doctl auth list`"). Matches viper `GetString("context")`. | — |
| Env var `DIGITALOCEAN_API_TOKEN` (labs MCP convention) | — | **NOT read by doctl.** `DIGITALOCEAN_API_TOKEN=fake doctl account get --output json` succeeds via stored `config.yaml` context, ignoring Labs var. With empty config + `DIGITALOCEAN_API_TOKEN=fake`, still `access token is required` (not 401), proving the variable is ignored. `strings $(which doctl)` contains `DIGITALOCEAN_ACCESS_TOKEN` via viper but no `DIGITALOCEAN_API_TOKEN`. | N/A |

**Token formats observed:** legacy 64-hex (`d096…9849e`), current `dop_v1_<hex>` pattern. Both accepted via same `access-token` path.

**Config structure (sanitized excerpt):**
```yaml
access-token: ""          # top-level legacy field, empty when using contexts
auth-contexts:
  my-context: REDACTED_64_HEX_EXAMPLE
  my-context-2: dop_v1_REDACTED_EXAMPLE
context: my-context
config: /Users/mirko/Library/Application Support/doctl/config.yaml
```
(`doctl config.yaml` default printed in `--help` matches this path.)

### 1.2 Behaviour when missing token

| Scenario | Command | `--output json` stdout | stderr / mixed | Exit |
|---|---|---|---|---|
| No `config.yaml`, no `DIGITALOCEAN_ACCESS_TOKEN` | `doctl --config $TMP/empty.yaml account get --output json` | `{"errors":[{"detail":"Unable to initialize DigitalOcean API client: access token is required. (hint: run 'doctl auth init')"}]}` | same JSON on stdout, nothing on stderr (verified: no split) | **1** |
| No config, `DIGITALOCEAN_ACCESS_TOKEN=""` explicit empty | same | same as above | same | 1 |
| Invalid context | `doctl account get --context doesnotexist --output json` | same JSON | same | 1 |
| Invalid token via env | `DIGITALOCEAN_ACCESS_TOKEN=dop_v1_fake doctl --config $TMP/empty.yaml account get --output json` | `{"errors":[{"detail":"GET …/v2/account: 401 … Unable to authenticate you"}]}` | same | 1 |
| Forbidden resource (token lacks scope) | `doctl balance get --output json` (token without billing scope) | `{"errors":[{"detail":"GET …/v2/customers/my/balance: 403 … You are not authorized"}]}` | same (in JSON mode) | 1 |
| Same forbidden, text mode | `doctl balance get` | `Error: GET …/v2/customers/my/balance: 403 …` | stderr+stdout combined (single stream) | 1 |

**Key finding:** In `--output json` mode, even auth/403 errors are emitted as `{"errors":[...]}` JSON on **stdout** (not stderr) but exit !=0, so wrapper cannot rely on stdout-is-JSON ⇒ success. Must check exit code **and** presence of top-level `errors` array. In text mode errors go to `Error: …` single line.

`DIGITALOCEAN_ACCESS_TOKEN` via env does **not** validate locally (`doctl auth init` validates against `https://cloud.digitalocean.com`); invalid token passes init and only fails on first API call (401).

### 1.3 Token scopes / idempotency (light probe)

- Scopes not пробит here; docs state tokens are per-account or per-team, with write/read scopes. `balance get` 403 with current token proves scoped tokens exist — wrapper should surface 403 detail verbatim + suggest regenerating token with correct scopes.
- `create` is **not idempotent** (re-POST creates duplicate resource). `delete` is idempotent in effect (second delete → 404 `{"errors":[...]}` exit 1). `doctl` offers no `--force` idempotency guard beyond confirm prompts; `do-axi` should not retry creates blindly.

---

## 2. JSON contract — `doctl <svc> list|get --output json`

### 2.1 Flag confusion to avoid

- **Correct:** `--output json` / `-o json` (global flag, all commands). Aliases: `doctl account get -o json` works.
- **Wrong:** `--format json` → `Error: unknown column "json"` (exit 1). `--format` is **only** for text-table column selection (e.g., `--format ID,Name,Region`). Appears in every `list/get --help` as `Columns for output in a comma-separated list`. JSON mode **ignores** `--format`. Documented in `doctl --help` Global Flags.
- `--no-header` only matters in text mode (suppresses column headers); irrelevant under `--output json`.

### 2.2 Envelope shape

| Command shape | JSON top-level | Example probe | Notes |
|---|---|---|---|
| `list` | **Array** `[]` | `droplet list` → 162-element array; `apps list` → 17-element array; `databases list` → 12; `projects list` → 64; `domain list` → 7; `kubernetes cluster list` → `[]` (0) | Always bare array, no `{ "droplets": [...] }` wrapper, no `meta`/`links`. Pagination is **handled internally** by doctl (no `--page` flag on most lists). Wrapper receives complete dataset in one call. |
| `get` (single resource) | **Object** `{}` | `droplet get 163423779` → single droplet object; `account get` → flat object `{droplet_limit,email,uuid,status,team:{...}}` | Same snake_case keys as DO API via godo. `get` of missing resource → `{"errors":[...]}` not empty object. |
| Error (any) | `{"errors":[{"detail":"…"}]}` | `droplet get 999999999 --output json` → `{"errors":[...]}` exit 1; `balance get --output json` → same exit 1 | Inconsistent earlier run showed exit 0 for some 404s but re-probe with 3x repetition confirms **exit 1** for both 404 and 403; wrapper must still handle exit 0 case defensively if tokenless text mode previously observed. |
| Empty list | `[]` | `kubernetes cluster list --output json` → `[]` exit 0; `droplet list --region doesnotexist --output json` → `[]` exit 0 | Distinguish from error via `Array.isArray()` + absence of `errors`. `"definitive empty"` (Principle 5) maps to `[]`. |

**No envelope pagination fields** were observed. MCP's `dropletRegistry` exposes `Page/PerPage` but doctl hides it. Therefore wrapper has no cursor to expose; truncation must be client-side.

### 2.3 Field stability (per top domains)

All `list --output json` fields are **snake_case**, mirroring `godo` structs / DO API v2 — not the `TitleCase` column names from `--format`. Verified by introspection:

- **Droplets** (`doctl compute droplet list --output json`): `id, name, memory, vcpus, disk, region{slug,name,sizes,available,features}, image{id,name,type,distribution,slug,description,status,created_at,…}, size{slug,…}, size_slug, networks{v4,v6}, region, status, tags[], features[], volume_ids[], vpc_uuid, created_at, tags, …` — 162 items, each includes full `region.sizes` catalog (~130 slugs) inflating payload dramatically. Text mode columns: `ID,Name,PublicIPv4,…` (title-case) — wrapper must not confuse.
- **Apps** (`apps list`): `id, owner_uuid, spec{name,services[],workers[],jobs[],region,envs[],ingress,…}, last_deployment_active_at, created_at, updated_at, region, tier_slug, build_config` — spec is deep nested, stable per API.
- **Databases** (`databases list`): `id, name, engine, version, connection{protocol,uri,host,port,user,password,ssl}, private_connection, users[{name,role,password}], num_nodes, size, db_names[], region, status, maintenance_window, created_at, private_network_uuid, tags[], project_id, storage_size_mib, metrics_endpoints` — includes **passwords in clear** (sensitive, must be redacted before TOON/log).
- **Kubernetes** (`kubernetes cluster list`): `[]` when no clusters (probe), schema per docs: `id,name,region,version,auto_upgrade,status,endpoint,node_pools[]`.
- **Projects** (`projects list`): `id, owner_uuid, owner_id, name, description, purpose, environment, is_default, created_at, updated_at`.
- **Domains** (`compute domain list`): `name, ttl, zone_file`.
- **Account** (`account get`): flat `{droplet_limit,floating_ip_limit,reserved_ip_limit,volume_limit,email,name,uuid,email_verified,status,team{name,uuid}}`

**Verdict:** Field names are stable because doctl is a thin `godo` serializer — no doctl-specific renaming. Changes track DO API versioning (infrequent, documented). Risk is **payload bloat** (`region.sizes` repeated per droplet) not instability. Normalization needed: wrapper should **not** expect registry-style `key:value` lines; should pass raw JSON to TOON mapper.

### 2.4 Exit codes / stderr contract

- Success: exit 0, JSON valid (array or object).
- Missing token / invalid context: exit 1, JSON `{"errors":[...]}` on stdout (verified with `--output json`).
- Resource not found / Forbidden: exit 1, JSON `{"errors":[...]}` (re-checked; earlier single 0 was flake, consistent 1 on re-run).
- Empty success (no resources): exit 0, `[]`.
- Text mode errors: exit 1, `Error: GET …: <code> …` on stdout/stderr combined (no JSON).

**Wrapper rule:** Always spawn with `--output json`, capture stdout+stderr combined, check `exitCode !== 0` OR `parsed.errors` truthy → treat as `AxiError`. Do not treat `[]` as error.

### 2.5 Buffer limits (`MAX_BUFFER`) — concrete failure

`doctl compute droplet list --output json` with 162 droplets = **1,100,859 bytes** (measured via `wc -c`). Node `child_process.execFile` default `maxBuffer = 1024*1024 = 1,048,576 bytes`. **Proven to fail:**

```js
execFileSync('doctl',['compute','droplet','list','--output','json'],{maxBuffer: 1024*1024})
// → Error: spawnSync doctl ENOBUFS
```

Even `maxBuffer: 512*1024` fails. `gh-axi` avoids this via `maxBuffer: 10*1024*1024` (or larger) on `execFile`. `do-axi` must do same — recommend `10 MB` minimum, `20 MB` if supporting >500 droplets or `--full` dumps. No streaming needed; just raise limit.

Truncation concern: with 500 droplets output would be ~3–4 MB (linear scaling with `region.sizes` duplication). Still within 10 MB but TOON truncation (Principle 4) must follow before display.

### 2.6 `--format json` vs JSON normalization question (ticket Q)

Answer: **No `--format json` normalization needed** — that flag does not exist. Only `--output json` matters. No registry-style `key:value` JSON to normalize; doctl already emits standard JSON. Wrapper just does `JSON.parse(stdout)` → TOON mapping. One caveat: some commands (`registry`, `balance` forbidden) emit `Error: …` text even with `--output json` if invoked incorrectly (e.g., `registry list` without subcommand) — but for `list/get` verbs tested, JSON mode is reliable.

---

## 3. Labs MCP `DIGITALOCEAN_API_TOKEN` vs doctl `DIGITALOCEAN_ACCESS_TOKEN`

| Aspect | Labs MCP (`digitalocean-labs/mcp-digitalocean`) | doctl |
|---|---|---|
| Env var | `DIGITALOCEAN_API_TOKEN` | `DIGITALOCEAN_ACCESS_TOKEN` (also `--access-token` flag, `access-token` in config.yaml) |
| Value | Same raw token (`dop_v1_…` or hex) — Bearer auth to `api.digitalocean.com/v2/*` via godo | Same |
| Reads other var? | Not tested here, but godo examples use `DIGITALOCEAN_ACCESS_TOKEN` as well | **Ignores** `DIGITALOCEAN_API_TOKEN` (proven) |
| Config file | None (per-service remote MCP, token passed via MCP client config `env`) | `~/.config/doctl/config.yaml` (Linux) / `~/Library/Application Support/doctl/config.yaml` (macOS) + contexts |
| Reading the other var would be desirable? | Yes, for interop | — |

**Implication:** Naive users copying Labs README (`export DIGITALOCEAN_API_TOKEN=…`) will find `doctl` and thus `do-axi` (if wrapping doctl) still prompts `access token is required`. This is the #1 interop papercut.

---

## 4. Fallback order proposal (for ticket 08)

Proposed precedence for `do-axi` token resolution (highest → lowest), to be decided in 08 but grounded by this probe:

1. **`--access-token` flag** (explicit per-invocation, same as doctl `-t`; useful for CI `do-axi --access-token $TOKEN …`)
2. **`DIGITALOCEAN_ACCESS_TOKEN` env** (doctl-native; already auto-read by doctl via viper — if `do-axi` passes `-t $DIGITALOCEAN_ACCESS_TOKEN` explicitly, it honors this)
3. **`DIGITALOCEAN_API_TOKEN` env** (Labs compatibility shim — `do-axi` should read this itself and pass as `-t` to doctl if `DIGITALOCEAN_ACCESS_TOKEN` is absent; doctl won't do it)
4. **`config.yaml` context** (`doctl` default — `~/.config/doctl/config.yaml` / `~/Library/Application Support/doctl/config.yaml` via `--context` / `DIGITALOCEAN_CONTEXT`)
5. **Interactive prompt** (only if `process.stdin.isTTY` and none above set; `password: true` masking, same pattern as `gh-axi/src/secretValue.ts` — read from stdin without echo, do not persist unless user runs `doctl auth init` / `do-axi auth`)

**Rationale:** Respects doctl's own viper precedence (flag > env `DIGITALOCEAN_ACCESS_TOKEN` > config) while adding Labs compat as a thin `do-axi`-level shim (not relying on doctl to learn new env var). Avoids breaking existing doctl users; avoids silent token mismatch where Labs var is set but doctl ignores it.

**Implementation sketch (ponytail):**
```ts
const token = opts.accessToken
  ?? process.env.DIGITALOCEAN_ACCESS_TOKEN
  ?? process.env.DIGITALOCEAN_API_TOKEN   // <-- shim, the only new line
  ?? undefined; // fall through to doctl config
if (token) args.unshift("-t", token);
execFile("doctl", args, { maxBuffer: 10*1024*1024 });
```
If no token resolved and doctl exits 1 with `access token is required`, surface `AxiError` code `AUTH_MISSING` with suggestion: `export DIGITALOCEAN_ACCESS_TOKEN or DIGITALOCEAN_API_TOKEN, or run: doctl auth init` (or `doctl auth init --context <name>`).

**Do NOT** silently persist Labs token into `config.yaml` — that would surprise `doctl auth` context semantics. `do-axi setup hooks` can optionally offer `doctl auth init --context do-axi` if ambient context needs it.

**Secret handling:** Mirror `gh-axi`: `secretValue()` that prefers env, then `readline` with `password:true`, never logs token, redacts `password`/`uri` fields in database connection output before TOON display (observed cleartext `doadmin` passwords in `databases list` JSON).

---

## 5. JSON stability verdict per top domains

| Domain (v1 candidates) | `list --output json` shape | `get --output json` shape | Stability | Gap / note |
|---|---|---|---|---|
| **droplets** | `Dial[]` array, snake_case, includes full `region.sizes` bloat | object, same keys | **Stable** (API v2) | Buffer >1 MB for 162 droplets; TOON must select 3–4 fields (`id,name,region.slug,status,tags`) and truncate `region.sizes` entirely. |
| **apps** | `App[]` array, deep `spec` | same + `last_deployment_*` | **Stable** | Large `spec.envs` / `build_command`; TOON should pick `id,spec.name,region,updated` + aggregate `services.length`. |
| **databases** | `Database[]` with `connection` + `users[].password` | same | **Stable** | **Redact passwords** before display. `storage_size_mib` vs `Size` column mismatch noted but JSON is source of truth. |
| **doks** | `Cluster[]` (0 in probe) | object | **Stable** | Empty `[]` is definitive empty, not error. |
| **networking** (domains, firewalls, LBs) | `Domain[]`, `Firewall[]`, etc. | object | **Stable** | Scattered under `doctl compute` + `vpcs` + `network` — wrapper should consolidate noun. |
| **docr** | Not probed via `--output json` (`registry list` requires subcommand), but `registry get` → `{"errors":…}` when not configured | — | Likely stable | Check `registry get --output json` needs registry name arg. |
| **volumes** | `Volume[]` | object | **Stable** | Separate `volume-action` envelope. |
| **account/balance** | `account get` → flat object; `balance get` → `{"errors":403}` with 403 scope token | — | **Stable** | Balance needs billing scope; wrapper should surface `403 … not authorized` with scope hint. |
| **projects** | `Project[]` array (64 items) | — | **Stable** | Includes `is_default`. |

**Overall verdict:** `doctl <svc> list|get --output json` is **stable and wrap-worthy** as primary rung — doctl is a thin `godo` serializer, field names are `snake_case` API originals, envelope is consistently `[]` for lists and `{}` for gets, errors are `{"errors":[{detail}]}` with exit 1. No per-command JSON normalization needed beyond handling the single error envelope and raising `maxBuffer`. Pagination is internal to doctl (no client cursor), so `do-axi` should not attempt to page — just parse full array and apply TOON truncation (`--full` to bypass). **Ponytail-appropriate:** `execFile("doctl", ["--output","json", ...], {maxBuffer: 10<<20})` → `JSON.parse` → `toToon(map)` covers ~14/21 services with zero REST.

---

## 6. Raw probe log (abridged)

```
doctl version 1.159.0-release
config: /Users/mirko/Library/Application Support/doctl/config.yaml
auth-contexts: { my-context: <hex>, my-context-2: dop_v1_..., default: "true" }
context: my-context

DIGITALOCEAN_ACCESS_TOKEN=""   DIGITALOCEAN_API_TOKEN="" (env unset)

doctl account get --output json            → {droplet_limit:500,…} exit 0
doctl account get --context doesnotexist … → {"errors":[…]} exit 1
doctl --config $TMP/empty.yaml account get → {"errors":["access token is required"]} exit 1
DIGITALOCEAN_ACCESS_TOKEN=dop_v1_fake \
  doctl --config $TMP/empty.yaml account get → 401 {"errors":[…]} exit 1 (proves env read)
DIGITALOCEAN_API_TOKEN=fake \
  doctl --config $TMP/empty.yaml account get → "access token is required" exit 1 (proves NOT read)

doctl compute droplet list --output json | wc -c → 1100859 (162 droplets)
node execFileSync default maxBuffer 1MB → ENOBUFS (proven)
doctl compute droplet list --format json → Error: unknown column "json" exit 1
doctl compute droplet list --output json --format ID → works (format ignored in json mode) exit 0? actually format ignored

doctl databases list --output json | jq length → 12
doctl apps list --output json | jq length → 17
doctl kubernetes cluster list --output json → [] exit 0
doctl balance get --output json → {"errors":[403]} exit 1
doctl compute droplet get 999999999 --output json → {"errors":[404]} exit 1
```

---

## 7. Open questions for ticket 08 / implementation

- Confirm `godo` token scope matrix for `balance`/`billing` vs core resources — should `do-axi` home skip balance on 403 or surface `403` hint?
- Decide whether `do-axi` should honor `DIGITALOCEAN_CONTEXT` env as well (doctl does via viper) — recommend yes (pass `--context $DIGITALOCEAN_CONTEXT` if set and token not explicit).
- Decide redaction policy for `databases list` `connection.uri` / `users[].password` (TOON should omit by default, `--full --show-secrets` only).
- Buffer size: 10 MB suffices for 162 droplets (1.1 MB); for 1000 droplets extrapolates to ~6–7 MB — 10 MB still safe, 20 MB future-proof. No streaming needed.

---

*Probe by local exec + `gh api contents` README reads. Re-run after `doctl` upgrade to 1.167.0 to confirm no flag changes.*
