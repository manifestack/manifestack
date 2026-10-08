# Mode: init

For a new or nearly empty repository. Goal: a whole stack that fits the project, priced at 1k, 10k and 100k users, written to `.manifestack/STACK.md`.

## Step 1. Ask for the fit

Ask in two rounds as `references/interview.md` → Init describes: the big picture with the priority first, then the volumes for what the product does a lot (email, files, AI, realtime, jobs, payments). Skip what the user already said (for example in `/manifestack init "B2B dashboard, EU users"`).

If the user does not know a number, take the default you offered, say the result depends on it, and name it in the answer. Do not invent numbers.

## Step 2. Propose the stack

Use `references/fit.md`. Propose every layer the product needs, and only those:

- framework and rendering model
- hosting
- database
- auth
- email (transactional; marketing only if asked)
- storage, payments, monitoring and AI APIs when the product needs them

For each pick: one or two sentences on why it fits *this* project (users, budget, requirements, team), the main limit to watch, and the realistic alternative if one constraint changes. Say clearly when something is more than the project needs: Next.js or SSR for a static site, Kubernetes or Terraform for one service, a big cloud for a few thousand users.

Lean to what is in `prefer` when it fits. Prefer one vendor covering two layers only if it really covers both; say what is lost.

## Step 3. Read the pages and price it

1. For each vendor, open the pages listed in `vendors/<id>.md` (or find the pricing page for an unmapped vendor). Read the free-tier limits, the next plan's price and included quotas, overage rates, regions and certifications. Note each page and today's date. If a page cannot be read (blocked, rendered only by JavaScript, no web tool in this session), mark its numbers `unverified` and tell the user which URL to open. Never fall back to search snippets, third-party blogs, comparison sites or memory; only the vendor's own domain counts.
2. Check requirements now: if a vendor's published regions or certifications do not meet them, change the pick or say so explicitly.
3. Write a cost model to `.manifestack/tmp/model.json` (a working file; the script keeps that folder out of git) and run `node <skill-dir>/scripts/project.mjs cost .manifestack/tmp/model.json`:

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

Every `base`, `included` and `price` comes from a page you read in this run; the numbers above only show the shape. Leave a vendor with `unverified` numbers out of the model and say so below the table; if no model can be built, say so and continue with Step 4. `per_user` values are assumptions: state them in the answer (for example "0.05 MB of data per user, every user active monthly") so the user can correct them. Mark a plan `"eligible": false` when it cannot be used (for example a non-commercial tier for a commercial product).

4. Show a table: users × monthly cost per vendor and total, with the plan each count lands on. Add the user counts from the brief (launch, 6–12 months) to `users` so they appear too. Below it list the free-tier limits that will be hit first and at roughly what user count.
5. Compare the totals with the budget in one plain sentence: "fits the $150/mo budget up to about N users" (find N by adding user counts between the two rows where the total crosses the budget), or "over budget from launch". The budget is the user's main constraint, so the crossing point is the number they will look for first. Name what drives the growth ("email is what grows").
6. Price the alternatives for other priorities that Step 5 shows the same way: add their plans to the model, or run a second model, so their totals come from the script at the same user counts.

## Step 4. Write STACK.md

Copy `assets/STACK.template.md` to `.manifestack/STACK.md` if it does not exist (create the `.manifestack/` folder at the repository root), then fill it with `node <skill-dir>/scripts/stack-md.mjs set` (format in `references/stack-md.md`):

- `## Requirements` with `budget`, `users`, `requires`, `prefer`, `avoid` and `priority` (leave `prefer` or `avoid` empty if the team named nothing).
- One `## <Role>: <Vendor>` section per chosen service with `plan`, `limit`, `source` (page and `# read YYYY-MM-DD`), `decided` (why this plan now), `revisit_when` (the condition that should trigger a new look), `next` (the next plan and its price), `env` (variable names the service will need, names only).

Pass values taken from a page through `--json` with a single-quoted heredoc, never inside `--set "…"`, where the shell expands `$(…)` and backticks:

```bash
node <skill-dir>/scripts/stack-md.mjs set --section "Email: Resend" --json - <<'EOF'
{"plan": "Free", "limit": "3,000 emails/mo", "source": {"value": "resend.com/pricing", "comment": "read 2026-10-08"}}
EOF
```

Run `node <skill-dir>/scripts/stack-md.mjs lint .manifestack/STACK.md` and fix what it reports. Tell the user what was written and that `/manifestack audit` will check it again once the code exists.

## Step 5. The answer

Lead with what the user needs to decide; keep the reasoning short.

1. **Their idea first.** If the user named a stack or part of one ("Next.js on EKS", "Firebase", "our own server"), open with keep, change or drop, and the difference in money and upkeep in one or two sentences.
2. **The stack**, built for the team's `priority` (`references/fit.md` → Priority). One block per layer: the pick and its monthly price at launch, one line on why it fits, and the first limit to watch with the next step (`50,000 emails/mo → Pro 100k, $35/mo`). Below it, **other options**: at most two whole-stack alternatives for other priorities, with totals at the same user counts, so the user can trade money for less work or more control.
3. **Not needed.** What you left out on purpose, one line each with the reason: Kubernetes, SSR behind a login, a second auth vendor, a cache or a queue the load does not need.
4. **Decide now.** Choices that are hard to change later, with the setting to pick: the region at creation (database, error tracking, auth data), the auth provider, the merchant of record for payments.
5. **Cost.** The table from Step 3, the budget sentence and what drives the growth.
6. **Requirements.** One line per requirement and how the stack meets it, with the compliance caveat.
7. **STACK.md.** What was written (Step 4).

## Done when

- the answer follows Step 5: the user's own idea first when they named one, then the stack, what is not needed and what to decide now;
- every layer has a pick with a reason, a limit to watch and a source with a date;
- costs at 1k, 10k, 100k users are shown with the assumptions;
- requirement checks are stated, with the compliance caveat;
- `.manifestack/STACK.md` exists and lints clean.
