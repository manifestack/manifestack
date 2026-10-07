# STACK.md format

STACK.md lives in `.manifestack/STACK.md` at the repository root. People read it; agents parse it. Keep it short. Scripts use that path when no file is given.

```markdown
## Requirements
budget: ~$600/mo
users: 9k now, 50k by Q3
requires: EU database, SOC 2 vendors
prefer: Postgres, Next.js
avoid: Kubernetes, MongoDB

## Database: Supabase
plan: free
limit: 500 MB database, pauses after 7 days idle
source: supabase.com/pricing  # read 2026-10-06
usage: 312 MB, +1.1 MB/day (2026-10-06)
decided: stay on Free until first paying user
revisit_when: db_size > 400 MB OR date >= 2027-02-01
next: Pro, $25/mo
env: SUPABASE_URL, SUPABASE_ANON_KEY  # names only
```

## Sections

- `## Requirements`: keys `budget`, `users`, `requires`, `prefer`, `avoid`. Free text values. `requires` holds hard rules from outside (region, certifications, contracts); `prefer` what the team knows or wants to use; `avoid` vendors, technologies or setups the team rules out (Kubernetes, a specific cloud, self-hosting, lock-in), with an optional reason as a comment.
- `## <Role>: <Vendor>`: one per service. Roles: `Hosting`, `Database`, `Auth`, `Email`, `Storage`, `Payments`, `Monitoring`, `AI`, `Other`. A vendor that serves two roles gets two sections (`## Database: Supabase`, `## Auth: Supabase`) only if both are used.

## Keys of a service section

| Key | Value |
| --- | --- |
| `plan` | Current plan name as the vendor calls it. |
| `limit` | The limits that matter for this project, in the vendor's words. |
| `source` | Page the limits came from, then `# read YYYY-MM-DD`. Add `(no page map)` for unmapped vendors. |
| `usage` | Current reading, optional rate, and the date: `312 MB, +1.1 MB/day (2026-10-06)`. |
| `decided` | What was chosen on purpose and why. Written by people; change only when asked. |
| `revisit_when` | When to look again (grammar below). |
| `next` | Next plan and its price: `Pro, $25/mo`. |
| `env` | Env var names the service uses. Names only, never values. |

Unknown keys are allowed and must be kept when updating. Comments after `  # ` belong to the user; keep them.

## Who changes what

| Fields | Kind | An audit or init may |
| --- | --- | --- |
| `usage`, `limit`, `source`, `env` | facts read today | write them, with the date |
| `plan`, `decided`, `revisit_when`, `next` | decisions of the team | propose new lines; write them only after a yes |
| `## Requirements` | the team's constraints | propose; write only after a yes (in `init`, write what the user told you) |

In `init` the file is new and comes from the stack the user asked for: write the decision fields, and start `decided` with `proposed (init, <date>):` until the user confirms the stack.

A new section for a service that has none is a fact (the service is in the code), so it can be added; fill the decision fields only with what the user confirmed, or leave them out.

## `usage`

```
usage: <quantity>[, <rate>] (<YYYY-MM-DD>)
usage: <metric> <quantity>[, <rate>] (<date>); <metric> <quantity> (<date>)
```

- quantity: `312 MB`, `3.4 TB`, `41,200`, `9k`, `$540`
- rate: `+1.1 MB/day`, `+14 MB/week`, `+18%/mo`
- Without a metric name, the reading is bound to the only metric in `revisit_when`. With several metrics, name them: `usage: monthly_sent 41,200, +18%/mo (2026-10-01); daily_peak 2,900 (2026-10-01)`.

## `revisit_when` grammar

```
expr       := and_expr ( "OR" and_expr )*
and_expr   := primary ( "AND" primary )*
primary    := "(" expr ")" | comparison | "before launch"
comparison := metric op value
op         := ">" | ">=" | "<" | "<="
metric     := db_size | monthly_sent | daily_peak | transfer_tb | mau | users | monthly_bill | date
value      := quantity (same forms as usage) | YYYY-MM-DD (for date)
```

- `AND` binds tighter than `OR`; use parentheses when mixing them.
- Sizes are decimal: 1 GB = 1000 MB. A unitless value on a metric named `*_tb`, `*_gb` or `*_mb` is in that unit (`transfer_tb > 1.5`).
- `users` comes from `Requirements` → `users` (the first number) unless usage says otherwise.
- `before launch` cannot be evaluated by a script: ask the user whether the product has launched.
- Other snake_case metric names work if `usage` provides them; lint warns about them.

Examples:

```
revisit_when: db_size > 400 MB OR date >= 2027-02-01
revisit_when: monthly_sent >= 40k OR daily_peak > 90
revisit_when: transfer_tb > 1.5 AND monthly_bill > $300
revisit_when: before launch
```

## Commands

```bash
node <skill-dir>/scripts/stack-md.mjs parse .manifestack/STACK.md
node <skill-dir>/scripts/stack-md.mjs check .manifestack/STACK.md --metric db_size="420 MB"
node <skill-dir>/scripts/stack-md.mjs lint .manifestack/STACK.md
node <skill-dir>/scripts/stack-md.mjs set .manifestack/STACK.md --section "Database: Supabase" \
  --set "usage=312 MB, +1.1 MB/day (2026-10-06)" \
  --set "source=supabase.com/pricing" --comment "source=read 2026-10-06"
```

`set` changes only the given keys (and creates the section if needed), keeps all other lines, and refuses values that look like secrets. `check` exits 0 and reports `triggered`, `ok`, `unknown` (lists missing metrics) or `manual` per section, plus `next`, the nearest date. `lint` exits 2 if it finds anything that looks like a secret.

## Never in STACK.md

Secret values, API keys, tokens, connection strings, passwords, customer data, payment data. If lint flags a line, remove the value and keep only the name.
