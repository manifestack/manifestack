## Requirements
budget: ~$600/mo
users: 9k now, 50k by Q3
requires: EU database, SOC 2 vendors
prefer: Postgres, Next.js

## Hosting: Vercel
plan: Pro
limit: 1 TB Fast Data Transfer included
source: vercel.com/pricing  # read 2026-10-06
usage: transfer_tb 3.4 TB, +0.3 TB/mo (2026-10-01)
decided: Pro for commercial use
revisit_when: transfer_tb > 1 OR monthly_bill > $300
next: Enterprise
env: VERCEL_ENV

## Database: Supabase
plan: free
limit: 500 MB database, pauses after 7 days idle
source: supabase.com/pricing  # read 2026-10-06
usage: 312 MB, +1.1 MB/day (2026-10-06)
decided: stay on Free until first paying user
revisit_when: db_size > 400 MB OR date >= 2027-02-01
next: Pro, $25/mo
env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  # names only

## Email: Resend
plan: Pro
limit: 50,000 emails/mo
source: resend.com/pricing  # read 2026-10-06
usage: monthly_sent 41,200, +18%/mo (2026-10-01)
revisit_when: monthly_sent >= 45k
next: Scale
env: RESEND_API_KEY
