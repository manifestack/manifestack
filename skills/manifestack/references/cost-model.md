# Cost model

`scripts/project.mjs cost` prices a stack at several user counts and picks the cheapest plan that fits for each vendor. Write the model to `.manifestack/tmp/<name>.json` (a working file; the script keeps that folder out of git) and run `node <skill-dir>/scripts/project.mjs cost .manifestack/tmp/<name>.json`.

```json
{
  "users": [1000, 10000, 100000],
  "vendors": [
    {
      "id": "acme-db",
      "per_user": { "db_mb": 2, "mau": 1 },
      "fixed": { "seats": 2 },
      "plans": [
        { "name": "Starter", "base": 0, "metrics": { "db_mb": { "included": 100, "hard": true }, "mau": { "included": 1234, "hard": true } } },
        { "name": "Team", "base": 49, "credit": 10, "metrics": { "db_mb": { "included": 5000, "price": 0.2, "per": 1000 }, "mau": { "included": 50000, "price": 0.004 }, "seats": { "included": 1, "price": 12 } } }
      ]
    }
  ]
}
```

The vendor and every number above are made up; they only show the shape. Every `base`, `included`, `price` and `credit` comes from a page read in this run (`references/vendor-pages.md`).

## Fields

- `users`: the counts to price. Add the counts from the brief or from `Requirements` → `users` (launch, now, the target) to the standard ones.
- `per_user`: what one user adds per month (`db_mb`, `transfer_gb`, `emails`, `requests`). These are assumptions: state each in the answer so the user can correct it. Stored data (database, files) is the size at month 12, not per month.
- `fixed`: what does not grow with users: paid dashboard seats, projects, environments (production, staging, a preview per pull request), a fixed number of servers. Per-seat and per-project charges go here, never in `per_user`, or they are multiplied by the user count.
- `plans[].metrics`: per metric, `included` (free quota), `price` per `per` units beyond it, and `hard: true` when the plan stops at the limit instead of billing. A metric with no `price` is a hard limit too.
- `plans[].credit`: usage credit a plan includes each month (spent against overage, never against `base`).
- `plans[].eligible: false`: a plan this project cannot use, such as a non-commercial tier for a commercial product.
- Sizes are decimal (1 GB = 1000 MB); a string with a unit works (`"500 MB"` on a `*_mb` metric).

## Plans that are not monthly list prices

- Annual billing: `base` is the yearly price ÷ 12; name the plan `Team (annual, $588 upfront)`.
- Flat-rate, committed or bundle tiers: add them as plans, so the script picks them when they are cheaper than on-demand.
- One currency per model. If vendors bill in different currencies, keep separate totals or convert at a rate the user gives; say which. Prices are before tax: say so when the user's budget includes VAT.

## Results

- Show users × monthly cost per vendor and the total, with the plan each count lands on. The totals equal the sum of the rows.
- A vendor whose prices are `unverified` stays out of the model. Then every total and the budget sentence name what is missing: "~$71/mo without Clerk (its price is unverified)". Never say a stack fits the budget while a paid vendor is left out.
- `plan: null` means no listed plan fits: say the next tier is "contact sales" or needs a page you have not read.
