---
# Copy to catalog/vendors/<id>.md, fill in, run `node tools/sync.mjs` and `npm test`.
# A map says WHERE to look and WHAT to extract. Never put prices or quota numbers here:
# the skill reads them from the vendor's page at run time and cites page and date.
schema: 1
id: example                     # lowercase a-z, 0-9, hyphens; same as the file name
name: Example
roles: [database, auth]         # hosting, database, auth, email, storage, payments, monitoring, ai, other
detect:
  packages: ["example-sdk", "@example/"]   # exact npm names; a trailing "/" matches the whole scope
  pypi: ["example-sdk"]                     # PyPI names (case-insensitive, - _ . equal); a trailing "*" is a prefix
  go: ["github.com/example/example-go"]     # Go module paths; ".../v2" suffixes match the base path
  imports: ["@example/", "example-sdk"]    # a package name also matches its subpaths; a trailing "/" or ":" is a prefix
  env_prefixes: ["EXAMPLE_"]               # env var NAME prefixes (values are never read)
  config_files: ["example.config.json"]    # repo-relative paths or file names
  role_signals:                            # optional: a role counts only if one of these strings is in the code
    auth: ["example.auth."]
pages:
  pricing: https://example.com/pricing
  limits: https://example.com/docs/limits
  regions: https://example.com/docs/regions
  security: https://example.com/security
read:                                      # what to extract from the pages
  - free tier quota names and sizes
  - what happens at the limit (blocked, paused, billed)
  - next plan price and included quotas
usage_questions:                           # metric names match revisit_when metrics where possible
  - metric: db_size
    ask: Database size today?
    where: Dashboard → Project → Usage
mcp:
  official: false
  readonly_flag: null                      # how read-only mode is switched on; null = do not use
  allowed_tools: []                        # read-only tools the skill may call
common_fixes:                              # settings to try before an upgrade
  - schedule the upgrade before the limit date
verified: 2026-01-01                       # last manual check of this map
---

Short notes for the auditor: billing quirks, what the dashboard calls each metric, known traps.
