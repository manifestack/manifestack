# Asking the user

The code shows what is installed, not how it runs or what the team needs: the plan and region of each account, credits, services set up only in a dashboard, what customers were promised, what the team will pay for or spend time on. Ask about these; do not guess. An accurate answer is worth a few more questions, but each question must change a pick or a finding. The questions for each mode are in its workflow file; this file says how to ask.

## How to ask

- **Read before you ask.** Take what the code, the scan and `.manifestack/STACK.md` already show, and turn it into a question to confirm: "The code sets `iad1` (Washington). Is that where production runs?" is faster to answer and harder to get wrong than "Which region?".
- **Batches the tool can take.** If your agent has a multiple-choice question tool, use it; it usually takes up to four questions at a time, each with two to four options. Send a round as one or two batches, the questions that change the answer most first (budget, users, requirements, priority). Without such a tool, send a numbered list with lettered options.
- **Options, not essays.** Up to three typical answers or ranges, plus "Not sure"; the user can always type an exact number instead. Every question says in a few words what it decides ("decides the email plan").
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

When `.manifestack/STACK.md` exists, or the mode creates it, write the answers there with `stack-md.mjs set --json` (`references/stack-md.md` → Writing), each value with the comment `user YYYY-MM-DD` (today), so the next run knows where it came from and how old it is:

```json
{"priority": {"value": "least ops", "comment": "user 2026-10-08"}, "users": {"value": "1k at launch, 20k in 12 months", "comment": "user 2026-10-08"}}
```

Constraints go to `## Requirements`; plans, regions and usage to the vendor sections; a service that exists only outside the code gets its own section with `source: user`. A value the user stated in an answer is their yes for that value, so you may write it. What you inferred (a guess from the code, a default for "Not sure", a decision you recommend) is proposed and waits for a yes (`references/stack-md.md` → "Who changes what").

## Priority

Ask once per project, as its own question, and keep the answer in `priority` under `## Requirements`. Every mode and the guard use it (`references/fit.md` → Priority).

> When options trade off, what matters most? (decides which stack to lead with)
> a) lowest cost: more setup work is fine
> b) balanced
> c) least ops: managed services, pay more for less upkeep
> d) control: portable, little vendor lock-in

## Defaults for "Not sure"

All per month unless said otherwise.

| Question | Default |
| --- | --- |
| Users | the top of the range picked; with no range, 1k at launch and 10k in 12 months |
| Budget | no ceiling: show the totals and the first plan change |
| Priority | balanced |
| Requirements | none; say that regions and certifications were not checked against anything |
| Operations | nobody: managed services only |
| Paid dashboard seats | the developers named, or 2 |
| Environments | production and staging; a preview per pull request if the host offers them |
| Traffic | 300 page views per active user, 0.5 MB transferred per view, one function call per view |
| Database | 5 MB per user at month 12 |
| Emails | 10 per user, plus one digest a week to every user if the product sends digests |
| Files | 50 MB stored per user at month 12, each file downloaded three times a month |
| AI | 300 requests per active user, 2,000 tokens in and 500 out each, on the model the code names (or price a small and a large model) |
| Realtime | 10% of users connected at peak |
| Background jobs | every hour, one minute each |
| Payments | the revenue the user named; with none, say fees are a share of revenue and give the rate only |
| A usage number for a vendor already in use | none: the finding it would feed is marked "needs your number", not computed |
