---
schema: 1
id: hetzner
name: Hetzner
roles: [hosting, storage]
detect:
  packages: []
  imports: []
  pypi: ["hcloud"]
  go: ["github.com/hetznercloud/hcloud-go"]
  env_prefixes: ["HCLOUD_", "HETZNER_"]
  config_files: []
  role_signals:
    storage: ["your-objectstorage.com", "your-storagebox.de"]
pages:
  pricing: https://www.hetzner.com/cloud/
  price_table: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
  price_adjustment_faq: https://docs.hetzner.com/general/infrastructure-and-availability/faq-standardization-and-price-adjustment/
  billing: https://docs.hetzner.com/cloud/billing/faq/
  billing_system: https://docs.hetzner.com/general/billing-and-account-management/billing-at-hetzner/billing-system-hetzner/
  traffic: https://docs.hetzner.com/robot/general/traffic/
  ipv4: https://docs.hetzner.com/general/infrastructure-and-availability/ipv4-pricing/
  servers: https://docs.hetzner.com/cloud/servers/overview/
  deprecated_plans: https://docs.hetzner.com/cloud/servers/deprecated-plans/
  backups_snapshots: https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/
  object_storage: https://docs.hetzner.com/storage/object-storage/overview/
  object_storage_pricing: https://www.hetzner.com/storage/object-storage/
  locations: https://docs.hetzner.com/cloud/general/locations/
  limits_availability: https://docs.hetzner.com/cloud/general/faq/
  signup_checks: https://docs.hetzner.com/general/security-and-identify/fraud-prevention-faq/
  status: https://status.hetzner.com/
  security: https://www.hetzner.com/unternehmen/zertifizierung/
  dpa: https://docs.hetzner.com/general/company-and-policy/data-protection-at-hetzner/
read:
  - server families (shared vCPU CX, CPX and Arm CAX; dedicated vCPU CCX), which are sold in which location, and which are deprecated
  - prices by network zone (EU the same across Falkenstein, Nuremberg and Helsinki; US and Singapore differ); hourly billing up to a monthly cap; no free tier
  - the 2026 price adjustments, i.e. new orders and rescales pay current prices, so rescaling or restoring a legacy-priced server can raise its price sharply
  - included outbound traffic per server and load balancer by location (far less in the US and Singapore), overage per TB, and alert emails that do not cap
  - Primary IPv4 billed separately while it exists (IPv6 free), floating IPs, backups as a share of the server price, snapshots per GB-month
  - everything that exists is billed, i.e. powered-off servers, unassigned IPs, volumes and snapshots left after a server is deleted
  - Object Storage, i.e. a base fee per account while any bucket exists, included storage and egress, per-TB excess, a minimum billable object size, EU locations only, request and bucket limits
  - capacity, i.e. limited availability of new cloud servers for some accounts and types (status page), and account limits raised by request
  - no spend cap; cost alerts per project are notifications only
  - ISO 27001 for the German and Finnish data centers (US and Singapore are colocation), the GDPR DPA concluded in the account, the cloud SLA
usage_questions:
  - metric: monthly_bill
    ask: Costs this month per project, and the last invoice total?
    where: Hetzner Console → Usage (current month per project, cost alerts); invoices and consumption CSV at accounts.hetzner.com → Invoices
  - metric: transfer_tb
    ask: Outbound traffic this month for the busiest servers, against the included amount?
    where: "`hcloud server describe <server>` (Outgoing and Included traffic) or the server's graphs in the Console"
  - metric: instances
    ask: Which servers run, of which type and in which location, including powered-off ones?
    where: Console → project → Servers
  - metric: region
    ask: Which location does each server and bucket use?
    where: Console → project → Servers and Object Storage (location column)
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - delete powered-off servers you do not need (snapshot first), and remove leftover Primary IPv4s, floating IPs, volumes and snapshots
  - use IPv6-only where clients allow it, to drop the IPv4 charge
  - keep traffic-heavy servers in EU locations, which include much more traffic than the US and Singapore
  - replace backups with a weekly snapshot on stateless servers
  - add lifecycle rules for old object versions and unfinished multipart uploads, and delete empty buckets to stop the base fee
  - check the current price before rescaling a server bought at a legacy price, and check availability before deleting one you may need again
  - set cost alerts per project in the Console
verified: 2026-10-11
---

- Most Hetzner servers are created in the Console, by Terraform (`hetznercloud/hcloud`) or by a deploy tool such as Kamal, and leave no file this map can match. Detection relies on `hcloud` (Python), `hcloud-go` and `HCLOUD_*` / `HETZNER_*` names; there is no official JavaScript SDK. Ask where the app runs. A `HETZNER_*` token can be for DNS or certificates only.
- Object Storage is S3-compatible and used through AWS S3 clients; the `storage` role counts only when a `your-objectstorage.com` endpoint (or a `your-storagebox.de` Storage Box) appears in the code.
- Plan pages fill in prices with JavaScript, so a plain fetch shows empty prices; read the price table in the docs instead, or ask the user to paste the plan table.
- Capacity is limited in 2026: the status page reports restricted creation of new cloud servers, and some server types show as unavailable. Report it as a Risk for plans that need new servers or rescaling.
- Hetzner plus a second hosting platform for the same app is Overlap unless split on purpose. Object Storage next to S3 or R2 is Overlap in the same way.
