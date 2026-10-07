---
schema: 1
id: polar
name: Polar
roles: [payments]
detect:
  packages: ["@polar-sh/", "@polar-sh/sdk", "@polar-sh/nextjs", "@polar-sh/checkout", "@polar-sh/better-auth"]
  imports: ["@polar-sh/"]
  env_prefixes: ["POLAR_", "NEXT_PUBLIC_POLAR_", "VITE_POLAR_"]
  config_files: []
  pypi: ["polar-sdk"]
  go: ["github.com/polarsource/polar-go"]
pages:
  pricing: https://polar.sh/docs/merchant-of-record/fees
  rate_limit: https://polar.sh/docs/api-reference/introduction
  regions: https://polar.sh/docs/merchant-of-record/supported-countries
  merchant_of_record: https://polar.sh/docs/merchant-of-record/introduction
  legal: https://polar.sh/legal/master-services-terms
  acceptable_use: https://polar.sh/docs/merchant-of-record/acceptable-use/introduction
  acceptable_use_policy: https://polar.sh/legal/acceptable-use-policy
  account_reviews: https://polar.sh/docs/merchant-of-record/account-reviews
  payouts: https://polar.sh/docs/features/finance/payouts
  balance: https://polar.sh/docs/features/finance/balance
  dpa: https://polar.sh/legal/data-processing-addendum
  sub_processors: https://polar.sh/legal/sub-processors
read:
  - plan names and whether each has a monthly fee, and the per-transaction fee on each plan (the fees page ties the transaction rate to the plan)
  - extra fee kinds - international cards, subscription payments (and which members it applies to), disputes, payout fees (monthly active-payout fee, per-payout fee, currency conversion) - and that transaction fees are not returned on refunds
  - merchant of record scope - Polar Software, Inc. resells the product and owns sales tax, VAT and GST registration and remittance; income tax stays with the seller and inbound VAT cannot be reclaimed by the seller
  - what may be sold (software, SaaS, digital products, premium content) and what may not (physical goods, human services, marketplaces, adult, financial and other restricted categories), plus categories that need enhanced review
  - account review stages - review before the first payout and continuous reviews at sales thresholds - and that payouts show as held for review while one is open
  - payouts are started manually (no automatic schedule), the settlement delay, the minimum payout amount per currency, and payout through a Stripe Connect Express account
  - supported payout countries and business types (Stripe Connect Express), and blocked buyer countries
  - reserve and payout delay rights and the post-termination holdback in the Master Services Terms
  - API rate limit kinds (per organization, customer or OAuth2 client; production versus sandbox; stricter limits on license key endpoints) and the Retry-After header
  - DPA (EU SCCs, UK addendum, security measures annex) and the sub-processor list with locations; no SOC 2 or PCI attestation is published
usage_questions:
  - metric: monthly_volume
    ask: Revenue last month, and the month before?
    where: Polar dashboard → Analytics → Orders dashboard (Revenue) and Net Revenue dashboard
  - metric: transactions
    ask: Number of orders last month, and active subscriptions today?
    where: Polar dashboard → Analytics → Orders dashboard (Orders) and Subscriptions dashboard (Active Subscriptions, MRR)
  - metric: payouts
    ask: Current balance, and how often do you start a payout?
    where: Polar dashboard → Finance (balance and transactions with fees) and Finance → Payouts
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - check the product against the Acceptable Use Policy before launch, and expect a review before the first payout
  - compare the plans on the fees page against monthly volume; the transaction rate depends on the plan
  - batch payouts on purpose, since each payout and each month with a payout adds a payout fee
  - test the integration in the sandbox environment before going live; it has its own API base URL and lower rate limits
  - use webhooks or the customer state endpoint instead of polling the API, and back off using the Retry-After header
verified: 2026-10-07
---

- Polar is a merchant of record for software and digital products. For "EU VAT handled for us" it covers the Requirement; check the product scope (no physical goods or human services) and the review before the first payout against the launch plan.
- Polar and another payment provider (Stripe, Paddle, Lemon Squeezy) in the same codebase is an Overlap finding, unless one is a documented migration in progress. `@polar-sh/better-auth` pulls Polar into a Better Auth setup; that is the payments role, not a second auth provider.
- The official MCP server (remote, `mcp.polar.sh`) uses OAuth and exposes everything through `search_tools`, `describe_tools` and `execute_tool`, so any API operation, including writes, customer data and license keys, is one call away. There is no read-only mode. Do not use it; ask the user for numbers from the Analytics page.
- There is no marketing pricing page; the fees page in the docs is the pricing source. The API reference is versioned by date (the unversioned URL redirects to the current version).
- `github.com/polarsource/polar-go` is Polar's own Go SDK but marked as no longer maintained; a project using it may need to move to raw HTTP calls. The PyPI package is `polar-sdk` (the `polar` package on PyPI is unrelated).
