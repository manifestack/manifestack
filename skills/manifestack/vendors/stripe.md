---
# generated, edit catalog/vendors/stripe.md (then run: node tools/sync.mjs)
schema: 1
id: stripe
name: Stripe
roles: [payments]
detect:
  packages: ["stripe", "@stripe/", "@better-auth/stripe", "@payloadcms/plugin-stripe"]
  pypi: ["stripe", "stripe-agent-toolkit"]
  go: ["github.com/stripe/stripe-go"]
  imports: ["stripe", "@stripe/", "@better-auth/stripe", "@payloadcms/plugin-stripe"]
  env_prefixes: ["STRIPE_", "NEXT_PUBLIC_STRIPE_", "VITE_STRIPE_", "EXPO_PUBLIC_STRIPE_"]
  config_files: []
pages:
  pricing: https://stripe.com/pricing
  rate_limit: https://docs.stripe.com/rate-limits
  regions: https://stripe.com/global
  currencies: https://docs.stripe.com/currencies
  payouts: https://docs.stripe.com/payouts
  tax: https://docs.stripe.com/tax
  tax_pricing: https://stripe.com/tax/pricing
  tax_countries: https://docs.stripe.com/tax/supported-countries
  merchant_of_record: https://docs.stripe.com/payments/managed-payments
  security: https://docs.stripe.com/security
  dpa: https://stripe.com/legal/dpa
read:
  - per-transaction fee for domestic cards, and the extra fees for international cards, currency conversion, disputes and other payment methods in the account's country
  - paid add-ons the code uses and how each is billed (Billing, Invoicing, Tax, Radar, Connect, Payment Links), from the pricing page
  - merchant of record - the business by default; Managed Payments makes Stripe the merchant of record for eligible digital products and lists unsupported integrations
  - who calculates, collects, files and remits sales tax and VAT (Stripe Tax calculates and collects; registrations stay with the business; filing is a separate option) and Stripe Tax fee kinds
  - countries where a business can open an account, and Stripe Tax business and customer locations
  - presentment and settlement currencies, and minimum charge amounts per currency
  - payout schedules (daily, weekly, monthly, manual) and the first payout delay
  - API rate limits, live versus sandbox, per-endpoint limits and the read request allocation per transaction
  - certifications (PCI DSS service provider level, SOC 1 and SOC 2 Type II, SOC 3) and DPA
usage_questions:
  - metric: monthly_volume
    ask: Gross payment volume last month, and the month before?
    where: Dashboard → Reports → Balance summary → Balance change from activity (charge category, gross column)
  - metric: transactions
    ask: Number of successful payments last month?
    where: Dashboard → Reports → Balance summary → Balance change from activity (charge category, count column)
  - metric: monthly_bill
    ask: Stripe fees last month, including Billing, Tax and Radar fees?
    where: Dashboard → Reports → Balance summary → Balance change from activity (fee column, and the fee category for Stripe product fees)
  - metric: tax_registrations
    ask: Where is the business registered to collect tax, and is Stripe Tax collecting there?
    where: Dashboard → Tax → Locations
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - turn on Stripe Tax, or Managed Payments for eligible digital products, if the requirements need sales tax and VAT handled
  - present prices in the settlement currency where possible to reduce conversion fees
  - add a settlement bank account in another supported currency if many customers pay in it
  - set the payout schedule on purpose (daily, weekly, monthly or manual) and plan cash flow around the first payout delay
  - use list filters, webhooks or Data Pipeline instead of polling the API to stay within read request allocations
  - ask Stripe Support for a rate limit increase well before a planned launch or sale
verified: 2026-10-07
---

- Stripe is not the merchant of record by default: the business owes sales tax and VAT where it is registered or over a threshold. If the requirements say "EU VAT handled for us", Stripe alone is a Requirement-type finding; Stripe Tax (business still registers) or Managed Payments (Stripe as merchant of record, limited to eligible digital products sold through Checkout or Payment Links, no Connect) are the options to compare.
- Stripe and another payment provider (Paddle, Lemon Squeezy, Polar) in the same codebase is an Overlap finding, unless one is a documented migration in progress.
- Do not use the Stripe MCP server. It is official (remote `https://mcp.stripe.com`) and its `stripe_api_write` tool creates refunds, invoices, payment links and subscriptions. Permissions can be narrowed with OAuth grants or agent API keys, but there is no server-side read-only switch, and the skill never handles keys. Ask the user for numbers from the Balance summary report instead.
- Fees in the Balance summary are in the settlement currency, after conversion. Stripe Billing and Stripe Tax fees show up as Stripe fees (`fee` reporting category), separate from per-payment processing fees.
- `stripe` also matches a common word in imports and env vars. Trust the package.json entry first.
