# Fit: matching a stack to a project

There is no best stack, only one that fits this project and keeps fitting as it grows. Fit works both ways: an outgrown plan hits limits and bills; an overbuilt setup costs many times what the project needs, in money and upkeep.

## Inputs

| Input | Why it matters |
| --- | --- |
| Product type | Static content, app behind a login, API and mobile backend need different rendering, hosting and auth. |
| Users now and in 6–12 months, peaks | Picks the plan tier, shows which free-tier limits come first, and sets the size of the infrastructure. |
| Budget | A ceiling for the monthly bill at the expected size; decides whether free tiers are acceptable for now. |
| Requirements | Data region, certifications (SOC 2, ISO 27001, HIPAA), SSO, contracts. Hard filters on vendors and plans. |
| Team preferences (`prefer`) | What the team knows or wants to use. A stack the team knows beats a theoretically better one. Unknown tech costs weeks. |
| Things to avoid (`avoid`) | Vendors, clouds or setups the team rules out. A filter like requirements, but set by the team. |
| Operations | Who gets paged. A team without ops time needs managed services, not clusters. |

## Rules of thumb

### Framework and rendering

- Content site, docs, marketing, blog: static generation (Astro, plain static, or a framework's static export). SSR adds function costs and cold starts for no gain.
- App behind a login: a SPA or a framework the team knows. SSR is optional; choose it for SEO-critical public pages, not by default.
- Next.js fits when you need mixed static, server-rendered and API routes in one codebase and the team knows React. It is more than needed for a static site or a pure API.
- API or mobile backend: a small server framework (Hono, Fastify, Express, or the team's language) or the database vendor's APIs.

### Hosting

- Managed platforms (Vercel, Netlify, Cloudflare, Render, Fly.io) for small teams and up to hundreds of thousands of users; watch data transfer and function usage.
- A commercial product must not run on a non-commercial plan (Vercel Hobby is personal use only).
- Containers on a managed service when there is a long-running process or a special runtime.
- Kubernetes, Terraform-managed multi-region clusters, service meshes: when several teams run many services, or contractual uptime and scale demand it. Not for one app, not for a few thousand users.

### Database

- Managed Postgres (Supabase, Neon or the cloud's own) fits most apps; Postgres knowledge transfers.
- Check region at creation: in most vendors a project's region cannot be changed later; moving is a migration.
- Free tiers pause or cap: note the size cap, inactivity pausing, compute hours.

### Auth

- One auth provider. Two (for example Clerk and Supabase Auth) is an Overlap: double cost, two user tables, sync bugs.
- Count the billed metric correctly (MAU vs retained users) and which features need a paid plan (SSO, MFA, organizations).
- Requirements on data region apply to user data too; check where the auth vendor stores it.

### Email

- Transactional email vendors have daily and monthly caps on low tiers. A launch or a digest can exceed a daily cap in an hour: a Risk, not a Limit.
- Separate transactional and marketing streams if volume grows.

### Payments

- First question: who is the merchant of record. Selling to consumers in many countries means collecting and filing VAT and sales tax; a payment processor leaves that to you, a merchant of record (Paddle, Lemon Squeezy) takes it on for a higher fee. This is a requirement, not a price comparison.
- Fees are per transaction, so cost grows with revenue, not users. Add the paid extras the product needs (subscriptions, tax, invoicing, fraud tools) before comparing.
- Check supported countries for the business entity and payouts, not only for customers.
- One payment provider unless there is a reason (a marketplace, a region the first one does not serve).

### Monitoring

- Error tracking first; product analytics and session replay when someone will look at them.
- Free plans cap events per month; past the cap events are dropped or billed. Set sampling and filters before launch, not after the first spike.
- Pick the data region at sign-up when requirements name one; it is usually fixed per organization.

### AI APIs

- Cost grows with every request and every user: price per token by model, not a flat plan. Estimate tokens per user action before picking a model.
- New accounts start on low rate-limit tiers. A launch can hit requests or tokens per minute: a Risk. Check how the account moves up a tier.
- Data retention, training on API data and data residency are requirement questions; check them against `requires` before the first customer data goes in.
- Pinned models get retired; note the deprecation date in `revisit_when`.
- Two providers can be deliberate (fallback, a cheaper model for simple calls); ask before reporting an Overlap.

## Overbuilt signals

Report an `Overbuilt` finding when the scan shows these against small usage or a tight budget:

- Kubernetes manifests, Helm charts, Terraform for a single app with low traffic (hundreds or a few thousand users).
- Multi-region or multi-cloud setup with no requirement for it.
- SSR framework for pages that are static.
- Several paid services for jobs one managed service already does in the stack (queues, cron, storage).
- Paid plans or seats far above usage.

Give the saving in money per month and in upkeep time, and the simpler setup. Price both setups line by line with the same components (compute, database, load balancer, NAT, storage, egress), so the saving is not inflated by leaving something out of the proposed side. Be respectful: the setup may be deliberate (a client requirement, a learning goal). Ask when in doubt.

## Picking among fitting options

1. Drop options that fail a hard requirement or match `avoid`. If nothing fits without breaking `avoid`, say so and ask; do not quietly propose it.
2. Prefer what is in `prefer`.
3. Prefer fewer vendors when one really covers two jobs.
4. Compare cost at the expected size and at 10× (use `scripts/project.mjs cost`).
5. Note lock-in and the cost of leaving (data export, proprietary APIs).

Say which constraint made the choice; if it changes, the choice may change.
