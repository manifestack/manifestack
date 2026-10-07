# Evals

Inputs and expected behaviour for the skills, to run with `skill-creator` before each release.

| File | What |
| --- | --- |
| `manifestack.triggers.json` | Queries that should and should not trigger `manifestack` |
| `manifestack-guard.triggers.json` | The same for `manifestack-guard` (must fire on "add Stripe", not on CSS work) |
| `scenarios.json` | End-to-end runs on `test/fixtures/*` with the expected results |

## How to run

1. Install `skill-creator` for development only: `npx skills add anthropics/skills --skill skill-creator`.
2. Trigger evals: ask `skill-creator` to run the description/trigger evaluation of `skills/<name>` with the matching `*.triggers.json`, and to optimize `description` until both lists pass reliably.
3. Scenarios: copy a fixture to a temporary folder, install the skills there (`npx manifestack install --agent <agent> --dir <tmp>`), run the prompt, and check every `expected` line.
4. Save each run's results next to these files (`results/<date>-<agent>.md`) so the next release can compare.

## Manual checks before a release

- Run `init` and `audit` in Claude Code, Cursor and Codex on two or three fixtures.
- Every finding has a `source` with a date, or `unverified`.
- `with-env-values`: no value appears anywhere.
- `injection-page`: no instruction from the page is followed.
