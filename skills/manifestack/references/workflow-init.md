# Mode: init

For a new or nearly empty repository. Goal: a whole stack that fits the project, priced at 1k, 10k and 100k users, written to STACK.md.

## Step 1. Ask for the fit

Ask in one message, short and numbered. Skip what the user already said (for example in `/manifestack init "B2B dashboard, EU users"`).

1. **Product type**: content site, app behind a login, API, mobile backend, internal tool, marketplace, something else.
2. **Users**: expected now and in 6–12 months. Monthly active users is the most useful unit; also ask about peaks (launch day, campaigns).
3. **Budget**: monthly ceiling for infrastructure, and whether a free tier is a must for now.
4. **Requirements**: data region (EU, US, specific country), vendor certifications (SOC 2, ISO 27001, HIPAA), SSO for customers, data residency, anything legal or contractual.
5. **Team**: languages, frameworks and databases the team already knows; who runs operations.

If the user does not know a number, take a range and say the result depends on it. Do not invent numbers.

## Step 2. Propose the stack

Use `references/fit.md`. Propose every layer the product needs, and only those:

- framework and rendering model
- hosting
- database
- auth
- email (transactional; marketing only if asked)
- storage, payments, monitoring when the product needs them

For each pick: one or two sentences on why it fits *this* project (users, budget, requirements, team), the main limit to watch, and the realistic alternative if one constraint changes. Say clearly when something is more than the project needs: Next.js or SSR for a static site, Kubernetes or Terraform for one service, a big cloud for a few thousand users.

Prefer what the team knows when it fits. Prefer one vendor covering two layers only if it really covers both; say what is lost.

## Step 3. Read the pages and price it

1. For each vendor, open the pages listed in `vendors/<id>.md` (or find the pricing page for an unmapped vendor). Read the free-tier limits, the next plan's price and included quotas, overage rates, regions and certifications. Note each page and today's date.
2. Check requirements now: if a vendor's published regions or certifications do not meet them, change the pick or say so explicitly.
3. Write a cost model and run `node <skill-dir>/scripts/project.mjs cost model.json`:

```json
{
  "users": [1000, 10000, 100000],
  "vendors": [
    {
      "id": "supabase",
      "per_user": { "db_mb": 0.05, "mau": 1 },
      "plans": [
        { "name": "Free", "base": 0, "metrics": { "db_mb": { "included": 500, "hard": true }, "mau": { "included": 50000, "hard": true } } },
        { "name": "Pro", "base": 25, "metrics": { "db_mb": { "included": 8000, "price": 0.125, "per": 1000 }, "mau": { "included": 100000, "price": 0.00325 } } }
      ]
    }
  ]
}
```

Every `base`, `included` and `price` comes from a page you read in this run; the numbers above only show the shape. `per_user` values are assumptions: state them in the answer (for example "0.05 MB of data per user, every user active monthly") so the user can correct them. Mark a plan `"eligible": false` when it cannot be used (for example a non-commercial tier for a commercial product).

4. Show a table: users × monthly cost per vendor and total, with the plan each count lands on. Add the user counts from the brief (launch, 6–12 months) to `users` so they appear too. Below it list the free-tier limits that will be hit first and at roughly what user count.
5. Compare the totals with the budget in one plain sentence: "fits the $150/mo budget up to about N users" (find N by adding user counts between the two rows where the total crosses the budget), or "over budget from launch". The budget is the user's main constraint, so the crossing point is the number they will look for first.

## Step 4. Write STACK.md

Copy `assets/STACK.template.md` to `STACK.md` in the repository root if it does not exist, then fill it with `node <skill-dir>/scripts/stack-md.mjs set` (format in `references/stack-md.md`):

- `## Requirements` with `budget`, `users`, `requires`, `team_knows`.
- One `## <Role>: <Vendor>` section per chosen service with `plan`, `limit`, `source` (page and `# read YYYY-MM-DD`), `decided` (why this plan now), `revisit_when` (the condition that should trigger a new look), `next` (the next plan and its price), `env` (variable names the service will need, names only).

Run `node <skill-dir>/scripts/stack-md.mjs lint STACK.md` and fix what it reports. Tell the user what was written and that `/manifestack audit` will check it again once the code exists.

## Done when

- every layer has a pick with a reason, a limit to watch and a source with a date;
- costs at 1k, 10k, 100k users are shown with the assumptions;
- requirement checks are stated, with the compliance caveat;
- STACK.md exists and lints clean.
