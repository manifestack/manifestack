# Where usage numbers come from

The skill cannot see vendor dashboards. Use these sources, in this order of preference for safety.

## 1. Ask the user (default)

- Ask in the same round as the other questions (`references/interview.md`): with options where they fit, numbered otherwise.
- Ask only for numbers that change a finding. Take the questions from `vendors/<id>.md` → `usage_questions`.
- Every question says where to find the number: the dashboard path from the map (`where`). For vendors without a map, give your best path and say it may differ.
- Growth needs two points in time ("now and a month ago", or "this month and last month"). If the user has only one, say the ETA is a range or needs a second reading.
- Accept approximate answers and ranges, and screenshots or CSV exports of the usage page; say which numbers you read from them. Label them as user-provided in the evidence.
- If the user does not answer a question, continue and mark that finding as based on an assumption, or skip it.

- Ask for the last full billing period, not the month so far: a partial month understates usage.

Example:

```
To check the limits I need three numbers (each takes a minute in the dashboard):
1. Database size today, and a month ago if shown: <dashboard path from the map>
2. Data transfer in the last full billing period: <dashboard path from the map>
3. Most emails you expect to send in one day (launch, digest day)?
```

## 2. Exports in the repository

- CSV or JSON usage or billing exports the user put in the repo (for example `exports/vercel-usage.csv`).
- Read only the columns you need: dates, metric names, quantities. Do not quote rows that contain emails, names, IPs or other personal data.
- Do not commit, move or delete export files. Suggest adding them to `.gitignore` if they are not ignored.

## 3. Official vendor MCP, read-only (optional)

Only if the user already connected one: read `references/mcp.md` first. It lists which servers have a read-only mode and the rules for calling them. Never ask the user to connect a server with write access.
