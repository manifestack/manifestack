# Audit report format

## A finding

| Field | Content |
| --- | --- |
| `kind` | `Limit`, `Bill`, `Risk`, `Requirement`, `Overlap` or `Overbuilt` |
| `title` | `<Vendor> <plan>: <what>` |
| `evidence` | Numbers or a fact from the code, and where it came from: code, user, export, MCP |
| `when` | `ETA ~Mar 2027`, `Every month, growing`, `Before launch`, `Now` |
| `cost` | Money or time: `~$360/mo overage`, `$25/mo on Pro`, `~1 day of migration` |
| `fix` | One concrete action: a setting, a planned upgrade, or a deliberate switch |
| `source` | Vendor page and the date it was read; `unverified` if the page could not be read |

## Kinds

- **Limit**: a plan limit will be reached. `when` is an ETA from `scripts/project.mjs eta`.
- **Bill**: overage on the vendor's published rates. `cost` from `scripts/project.mjs overage`.
- **Risk**: breaks the product at a peak: a daily send cap on launch day, API rate limits, project pausing, cold starts.
- **Requirement**: a published region, certification or plan term does not meet `Requirements` in STACK.md.
- **Overlap**: two services do the same job (two auth providers, two email senders). Both must really be used in the code.
- **Overbuilt**: infrastructure or framework far larger than the load (Kubernetes for 40 users, SSR where static pages work). `cost` is the monthly money or upkeep time saved.

## Example

| | |
| --- | --- |
| kind | Limit |
| title | Supabase Free: database size |
| evidence | 312 / 500 MB, +1.1 MB/day (user, 2026-10-06) |
| when | ETA ~Mar 2027 |
| cost | $25/mo on Pro |
| fix | Archive `events` rows older than 90 days, or schedule the upgrade for February. |
| source | supabase.com/pricing, read 2026-10-06 |

## Layout

1. One line: what was scanned (vendors found, pages read, date).
2. Findings, nearest `when` first, then by cost. Use a table per finding or one compact table with all seven fields; keep `fix` specific (a setting, a file, a plan, a date).
3. Summary:
   - **Next deadline**: the nearest `when` with a date.
   - **Spend to review**: total monthly cost of all `Bill` findings plus upgrades the `Limit` and `Risk` findings make necessary, and ×12 per year. Say what is included.
   - **Pricing read**: number of pages and the date (`5 pages, Oct 6`). List `unverified` ones.
   - **STACK.md**: the path (`.manifestack/STACK.md`) and what changed.
4. If requirements were checked: one sentence that this compares the vendors' published regions and certifications and is not a legal guarantee; compliance decisions stay with the user.
5. **Also noticed** (optional): one line each for blockers outside pricing seen during the scan (security advisories on framework versions, missing lockfile, infrastructure code that cannot apply). No `when`/`cost` needed; say what you saw and where.
6. **Proposed STACK.md changes** (if any): the exact lines for `plan`, `decided`, `revisit_when` or `next` you suggest, waiting for a yes.
7. If nothing was found for a kind, do not list it. If nothing was found at all, say what was checked and when to run the audit again (the nearest `revisit_when`).

## Rules

- No finding without a source. No price from memory.
- Compare like with like. A saving or a comparison between two setups lists the same components on both sides (if the current setup has a load balancer, the proposed one either has one too or says why it needs none). Show the line items and make sure they add up to the totals you state; `scripts/project.mjs cost` does the sums.
- Money in the vendor's currency as published (usually USD), rounded: `~$360/mo`.
- Do not rank vendors or recommend a switch unless the fit is really wrong; then give the switch's cost in time.
- Evidence from the user is labeled as such; the report is as current as its inputs.
