---
# generated, edit catalog/vendors/firebase.md (then run: node tools/sync.mjs)
schema: 1
id: firebase
name: Firebase
roles: [database, auth, hosting, storage]
detect:
  packages: ["firebase", "firebase-admin", "firebase-functions", "firebase-tools", "@firebase/", "@react-native-firebase/", "reactfire", "react-firebase-hooks", "@angular/fire", "vuefire", "@apphosting/"]
  pypi: ["firebase-admin", "firebase-functions"]
  go: ["firebase.google.com/go"]
  imports: ["firebase/", "firebase-admin", "firebase-functions", "@firebase/", "@react-native-firebase/", "reactfire", "react-firebase-hooks", "@angular/fire", "vuefire"]
  env_prefixes: ["FIREBASE_", "NEXT_PUBLIC_FIREBASE_", "VITE_FIREBASE_", "EXPO_PUBLIC_FIREBASE_"]
  config_files: ["firebase.json", ".firebaserc", "firestore.rules", "database.rules.json", "storage.rules", "apphosting.yaml"]
  role_signals:
    database: ["@react-native-firebase/firestore", "@react-native-firebase/database", "firebase/firestore", "firebase/database", "firebase-admin/firestore", "firebase-admin/database", "@firebase/firestore", "@firebase/database", "getFirestore(", "admin.firestore()", "admin.database()"]
    auth: ["@react-native-firebase/auth", "firebase/auth", "firebase-admin/auth", "@firebase/auth", "react-firebase-hooks/auth", "onAuthStateChanged(", "signInWithPopup(", "admin.auth()"]
    hosting: ["firebase-functions", "@apphosting/"]
    storage: ["@react-native-firebase/storage", "firebase/storage", "firebase-admin/storage", "@firebase/storage", "admin.storage()"]
pages:
  pricing: https://firebase.google.com/pricing
  plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
  avoid_surprise_bills: https://firebase.google.com/docs/projects/billing/avoid-surprise-bills
  spend_caps: https://firebase.google.com/docs/projects/billing/spend-caps
  billing_alerts: https://firebase.google.com/docs/projects/billing/advanced-billing-alerts-logic
  firestore_quotas: https://firebase.google.com/docs/firestore/quotas
  rtdb_limits: https://firebase.google.com/docs/database/usage/limits
  auth_limits: https://firebase.google.com/docs/auth/limits
  identity_platform_pricing: https://cloud.google.com/identity-platform/pricing
  hosting_quotas: https://firebase.google.com/docs/hosting/usage-quotas-pricing
  app_hosting_costs: https://firebase.google.com/docs/app-hosting/costs
  storage_blaze: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
  firestore_locations: https://firebase.google.com/docs/firestore/locations
  regions: https://firebase.google.com/docs/projects/locations
  functions: https://firebase.google.com/docs/functions/get-started
  security: https://firebase.google.com/support/privacy
  dpa: https://firebase.google.com/terms/data-processing-terms
read:
  - Spark (no-cost) quota kinds per product (Firestore stored data, document reads, writes and deletes per day, outbound transfer; Hosting storage and transfer; Realtime Database connections and storage) and which are per day versus per month
  - what happens when a Spark quota runs out (usage of that product is shut off for the rest of the period; Hosting sites are disabled when transfer runs out)
  - Blaze is pay-as-you-go on top of the same no-cost quotas, billed through Google Cloud per unit used
  - budget alerts do not cap usage or charges; spend caps exist only for some services (AI Logic, App Hosting, Cloud Functions, Extensions), are not instant, and do not cover Firestore, Hosting, Storage or Auth
  - services that require Blaze (Cloud Functions, Cloud Storage for Firebase even for default buckets, App Hosting, phone/SMS sign-in)
  - Authentication limits (daily active user tiers on Spark, SMS on Blaze only) and the per-MAU pricing if the project upgrades to Identity Platform
  - commercial-use terms on Spark (none stated on the pricing pages at last check)
  - Firestore location choice (multi-region or regional) and that a database location cannot be changed after it is created; locations of Realtime Database, Storage buckets and Functions
  - certifications (ISO 27001, SOC 1/2/3 for all services; ISO 27017/27018 for some) and the Data Processing and Security Terms
usage_questions:
  - metric: firestore_reads
    ask: Firestore document reads, writes and deletes per day at peak, and stored data?
    where: Firebase console → Firestore Database → Usage
  - metric: mau
    ask: Active users for Authentication (daily and monthly)?
    where: Firebase console → Authentication → Usage
  - metric: billing_plan
    ask: Is the project on Spark or Blaze, and is a budget alert or spend cap set?
    where: Firebase console → Project settings (gear) → Usage and billing → Details & settings
  - metric: monthly_bill
    ask: Last month's Firebase / Google Cloud charges for this project?
    where: Firebase console → Project settings (gear) → Usage and billing (links to the Cloud Billing report for the project)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - paginate Firestore queries with limit() and cursors and detach realtime listeners when a view closes, since every document returned is a billed read
  - cache data on the client or a server instead of re-reading the same documents on each page load
  - add App Check so only your app can call Firestore, Storage and Functions
  - create a budget alert in Cloud Billing and, for a hard stop, a function that disables billing on a budget notification (it shuts the project down, so test it first)
  - set spend caps on Cloud Functions and App Hosting where available
  - serve images through Hosting's CDN or a resized copy instead of downloading full files from Storage
  - create the production Firestore database in the region the requirements ask for, because it cannot be moved later
verified: 2026-10-08
---

- Blaze surprise bills are a known trap: budget alerts only email, and the services most likely to spike (Firestore reads, Storage egress) have no spend cap. A Blaze project with no alert at all is a Bill finding.
- The Firebase MCP server (`npx firebase-tools mcp`) is official but has no read-only mode. `--only` limits it to feature groups, and those groups still contain write tools (deploy, add/update/delete documents, set Realtime Database data, update users). `firebase_get_sdk_config` returns app config including the API key. Do not use it; ask the user for numbers instead.
- Firebase Hosting without Cloud Functions or App Hosting leaves no code signal. If `firebase.json` has a `hosting` section, count hosting by hand; otherwise Firebase is probably only the backend (for example behind Vercel).
- Firebase Auth and another auth provider (Clerk, Supabase Auth, Auth0) in the same code is an Overlap finding. So is Firestore or Realtime Database next to another database (Supabase, Neon, D1).
