---
# generated, edit catalog/vendors/lemon-squeezy.md (then run: node tools/sync.mjs)
schema: 1
id: lemon-squeezy
name: Lemon Squeezy
roles: [payments]
detect:
  packages: ["@lemonsqueezy/", "@lemonsqueezy/lemonsqueezy.js"]
  imports: ["@lemonsqueezy/"]
  env_prefixes: ["LEMONSQUEEZY_", "LEMON_SQUEEZY_", "NEXT_PUBLIC_LEMONSQUEEZY_", "VITE_LEMONSQUEEZY_"]
  config_files: []
  pypi: []
  go: []
pages:
  pricing: https://www.lemonsqueezy.com/pricing
  fees: https://docs.lemonsqueezy.com/help/getting-started/fees
  rate_limit: https://docs.lemonsqueezy.com/api
  regions: https://docs.lemonsqueezy.com/help/getting-started/supported-countries
  currencies: https://docs.lemonsqueezy.com/help/payments/currencies
  payouts: https://docs.lemonsqueezy.com/help/getting-started/getting-paid
  merchant_of_record: https://docs.lemonsqueezy.com/help/payments/merchant-of-record
  tax: https://docs.lemonsqueezy.com/help/payments/sales-tax-vat
  acceptable_use: https://docs.lemonsqueezy.com/help/getting-started/prohibited-products
  legal: https://www.lemonsqueezy.com/terms
  status_update: https://www.lemonsqueezy.com/blog/2026-update
  dpa: https://www.lemonsqueezy.com/dpa
read:
  - current status of Lemon Squeezy after the Stripe acquisition (the 2026 update post and any banner on the pricing page) - whether new signups and new features continue, and the announced migration path to Stripe Managed Payments
  - per-transaction platform fee and the extra fee kinds (international, PayPal, subscription, abandoned cart recovery, affiliate referral and affiliate payout fees, payout fees), from the fees page
  - merchant of record scope - Lemon Squeezy (contracting entity named in the terms) resells the product, collects and remits sales tax and VAT, and handles refunds, chargebacks and PCI compliance; the seller still owes income tax
  - what may not be sold (prohibited products - physical goods, services, adult content, regulated and high-risk categories) and the risk of the store being placed in review or suspended
  - payout schedule (twice monthly), holding period, minimum payout threshold, payout methods (bank transfer or PayPal) and payout currency
  - supported seller and payout countries (bank versus PayPal payouts), unsupported customer countries, and invite-only countries for bank payouts
  - store currency versus charge currency (transactions are processed in one currency and converted)
  - API rate limit kind (calls per minute per API key) and the rate limit response headers
  - DPA (SCCs for EU transfers) and the PCI DSS statement in the terms; no separate security or certification page is published
usage_questions:
  - metric: monthly_volume
    ask: Revenue last month, and the month before?
    where: Lemon Squeezy dashboard → Orders (app.lemonsqueezy.com/orders), filter by date, or Export to get the CSV emailed to the store owner
  - metric: transactions
    ask: Number of orders (including subscription renewals) last month?
    where: Lemon Squeezy dashboard → Orders → Export (CSV with one row per order)
  - metric: payout_threshold
    ask: Payout method (bank or PayPal), payout currency and upcoming payout status?
    where: Lemon Squeezy dashboard → Settings → Payout
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - read the current status post before building new work on Lemon Squeezy, and plan the move to Stripe Managed Payments if the announced path fits the product
  - check the product against the prohibited products list before launch, and ask support first if unsure
  - plan cash flow around the twice-monthly payout and holding period, and set the payout method and currency on purpose
  - check which extra fees apply (international buyers, PayPal, subscriptions, affiliates) before comparing the effective rate with another provider
  - use webhooks instead of polling the API, and read the rate limit headers to back off
verified: 2026-10-07
---

- Lemon Squeezy is a merchant of record owned by Stripe. The 2026 update says it keeps operating while Stripe Managed Payments takes over as the merchant-of-record product, with a migration path for existing stores. Treat a new project on Lemon Squeezy as a Requirement-type question about longevity: read the status post and the pricing page banner at run time and cite them. Some Lemon Squeezy features (storefront, file delivery, affiliates, email marketing) may not exist in Managed Payments; check before proposing the move.
- Lemon Squeezy and another payment provider (Stripe, Paddle, Polar) in the same codebase is an Overlap finding, unless one is a documented migration in progress. Lemon Squeezy plus `stripe` during a move to Stripe Managed Payments is the common deliberate case; ask.
- No official MCP server. The ones in MCP directories are community-built and return orders, customers and subscriptions; do not use them. Ask the user for numbers from the Orders page instead.
- The checkout overlay script (`lemon.js`) is often loaded from the Lemon Squeezy CDN with no npm package, so look for `LEMONSQUEEZY_` env vars and `app.lemonsqueezy.com` or `lemonsqueezy.com/checkout` URLs in the code. There is no official Python or Go SDK; packages on PyPI and Go modules named after Lemon Squeezy are unofficial.
- The legal entity in the terms and DPA has been renamed (formerly Lemon Squeezy LLC). Quote the entity name from the page when the requirements ask who the contracting party is.
