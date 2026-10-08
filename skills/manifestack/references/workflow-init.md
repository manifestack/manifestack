# Mode: init

For a new or nearly empty repository. Goal: a whole stack that fits the project, priced from launch to 100k users, written to `.manifestack/STACK.md`.

## Step 1. Ask for the fit

Check first that vendor pages load (`references/vendor-pages.md` → Before the questions). Then ask in two rounds (`references/interview.md` → How to ask). Skip what the user already said (for example in `/manifestack init "B2B dashboard, EU users"`).

Round 1, most important first:

1. **Budget**: monthly ceiling for infrastructure (free tiers only for now, under $300, more, or a number).
2. **Priority**, as its own question (`references/interview.md` → Priority).
3. **Users**: monthly active users (people who use the product at least once a month; for B2B, not seats sold) at launch and in 12 months (under 1k, 1–10k, more, or a number), peaks (launch day, campaigns), and where most of them are (one region, a few, worldwide).
4. **Requirements** (several may apply): data in the EU, data in the US or another country, a SOC 2 report for customers, SSO/SAML for customer logins, HIPAA, an uptime promise (SLA), none.
5. **Product**: app behind a login, internal tool, content site, API or mobile backend, marketplace or other.
6. **Team**: what it knows (confirm what the repo shows), how many people need paid dashboard seats, who runs operations (nobody, part-time, a dedicated person), anything it wants to avoid.
7. **What the product does a lot** (several may apply): sends email, stores files or media, AI features, realtime updates, background jobs, payments, public pages that need SEO.
8. **What the team already has**: cloud credits, a cloud or vendor the company already pays for, existing accounts.

Round 2, only for what round 1 selected:

- **Traffic**: page views per active user per month (under 50, 50–300, more), and whether pages are heavy (images, video); decides hosting transfer and functions.
- **Environments**: production only, plus staging, plus a preview per pull request; decides per-project and per-seat charges.
- **Email**: emails per user per month (1–3, 4–10, more), and bursts (digests, campaigns).
- **Files or media**: typical file size, files per user per month, how often they are downloaded.
- **AI**: requests per user per month, rough prompt and answer size, whether answers must be fast, and the model class (a small fast model or a frontier model; prices differ many times over).
- **Realtime**: users connected at the same time at peak.
- **Background jobs**: how often, how long each runs.
- **Payments**: who you sell to (businesses or consumers), in which countries, and the expected monthly revenue and typical payment size; decides the merchant of record and the fees.

If the user does not know a number, take the default from `references/interview.md`, say the result depends on it, and name it in the answer. Do not invent numbers.

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

1. For each vendor, read its pages as `references/vendor-pages.md` says: the free-tier limits, the next plan's price and included quotas, overage rates, seats and per-project charges, and, when `requires` names them, regions and certifications.
2. Check requirements now: if a vendor's published regions or certifications do not meet them, change the pick or say so explicitly.
3. Price the stack with `scripts/project.mjs cost` (`references/cost-model.md`): the user counts from the brief next to 1k, 10k and 100k, the seats and environments from Step 1 in `fixed`, and the workload in `per_user`.
4. Show the table: users × monthly cost per vendor and total, with the plan each count lands on. Below it list the free-tier limits that will be hit first and at roughly what user count.
5. Compare the totals with the budget in one plain sentence: "fits the $150/mo budget up to about N users" (find N by adding user counts between the two rows where the total crosses the budget), or "over budget from launch". If a paid vendor is out of the model, say so in the same sentence (`references/cost-model.md` → Results). Name what drives the growth ("email is what grows").
6. Price the alternatives for other priorities that the answer shows the same way: add their plans to the model, or run a second model, so their totals come from the script at the same user counts.

## Step 4. Write STACK.md

Copy `<skill-dir>/assets/STACK.template.md` to `.manifestack/STACK.md` if it does not exist (create the `.manifestack/` folder at the repository root), then fill it with `stack-md.mjs set` (`references/stack-md.md` → Writing):

- `## Requirements` with `budget`, `users`, `requires`, `prefer`, `avoid` and `priority` (leave `prefer` or `avoid` empty if the team named nothing), each with `# user <date>`.
- One `## <Role>: <Vendor>` section per chosen service with `plan`, `limit`, `source` (page and `# read YYYY-MM-DD`), `decided` starting with `proposed (init, <date>):` until the user confirms the stack, `revisit_when` (the condition that should trigger a new look), `next` (the next plan and its price), `env` (variable names the service will need, names only).

Run `node <skill-dir>/scripts/stack-md.mjs lint .manifestack/STACK.md` and fix what it reports. Tell the user what was written and that `/manifestack audit` will check it again once the code exists.

## Step 5. The answer

Lead with what the user needs to decide; keep the reasoning short.

1. **Their idea first.** If the user named a stack or part of one ("Next.js on EKS", "Firebase", "our own server"), open with keep, change or drop, and the difference in money and upkeep in one or two sentences.
2. **The stack**, built for the team's `priority` (`references/fit.md` → Priority). One block per layer: the pick and its monthly price at launch, one line on why it fits, and the first limit to watch with the next step (the limit, then the next plan and its price). Below it, **other options**: at most two whole-stack alternatives for other priorities, with totals at the same user counts, so the user can trade money for less work or more control.
3. **Not needed.** What you left out on purpose, one line each with the reason: Kubernetes, SSR behind a login, a second auth vendor, a cache or a queue the load does not need.
4. **Decide now.** Choices that are hard to change later, with the setting to pick: the region at creation (database, error tracking, auth data), the auth provider, the merchant of record for payments.
5. **Cost.** The table from Step 3, the budget sentence and what drives the growth.
6. **Requirements.** One line per requirement and how the stack meets it, with the compliance caveat.
7. **STACK.md.** What was written (Step 4).

## Done when

- the answer follows Step 5: the user's own idea first when they named one, then the stack, what is not needed and what to decide now;
- every layer has a pick with a reason, a limit to watch and a source with a date;
- costs from launch to 100k users come from the script, with the assumptions stated;
- requirement checks are stated, with the compliance caveat;
- `.manifestack/STACK.md` exists and lints clean.
