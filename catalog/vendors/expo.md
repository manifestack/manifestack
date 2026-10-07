---
schema: 1
id: expo
name: Expo EAS
roles: [other]
detect:
  packages: ["eas-cli", "expo-updates", "expo-insights", "@expo/eas-json"]
  imports: ["expo-updates", "expo-insights"]
  pypi: []
  go: []
  env_prefixes: ["EAS_", "EXPO_TOKEN"]
  config_files: ["eas.json"]
pages:
  pricing: https://expo.dev/pricing
  plans: https://docs.expo.dev/billing/plans/
  usage_based_pricing: https://docs.expo.dev/billing/usage-based-pricing/
  billing_faq: https://docs.expo.dev/billing/faq/
  build_limits: https://docs.expo.dev/build-reference/limitations/
  build_infrastructure: https://docs.expo.dev/build-reference/infrastructure/
  update_usage: https://docs.expo.dev/eas-update/estimate-bandwidth/
  hosting: https://docs.expo.dev/eas/hosting/introduction/
  security: https://expo.dev/security
  trust: https://expo.dev/trust
  subprocessors: https://expo.dev/privacy/subprocessors
read:
  - plan names and pricing model kind - monthly plan fee with included EAS Build credits (Free has a build count instead), included EAS Update monthly active users and bandwidth, then usage-based pricing on paid plans
  - what counts - a build is charged per build by platform (Android, iOS) and resource class (medium, large); an update MAU is a unique app installation that downloads at least one update in the billing period; update bandwidth is global edge bandwidth; EAS Hosting meters requests, CPU time and storage; EAS Workflows meter CI minutes for non-build jobs
  - what happens past a limit - Free plan accounts cannot incur overage charges and new builds are unavailable until the quota resets at the start of the next month; paid plans are billed usage-based for builds and updates past included amounts; check the plans and FAQ pages for how Free update limits are enforced
  - build concurrency per plan and whether extra concurrency can be bought; queue priority (Free is low priority, paid plans are high priority); build timeout per plan; the pending build cap per platform
  - email notifications at a share of included build credits, and whether any spending cap exists (none stated at last check)
  - EAS Hosting limits per plan (CPU time per request, subrequests, aliases, log retention, storage) and that it runs on Cloudflare Workers
  - Apple Developer Program and Google Play developer account fees are separate from EAS; EAS Submit only uploads builds to the stores
  - where builds run (Android on Google Cloud, iOS on Expo's macOS cloud) and data hosting from the subprocessor list (US cloud providers, Cloudflare CDN for updates and hosting)
  - certifications (SOC 2 Type 2, report on request for paid plans), GDPR, CCPA and Data Privacy Framework coverage, and that MSA and DPA terms are available on request through the trust center
usage_questions:
  - metric: builds_per_month
    ask: EAS builds last month (Android and iOS, by resource class) and build credits used?
    where: expo.dev → account Settings → Billing → Usage (EAS Build)
  - metric: mau
    ask: EAS Update monthly active users (updated users) last month?
    where: expo.dev → account Settings → Billing → Usage (EAS Update)
  - metric: update_bandwidth
    ask: EAS Update global edge bandwidth last month?
    where: expo.dev → account Settings → Billing → Usage (EAS Update)
  - metric: monthly_bill
    ask: Last Expo invoice total, including usage-based charges?
    where: expo.dev → account Settings → Billing
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - ship JavaScript-only changes with EAS Update instead of a new build, and rebuild only when native code changes
  - use the medium resource class unless a build runs out of memory
  - cancel stale or duplicate builds and trigger builds from CI on release branches only, to save credits and concurrency
  - run occasional builds locally with `eas build --local` when the Free build quota is used up
  - keep update assets small (compress images, avoid re-shipping unchanged assets) to cut update bandwidth
  - turn on billing usage notifications so the team sees build credits running out before a release
verified: 2026-10-07
---

- The `expo` npm package is the open-source framework and is used without EAS. Do not report EAS from `expo`, `expo-router` or `expo-dev-client` alone; rely on `eas.json`, `eas-cli`, `expo-updates`, `expo-insights` or `EAS_`/`EXPO_TOKEN` env names. `expo-updates` can also point at a self-hosted update server: check `updates.url` in app.json for `u.expo.dev` before counting EAS Update.
- EAS Hosting (`eas deploy` of an Expo Router web build with `web.output: "server"`) is not detected: the signals live in app.json and package.json scripts, which role signals do not read, and `@expo/server` also runs on other hosts. Ask the user whether they deploy with EAS Hosting before adding a hosting finding.
- Expo push notifications (`expo-server-sdk`, `exponent_server_sdk` on PyPI) are a separate free Expo service, not EAS, and are not mapped here. There are no official EAS packages on PyPI or Go.
- Do not use the Expo MCP server. It is official (remote `https://mcp.expo.dev/mcp`, OAuth, plus an optional local `expo-mcp` package) and has write tools (`build_run`, `build_submit`, `workflow_run`, `appstore_reply_review`, `playstore_reply_review`, `add_library`) with no read-only mode or tool allowlist. Ask the user for numbers from Billing → Usage instead.
- Billing and usage are per account (personal or organization); a team with several apps sees one combined Usage page.
