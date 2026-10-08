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

- `## Requirements`: keys `budget`, `users`, `requires`, `prefer`, `avoid`, `priority`. Free text values. `requires` holds hard rules from outside (region, certifications, contracts); `prefer` what the team knows or wants to use; `avoid` vendors, technologies or setups the team rules out (Kubernetes, a specific cloud, self-hosting, lock-in), with an optional reason as a comment; `priority` what the team gives up first when options trade off: `lowest cost`, `balanced`, `least ops` or `control`. A value the user gave in an interview carries the comment `# user YYYY-MM-DD`, so a later run knows its source and age (`references/interview.md`).
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

Unknown keys are allowed and must be kept when updating. A comment starts at two or more spaces followed by `#` (`source: supabase.com/pricing  # read 2026-10-06`); a `#` after a single space is part of the value (`decided: use plan #2 for now`). Comments belong to the user; keep them. Text inside `<!-- -->` is ignored.

## Who changes what

| Fields | Kind | An audit or init may |
| --- | --- | --- |
| `usage`, `limit`, `source`, `env` | facts read today | write them, with the date |
| `plan`, `decided`, `revisit_when`, `next` | decisions of the team | propose new lines; write them only after a yes (a plan the user stated in an answer is that yes) |
| `## Requirements` | the team's constraints | propose; write only after a yes (what the user told you in `init` or in an interview answer counts as one) |

In `init` the file is new and comes from the stack the user asked for: write the decision fields, and start `decided` with `proposed (init, <date>):` until the user confirms the stack.

A new section for a service that has none is a fact (the service is in the code), so it can be added; fill the decision fields only with what the user confirmed, or leave them out.

## `usage`

```
usage: <quantity>[, <rate>] (<YYYY-MM-DD>)
usage: <metric> <quantity>[, <rate>] (<date>); <metric> <quantity> (<date>)
```

- quantity: `312 MB`, `3.4 TB`, `41,200`, `9k`, `$540`. Thousands are grouped in threes (`41,200`, `41 200`, `41_200`); write decimals with a dot: `1,5 GB` cannot be read, use `1.5 GB`.
- rate: `+1.1 MB/day`, `+14 MB/week`, `+18%/mo`
- date: a real day as `YYYY-MM-DD`. An impossible date (`2026-13-01`) makes `check` report `error` for that section.
- Without a metric name, the reading is bound to the only metric in `revisit_when`. With several metrics, name them: `usage: monthly_sent 41,200, +18%/mo (2026-10-01); daily_peak 2,900 (2026-10-01)`.
- A unitless reading follows the same rule as a threshold: `transfer_tb 1.6` is 1.6 TB, `monthly_bill 540` is $540.

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
- Parentheses need no spaces around them: `(db_size > 400 MB)AND(date >= 2027-02-01)` works.
- Sizes are decimal: 1 GB = 1000 MB. A unitless value on a metric named `*_tb`, `*_gb` or `*_mb` is in that unit (`transfer_tb > 1.5`), and on `monthly_bill` (or `*_cost`, `*_spend`, `*_usd`) it is dollars. Readings in `usage` and `--metric` follow the same rule.
- `users` comes from `Requirements` → `users` (the first number: `9k now, 50k by Q3` is 9,000; `9 000` and `~9k` work) unless usage says otherwise. If that first number is not a user count (`12 months out, 3k`), `users` is unknown.
- A reading with a rate is projected from its date: if the projection crossed the threshold on or before today, the section is `triggered` with `projected: <date>`, not `ok`. Refresh `usage` to confirm.
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
node <skill-dir>/scripts/stack-md.mjs set --section "Email: Resend" --json - <<'EOF'
{"plan": "Free", "limit": "3,000 emails/mo"}
EOF
node <skill-dir>/scripts/stack-md.mjs set .manifestack/STACK.md --section "Database: Supabase" --json - <<'EOF'
{"usage": "312 MB, +1.1 MB/day (2026-10-06)", "source": {"value": "supabase.com/pricing", "comment": "read 2026-10-06"}}
EOF
```

Write values with `set --json`: it reads a JSON object from a file or from `-` (stdin), `{"key": "value"}` or `{"key": {"value": "...", "comment": "..."}}`. Pass it in a heredoc with a quoted delimiter (`<<'EOF'`) as above: text copied from a vendor page can contain `$(...)`, backticks or `$VAR`, which the shell runs or expands inside `"..."` but leaves alone in a quoted heredoc. `--set "key=value"` and `--comment "key=text"` still work for short values you typed yourself; they combine with `--json`, but a key may be given only once.

`set` changes only the given keys (and creates the section if needed), keeps all other lines and line endings, and refuses values or comments that look like secrets or span lines. A comment without a value (`{"plan": {"comment": "checked 2026-10-08"}}`) comments the existing line, and is an error if the section has no such key; an empty comment removes it. `--section` matches the heading regardless of case and of spaces around `:`. The file must be inside the current directory. `stack-md.mjs <command> --help` prints the usage.

`check` exits 0 and reports per section `triggered` (with `projected` when it comes from an old reading's trend), `ok`, `unknown` (lists missing metrics), `manual` (`before launch`), `none` (no `revisit_when`) or `error` (the section cannot be read: bad `revisit_when`, impossible date; the message is in `error`, other sections are still checked), plus `next`, the nearest date. `lint` exits 2 on errors: anything that looks like a secret, `env` with values, a `revisit_when` it cannot read, an impossible date in `usage`. Format problems are warnings and keep exit 0.

## Never in STACK.md

Secret values, API keys, tokens, connection strings, passwords, customer data, payment data. If lint flags a line, remove the value and keep only the name.
