# Asking the user

The code shows what is installed, not how it runs or what the team needs: the plan and region of each account, credits, services set up only in a dashboard, what customers were promised, what the team will pay for or spend time on. Ask about these; do not guess. An accurate answer is worth a few more questions, but each question must change a pick or a finding.

## How to ask

- **Read before you ask.** Take what the code, the scan and `.manifestack/STACK.md` already show, and turn it into a question to confirm: "The code sets `iad1` (Washington). Is that where production runs?" is faster to answer and harder to get wrong than "Which region?".
- **Batches the tool can take.** If your agent has a multiple-choice question tool, use it; it usually takes up to four questions at a time, each with two to four options. Send a round as one or two batches, the questions that change the answer most first (budget, users, requirements, priority). Without such a tool, send a numbered list with lettered options.
- **Options, not essays.** Up to three typical answers or ranges, plus "Not sure". Every question says in a few words what it decides ("decides the email plan").
- **Not sure means the default below, said out loud.** For costs and limits the default sits at the high end: underestimating a limit hurts more than overestimating it.
- **A quick way out.** Offer once: "or skip the questions and I'll use the defaults". If the user takes it, the answer says that every number is an assumption.
- **At most two rounds.** Round 1 is the big picture; round 2 asks only about what round 1 or the vendor pages made matter.
- **Skip what is known.** Do not ask what the user already said, what the code shows or what STACK.md records. Re-ask a recorded answer only when its date is older than three months or the code contradicts it. A value without a date (written by hand or by an older version) counts as current: confirm it once in the next round, then date it.
- **An answer that contradicts the code is a finding,** not a new question: the user says "data in the EU" and `vercel.json` pins `iad1` → a `Requirement` finding.
- **Screenshots and exports count.** For usage numbers, a screenshot or CSV export of the vendor's usage page works as well as typed numbers; read it and say which numbers you took from it.
- **Ask in the user's language.** Values written to STACK.md stay in English.
- **Numbers and names only.** Never ask for keys, logins, invoices or customer data.
- After the answers, say in one line which numbers came from the user, which are defaults, and which assumption moves the result most.

## Recording the answers

Write them to STACK.md with `stack-md.mjs set --json`, each value with the comment `user YYYY-MM-DD` (today), so the next run knows where it came from and how old it is:

```bash
node <skill-dir>/scripts/stack-md.mjs set --section "Requirements" --json - <<'EOF'
{"priority": {"value": "least ops", "comment": "user 2026-10-08"}, "users": {"value": "1k at launch, 20k in 12 months", "comment": "user 2026-10-08"}}
EOF
```

Constraints go to `## Requirements`; plans, regions and usage to the vendor sections; a service that exists only outside the code gets its own section with `source: user`. A value the user stated in an answer is their yes for that value, so you may write it. What you inferred (a guess from the code, a default for "Not sure", a decision you recommend) is proposed and waits for a yes (`references/stack-md.md` → "Who changes what").

## Priority

Ask once per project and keep the answer in `priority` under `## Requirements`. Both modes and the guard use it (`references/fit.md` → Priority).

> When options trade off, what matters most? (decides which stack to lead with)
> a) lowest cost: more setup work is fine
> b) balanced
> c) least ops: managed services, pay more for less upkeep
> d) control: portable, little vendor lock-in

## Init

Round 1, most important first:

1. **Budget**: monthly ceiling for infrastructure (free tiers only for now, under $300, more), and the priority above.
2. **Users**: monthly active users (people who use the product at least once a month; for B2B, not seats sold) at launch and in 12 months (under 1k, 1–10k, more), and peaks (launch day, campaigns).
3. **Requirements** (several may apply): data in the EU, data in the US or another country, a SOC 2 report for customers, SSO/SAML for customer logins, HIPAA, none.
4. **Product**: app behind a login, internal tool, content site, API or mobile backend, marketplace or other.
5. **Team**: what it knows (confirm what the repo shows), who runs operations (nobody, part-time, a dedicated person), anything it wants to avoid.
6. **What the product does a lot** (several may apply): sends email, stores files or media, AI features, realtime updates, background jobs, payments, public pages that need SEO.
7. **What the team already has**: cloud credits, a cloud or vendor the company already pays for, existing accounts.

Round 2, only for what round 1 selected:

- **Email**: emails per user per month (1–3, 4–10, more), and bursts (digests, campaigns).
- **Files or media**: typical file size, files per user per month, how often they are downloaded.
- **AI**: requests per user per day, rough prompt and answer size, whether answers must be fast.
- **Realtime**: users connected at the same time at peak.
- **Background jobs**: how often, how long each runs.
- **Payments**: who you sell to (businesses or consumers) and in which countries; this decides whether you need a merchant of record.

## Audit

After the scan, one round, only for what STACK.md does not already say. After reading the vendor pages, one short follow-up is allowed for numbers the pages made relevant (for example CDN requests once a flat-rate tier could replace an overage).

1. **Plans and regions** of each vendor found: show your guess from the code and ask to confirm.
2. **Services outside the code**: a CDN or proxy in front, DNS, cron or queue services, backups, analytics, anything set up only in a dashboard.
3. **Spend settings**: budgets, caps and alerts in vendor dashboards.
4. **Credits or committed spend**, and when they expire.
5. **What customers or contracts require**: region, certifications, uptime.
6. **What is coming**: a launch, a campaign, a large customer, users expected in 6–12 months.
7. **The priority**, if STACK.md has none.
8. **What already hurts**: a surprise bill, an outage, a limit already hit.

Put the usage numbers from `references/usage-sources.md` in the same round.

## Defaults for "Not sure"

| Question | Default |
| --- | --- |
| Users | the top of the range picked; with no range, 1k at launch and 10k in 12 months |
| Budget | no ceiling: show the totals and the first plan change |
| Priority | balanced |
| Requirements | none; say that regions and certifications were not checked against anything |
| Operations | nobody: managed services only |
| Emails | 10 per user per month, plus one digest a week to every user if the product sends digests |
| Files | 50 MB stored per user, each file downloaded three times a month |
| AI | 10 requests per active user per day, 2,000 tokens in and 500 out each |
| Realtime | 10% of users connected at peak |
| Background jobs | every hour, one minute each |
| A usage number in an audit | none: the finding it would feed is marked "needs your number", not computed |
