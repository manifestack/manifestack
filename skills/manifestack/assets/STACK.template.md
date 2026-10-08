# STACK.md

What this project runs on, why, and when to look again. Maintained with Manifestack (https://manifestack.com).
Names only: never put secret values, keys, tokens or connection strings in this file.

## Requirements
budget: 
users: 
requires: 
prefer: 
avoid: 
priority: 

<!--
One section per service, "## <Role>: <Vendor>". Roles: Hosting, Database, Auth, Email, Storage, Payments, Monitoring, AI, Other.

```
## Database: Supabase
plan: free
limit: 500 MB database, pauses after 7 days idle
source: supabase.com/pricing  # read 2026-10-06
usage: 312 MB, +1.1 MB/day (2026-10-06)
decided: stay on Free until first paying user
revisit_when: db_size > 400 MB OR date >= 2027-02-01
next: Pro, $25/mo
env: SUPABASE_URL, SUPABASE_ANON_KEY  # names only
```
-->
