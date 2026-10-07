# Security policy

Manifestack runs inside your coding agent. It has no server, collects nothing, and its scripts make no network requests. Security problems are still possible, for example:

- a script or the hook printing an env value or a secret;
- STACK.md accepting a secret;
- a skill instruction that lets page content or MCP output steer the agent (prompt injection);
- the installer overwriting files or settings it does not own;
- a vendor map allowing an MCP tool that writes or returns credentials.

## Reporting

Please report privately through GitHub: **Security → Report a vulnerability** on [manifestack/manifestack](https://github.com/manifestack/manifestack/security/advisories/new). Do not open a public issue.

Include what you ran, what happened, and what you expected. We aim to reply within 5 working days and to ship a fix in a patch release.

## Supported versions

The latest 0.x release.
