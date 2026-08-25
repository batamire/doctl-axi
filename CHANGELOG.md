# Changelog

All notable changes to this project will be documented in this file.

## [0.2.4](https://github.com/batamire/doctl-axi/compare/v0.2.3...v0.2.4) (2026-08-25)


### Bug Fixes

* expose activeDeploymentPhase via app get/list for deployment polling ([9826a17](https://github.com/batamire/doctl-axi/commit/9826a17f93eecb4b7dc7ef18b62e958cd840ae3c))

## [0.2.3](https://github.com/batamire/doctl-axi/compare/v0.2.2...v0.2.3) (2026-08-24)


### Bug Fixes

* make app logs component-aware and expose components via app get ([98f50a6](https://github.com/batamire/doctl-axi/commit/98f50a6bb195ddcd0298cd9d06c7c367354899cf))

## [0.2.2](https://github.com/batamire/doctl-axi/compare/v0.2.1...v0.2.2) (2026-08-24)


### Bug Fixes

* harden remaining get handlers to unwrap array and support --fields ([f6a8a4a](https://github.com/batamire/doctl-axi/commit/f6a8a4a1f70df3b825030169db0f2f38f4dd7fad))

## [0.2.1](https://github.com/batamire/doctl-axi/compare/v0.2.0...v0.2.1) (2026-08-24)


### Bug Fixes

* unwrap array response for app get and volume get ([70f5017](https://github.com/batamire/doctl-axi/commit/70f50175fb7f3ea97ccb57f78227390494dc1946))

## [0.2.0](https://github.com/batamire/doctl-axi/compare/v0.1.1...v0.2.0) (2026-08-22)


### Features

* **21:** droplet CRUD — get/create/delete/actions (stories 2-5), help table from single source ([f6c27da](https://github.com/batamire/doctl-axi/commit/f6c27da2c5079f6e8d6e1112a66afffa75f579ca))
* **22:** idempotent deletes — upstream 404 becomes already_deleted success (exit 0) ([b6c2b33](https://github.com/batamire/doctl-axi/commit/b6c2b3374e363753327784c496de9e827b476dd9))
* **23:** sensitive-field TOON filtering — password/connection.uri never printed ([230972d](https://github.com/batamire/doctl-axi/commit/230972df0e9bf06bb0dab1d882cab85f669ce34f))
* **24:** close unknown-flag rejection gaps — database create/sub-actions, k8s create, kubeconfig ([3f1e0db](https://github.com/batamire/doctl-axi/commit/3f1e0dbe09e5fa813c8ee9e83a78d8d1d2d6c9b3))
* **9:** adopt gh-axi simple-count — 'count: N' replaces degenerate 'count: N of N total' ([7a0706f](https://github.com/batamire/doctl-axi/commit/7a0706fc09dcf82e9ed490dcbe4deb10cc182ace))
* rename bin to doctl-axi — wraps doctl, matches ecosystem convention (gh-axi wraps gh, aws-axi wraps aws) ([c9ae63b](https://github.com/batamire/doctl-axi/commit/c9ae63b856a6c2293e4171b8b62f1dfe0e21a502))
* **review-decisions:** [#10](https://github.com/batamire/doctl-axi/issues/10) duplicate-flag rejection centralized; [#11](https://github.com/batamire/doctl-axi/issues/11) docs projection unified ([0c63bda](https://github.com/batamire/doctl-axi/commit/0c63bdac85c6b12816a2e9aee2134a2932519de7))


### Bug Fixes

* publish as doctl-axi — npm rejects do-axi (d3-axis similarity guard) ([8b00460](https://github.com/batamire/doctl-axi/commit/8b00460cbfbab3303c53e358b322da5453ba0a6b))
* **review:** registry gc cancel reports cancelled/already_cancelled, not delete envelope ([113c094](https://github.com/batamire/doctl-axi/commit/113c0946785fde2ed5f0a6256486848c1bf1caa4))
* **simplify/C13:** explicit toExecResult exit-code precedence; NaN can no longer reach exitCode ([9e08bca](https://github.com/batamire/doctl-axi/commit/9e08bcaa4e440f80b9a5e6501311528c2c416cc8))

## 0.1.0 - 2026-08-20

- Initial release: 15 nouns, dashboard, setup hooks, skills, packaging.
