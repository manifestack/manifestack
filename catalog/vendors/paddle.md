---
schema: 1
id: paddle
name: Paddle
roles: [payments]
detect:
  packages: ["@paddle/", "@paddle/paddle-js", "@paddle/paddle-node-sdk"]
  pypi: ["paddle-python-sdk"]
  go: ["github.com/PaddleHQ/paddle-go-sdk"]
  imports: ["@paddle/"]
  env_prefixes: ["PADDLE_API_KEY", "PADDLE_CLIENT_TOKEN", "PADDLE_WEBHOOK_SECRET", "PADDLE_NOTIFICATION_WEBHOOK_SECRET", "PADDLE_ENVIRONMENT", "PADDLE_VENDOR_ID", "PADDLE_SELLER_ID", "NEXT_PUBLIC_PADDLE_", "VITE_PADDLE_"]
  config_files: []
pages:
  pricing: https://www.paddle.com/pricing
  rate_limit: https://developer.paddle.com/api-reference/about/rate-limiting
  regions: https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
  currencies: https://developer.paddle.com/concepts/sell/supported-currencies
  payouts: https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid
  merchant_of_record: https://www.paddle.com/help/start/intro-to-paddle/the-legal-relationship-between-paddle-and-you
  acceptable_use: https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle
  soc2: https://www.paddle.com/legal/soc-2-compliance
  dpa: https://www.paddle.com/legal/data-processing-addendum
read:
  - per-transaction fee for checkout transactions and what it bundles (payments, tax, fraud, chargeback handling, billing support)
  - whether custom pricing is offered and which services cost extra (invoicing, advisory, implementation)
  - merchant of record - Paddle resells the product, so it collects, files and remits sales tax and VAT and appears on the customer's invoice
  - what may not be sold (Acceptable Use Policy - physical goods, human services without software, and other restricted categories) and the domain review before going live
  - unsupported seller and buyer countries
  - checkout currencies versus balance and payout currencies
  - payout schedule (monthly), the minimum payout threshold setting and payout methods
  - API rate limit kinds (per IP, pricing preview, per subscription)
  - certifications (SOC 2 Type II, PCI DSS attestation in the Trust Center) and DPA
usage_questions:
  - metric: monthly_volume
    ask: Revenue last month, and the month before?
    where: Paddle → Analytics → Explore → Revenue (or Paddle → Reports → Build reports → Transactions)
  - metric: transactions
    ask: Number of completed transactions last month?
    where: Paddle → Analytics → Explore → Transactions
  - metric: payout_threshold
    ask: Payout method and minimum payout threshold?
    where: Paddle → Business account → Payouts → Payout settings
mcp:
  official: true
  readonly_flag: "--tools=read-only (or PADDLE_MCP_TOOLS=read-only) on the local @paddle/paddle-mcp server; the remote server at mcp.paddle.com has no read-only switch"
  allowed_tools: [list_products, list_prices, list_reports, get_report]
common_fixes:
  - check the product against the Acceptable Use Policy before launch; Paddle reviews the domain and product
  - ask Paddle sales about custom pricing once volume grows
  - set the payout threshold and currency on purpose and plan cash flow around the monthly payout
  - localize checkout prices in supported currencies instead of converting at the bank
  - use webhooks instead of polling the API, and back off on rate limit errors using the Retry-After header
verified: 2026-10-08
---

- Paddle is a merchant of record: it is the seller to the customer and handles sales tax and VAT. For "EU VAT handled for us" this covers the Requirement. The trade-off is a product scope limit (software and digital products only) and a monthly payout schedule; check both against the product and cash-flow needs before proposing it.
- Paddle and another payment provider (Stripe, Lemon Squeezy, Polar) in the same codebase is an Overlap finding, unless one is a documented migration in progress.
- MCP: use only the local `@paddle/paddle-mcp` package started with `--tools=read-only`. The remote server at `mcp.paddle.com` runs arbitrary API calls through `execute` and has no read-only switch, so do not use it. Do not call `list_transactions`, `list_subscriptions` or `get_report_csv`: they return customer data. Ask the user for volume instead, or read report metadata with `list_reports` and `get_report`. Do not call `list_client_side_tokens` or `get_client_side_token` (they return tokens), or the customer, address, business and saved payment method tools.
- Paddle Billing and Paddle Classic are separate products. `@paddle/paddle-node-sdk` and the MCP server work with Paddle Billing only; a Classic integration (vendor ID, checkout script from the Paddle CDN) may have no npm package at all, so look for `PADDLE_` env vars.
