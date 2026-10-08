# Audit report format

## A finding

| Field | Content |
| --- | --- |
| `kind` | `Limit`, `Bill`, `Risk`, `Requirement`, `Overlap` or `Overbuilt` |
| `severity` | `Critical`, `High`, `Medium` or `Low` (see Severity) |
| `title` | What happens, then the vendor fact: `Site goes offline mid-month: <host> pauses production at its spend limit` |
| `evidence` | Numbers or a fact from the code, and where it came from: code, user, export, MCP |
| `when` | `ETA ~Mar 2027`, `Every month, growing`, `Before launch`, `Now` |
| `cost` | Money or time: `~$360/mo overage`, `$49/mo on Team`, `~1 day of migration` |
| `fix` | One concrete action and where to do it (a dashboard path, a file, a plan): `Billing > <flat-rate tier>, which covers your transfer` |
| `effort` | `minutes` (a setting or a plan change), `hours` (a code change) or `days` (a migration) |
| `source` | Vendor page and the date it was read; `unverified` if the page could not be read |

## Kinds

- **Limit**: a plan limit will be reached. `when` is an ETA from `scripts/project.mjs eta`.
- **Bill**: overage on the vendor's published rates. `cost` from `scripts/project.mjs overage`.
- **Risk**: breaks the product at a peak: a daily send cap on launch day, API rate limits, project pausing, cold starts.
- **Requirement**: a published region, certification or plan term does not meet `Requirements` in STACK.md.
- **Overlap**: two services do the same job (two auth providers, two email senders). Both must really be used in the code.
- **Overbuilt**: infrastructure or framework far larger than the load (Kubernetes for 40 users, SSR where static pages work). `cost` is the monthly money or upkeep time saved.

## Severity

One level per finding, from what happens and how soon. Count days from today.

| Level | Use it when |
| --- | --- |
| `Critical` | The product or one of its features stops, data is at risk, or a `requires` line in STACK.md is broken: now or within 30 days |
| `High` | Something stops within 90 days; spend is over the STACK.md budget now; or a new or growing bill adds more than half of today's monthly total within 90 days |
| `Medium` | Something stops later than 90 days, or a smaller bill or a forced plan change comes within 90 days |
| `Low` | Everything else: later bills, upkeep, an `Overlap` or `Overbuilt` that costs time rather than money |

Count days from today. `Before launch` counts from the launch date the user gave; with no date, take it as within 30 days. Between two levels, take the higher one and say why in `evidence`. An `unverified` finding takes the level its verified facts support and says what would raise it ("High if the cap is under 10,000 a day").

## Example

A made-up vendor, to show the fields:

| | |
| --- | --- |
| kind | Limit |
| severity | Medium |
| title | Writes stop in March: Acme DB Starter goes read-only at its size limit |
| evidence | 312 / 500 MB, +1.1 MB/day (user, 2026-10-06); read-only above the limit (pricing page) |
| when | ETA ~Mar 2027 |
| cost | the Team plan's monthly price |
| fix | Archive `events` rows older than 90 days, or schedule the upgrade for February. |
| effort | hours |
| source | acme.example/pricing, read 2026-10-06 |

## Layout

The user reads the first screen and decides whether to act. Put the answer there; keep the evidence below it.

1. **Verdict**, at most four lines:
   - what was checked and where the numbers come from: vendors found, usage from STACK.md or the user, how many vendor pages were read today;
   - the count in plain words: `Found 10: 3 outage risks, 2 compliance gaps, 2 bills, 2 limits, 1 duplicate.` (`Risk` = outage risks, `Requirement` = compliance gaps, `Bill` = bills, `Limit` = limits, `Overlap` = duplicates, `Overbuilt` = oversized setups);
   - the budget: monthly cost now and at the user target from `Requirements`, against `budget`, and the one change that matters most (`Over budget: ~$4,580/mo at 50k users against ~$600/mo. One hosting setting brings it to ~$1,920/mo.`). If usage is missing for some paid vendors, give the total for the ones you have and name the rest (`~$380/mo for hosting and email; the database and AI need your numbers`); never fill the gap with a guess.
2. **Do today** (when any fix has `effort: minutes`): those fixes in one short list, with what they save or prevent in total (`3 settings, ~15 min: saves ~$340/mo, keeps the site up`).
3. **Findings**, grouped by severity, `Critical` first; within a level, nearest `when` first, then by cost. Three lines each: `<kind> <title>`; the evidence and the `fix`; then `when · cost · effort · source`. `Medium` and `Low` findings may fold the last two lines into one. When one fix also resolves another finding, say so at both (`the flat-rate tier (4) also ends this`).
4. **Details**: a table with all nine fields, only when the user asks for it or wants a report to share; the findings above already carry every field.
5. **Summary**:
   - **Next deadline**: the nearest `when` with a date.
   - **Spend to review**: total monthly cost of all `Bill` findings plus upgrades the `Limit` and `Risk` findings make necessary, and ×12 per year. Say what is included.
   - **Assumptions** behind any projection (usage per user stays as today, what the model leaves out).
   - **Pricing read**: number of pages and the date (`21 pages, Oct 8`). List `unverified` ones.
   - **Checked, no finding**: the vendors that passed, so the user sees nothing was skipped.
   - **STACK.md**: the path (`.manifestack/STACK.md`) and what changed.
6. If requirements were checked: one sentence that this compares the vendors' published regions and certifications and is not a legal guarantee; compliance decisions stay with the user.
7. **Also noticed** (optional): one line each for blockers outside pricing seen during the scan (security advisories on framework versions, missing lockfile, infrastructure code that cannot apply). No `when`/`cost` needed; say what you saw and where.
8. **Proposed STACK.md changes** (if any): the exact lines for `plan`, `decided`, `revisit_when` or `next` you suggest, waiting for a yes.
9. If nothing was found for a kind, do not list it. If nothing was found at all, say what was checked and when to run the audit again (the nearest `revisit_when`).

## Rules

- No finding without a source. No price from memory.
- Compare like with like. A saving or a comparison between two setups lists the same components on both sides (if the current setup has a load balancer, the proposed one either has one too or says why it needs none). Show the line items and make sure they add up to the totals you state; `scripts/project.mjs cost` does the sums.
- Before a `Bill`, check the same vendor's other options: a flat-rate or committed tier, annual billing, a plan whose included quota covers the usage. If one removes the overage, it is the fix, and the `cost` is what stays.
- Money in the vendor's currency as published (usually USD), rounded: `~$360/mo`.
- Do not rank vendors or recommend a switch unless the fit is really wrong; then give the switch's cost in time.
- When a fix trades money for work, follow `priority` from STACK.md (`references/fit.md` → Priority) and give the other path in one line with its cost and effort.
- Evidence from the user is labeled as such; the report is as current as its inputs.
