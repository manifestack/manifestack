---
schema: 1
id: uploadthing
name: UploadThing
roles: [storage]
detect:
  packages: ["uploadthing", "@uploadthing/"]
  imports: ["uploadthing", "@uploadthing/"]
  pypi: ["uploadthing-py"]
  env_prefixes: ["UPLOADTHING_"]
  config_files: []
pages:
  pricing: https://uploadthing.com/pricing
  limits: https://docs.uploadthing.com/file-routes
  regions: https://docs.uploadthing.com/concepts/regions-acl
  security: https://docs.uploadthing.com/concepts/auth-security
  files: https://docs.uploadthing.com/working-with-files
  terms: https://uploadthing.com/info/terms-of-service
  privacy: https://uploadthing.com/info/privacy-policy
read:
  - plan names and the storage included on each (Free storage is shared across all apps on the account)
  - whether uploads, downloads and egress are metered or stated as unlimited
  - per-GB overage on the usage-based plan, and what happens when a fixed plan is full (uploads blocked, upgrade prompt); not stated on the pricing page at last check
  - per-file size and count limits: set per file route (maxFileSize, maxFileCount) with defaults by file type; check whether a plan cap also applies
  - which features need a paid plan (regions, private files) and audit log retention per plan
  - file retention: files stay until deleted; deleted content may be irretrievable and the user must export before the account ends
  - storage region (US West default; other regions only on paid plans; changing region affects new uploads only)
  - hosting providers named in the privacy policy (AWS, Cloudflare, Vercel) and that processing happens in the United States
  - certifications and DPA (none published at last check)
usage_questions:
  - metric: storage_gb
    ask: Storage used per app and for the whole account, and the plan limit?
    where: uploadthing.com/dashboard → app (usage shown on the app overview; ask the user to read it off, exact label not in the docs)
  - metric: billing_plan
    ask: Which plan is the account on (Free, fixed storage or usage-based)?
    where: uploadthing.com/dashboard → account billing (not described in the docs; ask the user)
  - metric: region
    ask: Which region is the production app set to, and is it a paid plan?
    where: uploadthing.com/dashboard → app → Settings → Regions and ACL
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set maxFileSize and maxFileCount on every file route instead of relying on defaults or accepting anything
  - compress or resize images on the client before upload so stored files are smaller
  - delete files the app no longer references (UTApi deleteFiles from a cleanup job) and keep the file keys in your own database
  - serve files through the app subdomain URL (ufs.sh), not raw storage URLs, and cache them at the CDN
  - pick the region before launch, since a region change does not move existing files
verified: 2026-10-07
---

- UploadThing stores files on its own infrastructure (AWS and Cloudflare per its privacy policy), not in the customer's bucket. With Supabase Storage, S3, R2 or Cloudinary in the same app for the same files, that is an Overlap finding; using UploadThing for uploads and another store for other files is fine.
- Free storage is shared across all apps on the account, so a staging app eats into production.
- No DPA, subprocessor list or certifications are published, and the privacy policy says data is processed in the United States. If requirements name GDPR with a DPA, EU data residency or SOC 2, this is a Requirement finding until the vendor confirms otherwise. Regions exist, but only on paid plans.
- `uploadthing-py` (installed as `uploadthing.py`) is a Python SDK published by an UploadThing co-founder, not listed in the official docs. No official Go SDK.
- No official MCP server. Community servers upload and delete files; do not use them. Ask the user for numbers instead.
