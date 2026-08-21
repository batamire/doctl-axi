# Captured-and-redacted golden fixtures over authored fixtures

CLI-seam test fixtures were hand-authored, encoding the same assumptions as the
extractor they test — `app get-deployment` shipped empty output because tests
fed `get-deployment` a bare object while real `doctl apps get-deployment
--output json` wraps the deployment in a top-level array. We decided all doctl
fixtures are **captured** from real `doctl --output json` and script-redacted
(string values replaced, structure and types preserved) before commit — the
repo is public and captures contain real account data. Authored fixtures are
prohibited. A contract-probe test (env-gated: `DOCTL_CONTRACT=1` + authed
doctl) validates golden *shapes* against live doctl on demand; the mapping
layer fails loud with `SHAPE_MISMATCH` (exit 2) when raw output is non-empty
but zero expected keys extract.

## Considered options

- Authored fixtures + probe-validated shapes — rejected: probe only runs when
  remembered; subtleties like array-wrapping still missed.
- Gitignored real fixtures — rejected: CI and contributors run on nothing.
- Per-noun required-field tables for the guard — rejected: the table is itself
  an authored assumption that can rot; generic all-keys-missing check needs no
  config.
