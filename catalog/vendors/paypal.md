---
schema: 1
id: paypal
name: PayPal
roles: [payments]
detect:
  packages: ["@paypal/", "paypal-rest-sdk", "paypal-checkout", "react-paypal-button-v2", "braintree", "braintree-web", "braintree-web-drop-in", "braintree-web-drop-in-react"]
  pypi: ["paypal-server-sdk", "paypalserversdk", "paypalrestsdk", "paypal-checkout-serversdk", "paypalcheckoutsdk", "paypal-payouts-sdk", "paypalpayoutssdk", "braintree"]
  imports: ["@paypal/", "paypal-rest-sdk", "paypal-checkout", "react-paypal-button-v2", "braintree", "braintree-web", "braintree-web-drop-in", "braintree-web-drop-in-react"]
  env_prefixes: ["PAYPAL_", "NEXT_PUBLIC_PAYPAL_", "VITE_PAYPAL_", "REACT_APP_PAYPAL_", "BRAINTREE_", "BT_MERCHANT_ID", "BT_PUBLIC_KEY", "BT_PRIVATE_KEY", "BT_ENVIRONMENT"]
  config_files: []
pages:
  pricing: https://www.paypal.com/us/business/paypal-business-fees
  braintree_pricing: https://www.paypal.com/us/enterprise/paypal-braintree-fees
  holds: https://www.paypal.com/us/cshelp/article/help848
  reserves: https://www.paypal.com/us/cshelp/article/help393
  user_agreement: https://www.paypal.com/us/legalhub/paypal/useragreement-full
  braintree_agreement: https://www.paypal.com/us/legalhub/braintree/payment-services-agreement
  reports: https://www.paypal.com/us/cshelp/article/help145
  braintree_fee_report: https://developer.paypal.com/braintree/articles/control-panel/reporting/transaction-level-fee-report
  braintree_payouts: https://developer.paypal.com/braintree/articles/get-started/get-paid
  paypal_via_braintree: https://developer.paypal.com/braintree/articles/guides/payment-methods/paypal/setup-guide
  rate_limits: https://developer.paypal.com/api/rest/reference/rate-limiting/
  countries: https://www.paypal.com/us/webapps/mpp/country-worldwide
  upcoming_changes: https://www.paypal.com/us/legalhub/paypal/upcoming-policies-full
  security: https://www.paypal-trustcenter.com/
  pci: https://www.paypal.com/us/business/pci-compliance
  dpa: https://www.paypal.com/us/legalhub/paypal/data-protection
read:
  - PayPal merchant fees per country (swap /us/ in the page URL), i.e. rates for PayPal Checkout and Venmo, standard versus Advanced card payments (with an interchange plus plus option), Pay Later, alternative methods, invoicing, micropayments
  - the international fee on top of the domestic rate, the fixed fee by currency received, and the currency conversion spread
  - refunds do not return the original fees; chargeback fees for card payments; standard versus high-volume dispute fees, the high-volume one charged even when the seller wins
  - holds on new sellers, rolling and upfront reserves, account limitations
  - paid add-ons (chargeback protection, fraud protection, account updater) and fee increases for added risk or missing checkout integration
  - Braintree fees (a separate page), i.e. card and wallet rate, extra percentages for non-USD presentment and foreign cards, chargeback and ACH fees, custom or interchange plus pricing for volume; PayPal payments through Braintree are billed under the linked PayPal account
  - Braintree reserves and underwriting, settlement timing by bank, one merchant account per currency
  - no region choice; PayPal acts as a controller under its DPA; ISO 27001, PCI DSS, SOC 1 and SOC 2 on the trust center
usage_questions:
  - metric: monthly_volume
    ask: Payment volume and number of payments last month, by type (PayPal, cards, Pay Later, international)?
    where: PayPal Business → Activity → Reports → Activity report (gross); Braintree Control Panel → Reports → Statements
  - metric: monthly_bill
    ask: Fees paid last month, and the international and conversion share?
    where: PayPal Activity report (fee column) or Financial summary; Braintree Transaction-Level Fee Report (PayPal payments not included)
  - metric: disputes
    ask: Disputes and chargebacks last quarter, and the dispute ratio?
    where: PayPal Resolution Center; Braintree Control Panel → Disputes
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - price in the buyer's currency and hold balances in the main currencies to avoid conversion spread
  - apply for micropayments pricing only when the average payment is small, and bundle small charges
  - authorize and capture after checks instead of refunding, since refunds keep the fees
  - add shipment tracking to release holds sooner and to win disputes; keep the dispute ratio under the high-volume tier
  - compare standard card payments with Advanced card payments or interchange plus pricing for card-heavy volume
  - on Braintree, add a merchant account per settlement currency and ask for custom pricing as volume grows
  - move off deprecated server SDKs to the current PayPal server SDK
verified: 2026-10-11
---

- PayPal is detected from `@paypal/` (JS SDK, React, server SDK, MCP), legacy `paypal-rest-sdk` and `paypal-checkout`, the Python SDKs (module names included) and `PAYPAL_*` names. Braintree, a PayPal service with its own fee page, merchant account and Control Panel, is detected from `braintree`, `braintree-web`, the drop-in and `BRAINTREE_*` / `BT_*` names; ask which one the project uses. The `@braintree/` scope and `card-validator` are generic utilities and are not used.
- Braintree processing PayPal payments (`BraintreePayPal*` components, braintree-web `paypalCheckout`) is not a second PayPal integration, but its PayPal fees are billed on the linked PayPal account: ask for both reports.
- PayPal next to Stripe is usually a wallet button next to card payments, not an Overlap; it is one when both take cards (PayPal card fields next to Stripe Elements or Checkout) or when Stripe already offers PayPal in the account's country. Braintree next to Stripe, or PayPal next to Paddle, Lemon Squeezy or Polar, is Overlap unless a migration is documented.
- PayPal is not a merchant of record: the business owes sales tax and VAT. Sites that load `www.paypal.com/sdk/js` or `js.braintreegateway.com` with a script tag leave only env names: ask.
- The trust center blocks plain requests; read it in a browser. Old braintreepayments.com pages redirect to paypal.com.
- The PayPal MCP server (`@paypal/mcp` with `--tools`, or the remote `mcp.paypal.com`) has no read-only mode: it creates orders, invoices, refunds and subscriptions with a full-scope token, and the read tools return payer data. Do not use it; ask the user for numbers instead.
