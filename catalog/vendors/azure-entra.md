---
schema: 1
id: azure-entra
name: Microsoft Entra External ID and Entra ID sign-in
family: azure
roles: [auth]
detect:
  packages: ["@azure/msal-browser", "@azure/msal-node", "@azure/msal-react", "@azure/msal-angular", "msal", "passport-azure-ad"]
  pypi: ["msal", "fastapi-azure-auth"]
  go: ["github.com/AzureAD/microsoft-authentication-library-for-go"]
  imports: ["@azure/msal-browser", "@azure/msal-node", "@azure/msal-react", "@azure/msal-angular", "msal", "passport-azure-ad"]
  env_prefixes: ["AZURE_AD_"]
  config_files: []
  role_signals:
    auth: ["@azure/msal-react", "@azure/msal-angular", "passport-azure-ad", ".ciamlogin.com", ".b2clogin.com", "loginRedirect(", "loginPopup(", "ssoSilent(", "MsalProvider", "MsalGuard", "useMsalAuthentication", "AuthenticatedTemplate", "getAuthCodeUrl(", "acquireTokenByCode(", "initiate_auth_code_flow(", "acquire_token_by_auth_code_flow(", "get_authorization_request_url(", "AcquireTokenByAuthCode(", "fastapi_azure_auth", "Microsoft.AzureActiveDirectory/ciamDirectories", "Microsoft.AzureActiveDirectory/b2cDirectories", "\"azurerm_aadb2c_directory\""]
  service_signals: [".ciamlogin.com", ".b2clogin.com", "login.microsoftonline.com", "Microsoft.AzureActiveDirectory/ciamDirectories", "Microsoft.AzureActiveDirectory/b2cDirectories", "\"azurerm_aadb2c_directory\""]
pages:
  pricing: https://azure.microsoft.com/en-us/pricing/details/microsoft-entra-external-id/
  billing: https://learn.microsoft.com/en-us/entra/external-id/external-identities-pricing
  faq: https://learn.microsoft.com/en-us/entra/external-id/customers/faq-customers
  overview: https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam
  tenant_setup: https://learn.microsoft.com/en-us/entra/external-id/customers/quickstart-tenant-setup
  sms_mfa: https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-multifactor-authentication-customers
  custom_domain: https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-custom-url-domain
  limits: https://learn.microsoft.com/en-us/entra/external-id/customers/reference-service-limits
  b2c_billing: https://learn.microsoft.com/en-us/azure/active-directory-b2c/billing
  entra_id_pricing: https://www.microsoft.com/en-us/security/business/microsoft-entra-pricing
  msal_client_types: https://learn.microsoft.com/en-us/entra/identity-platform/msal-client-applications
read:
  - External ID core billed per MAU (unique external users who authenticate in a calendar month, summed over every tenant linked to the subscription), the free monthly MAU allowance, and that billing needs a linked Azure subscription
  - add-ons with no free tier - SMS phone authentication (per verification, price by country tier), M2M authentication (per client credentials request in external tenants), Go-Local data residency (per MAU, few countries), ID Governance and Global Secure Access for workforce guests
  - B2B guests in a workforce tenant count as External ID MAU too
  - custom URL domains run through Azure Front Door, billed as its own service
  - tenant location is chosen at creation and cannot change; request limits per IP and per tenant
  - SMS needs a linked subscription and stops when it lapses; some country codes need opt-in
  - "Azure AD B2C: closed to new customers since 2025-05-01, supported until at least May 2030; MAU billing at P1 or P2 with a free allowance that does not apply on free trial, credit-based or sponsorship subscriptions; P2 retired in B2C tenants; Go-Local charged from the first MAU"
  - Entra ID Free comes with any Microsoft cloud subscription; P1 and P2 are per-user licenses for employees, not for app customers
usage_questions:
  - metric: mau
    ask: Monthly active users last month on External ID or B2C, and the bill for them?
    where: Cost Management → Cost analysis on the subscription linked to the tenant → group by Meter; Entra admin center → external tenant → Home → Billing (linked subscription)
  - metric: tenant_type
    ask: Do users sign in to an external tenant (External ID), an Azure AD B2C tenant, or only a workforce tenant (Sign in with Microsoft for work accounts)?
    where: Entra admin center → Settings → Directories + subscriptions; Azure portal → All resources, type Azure AD B2C
  - metric: add_ons
    ask: Is SMS MFA on and for which countries, is Go-Local on, and do services use client credentials against the external tenant?
    where: Entra admin center → Entra ID → Authentication methods (SMS); Cost analysis meters for SMS and M2M
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - prefer email one-time passcode or authenticator MFA to SMS; opt in only the countries the app serves
  - cache M2M access tokens and request new ones only near expiry
  - link the tenant to a pay-as-you-go subscription before launch, not a credit or trial one
  - plan the move from B2C to External ID for new apps; keep existing B2C tenants until a migration path fits
  - replace passport-azure-ad and the old msal npm package with MSAL Node or MSAL Browser
verified: 2026-10-11
---

- MSAL is the client library for every Microsoft identity tenant. A workforce-only sign-in (Sign in with Microsoft for employees or other organizations) costs nothing per user and needs no Azure subscription; External ID and B2C bill per MAU to a linked subscription. `.ciamlogin.com` means External ID, `.b2clogin.com` means B2C, `login.microsoftonline.com` alone means a workforce tenant or a daemon.
- The `auth` role counts only for user sign-in in code (MSAL React or Angular, redirect or popup login, auth code flow, the ciamlogin or b2clogin authority). MSAL used only for client credentials to call Microsoft Graph or Azure APIs is not user auth. `msal` next to `azure-identity` in a frozen requirements file is a dependency of `azure-identity`.
- Auth.js and NextAuth with the Microsoft Entra ID or Azure AD B2C provider are found as Auth.js, not here; ask which tenant type they point at.
- External ID or B2C with Clerk, Auth0, Supabase Auth, Firebase Auth or Cognito is an Overlap unless one is a migration source. A workforce sign-in for staff next to a customer auth vendor is a split, not an Overlap.
- SMS MFA is an SMS pumping target: a Cost Risk until countries are limited.
- `msal` (npm) and `passport-azure-ad` are deprecated: a Fit note.
- MCP: Microsoft MCP Server for Enterprise (preview, read-only by design) runs any Microsoft Graph GET through `microsoft_graph_get`, which returns user and sign-in records, and has no MAU or billing tool. The Azure MCP Server has no External ID tools. Do not use them.
