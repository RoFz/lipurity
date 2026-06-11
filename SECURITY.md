# Security Policy

## Supported Versions

Only the latest release is supported with security fixes.

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report vulnerabilities privately using
[GitHub Security Advisories](https://github.com/RoFz/lipurity/security/advisories/new).
You will receive an acknowledgement within 7 days.

## Scope

In scope:

- Vulnerabilities in the userscript itself: anything that could exfiltrate
  data, execute untrusted input, weaken the page's security posture, or be
  abused by a third party (e.g. injection through crafted post content
  reaching the script's DOM handling)

Out of scope:

- Vulnerabilities in the underlying website or platform; report those to the
  platform operator
- Vulnerabilities in userscript managers (Tampermonkey, Userscripts, etc.);
  report those to their respective projects
- Issues requiring physical access or social engineering

## Disclosure

Once a fix is released, vulnerabilities will be publicly disclosed via a
GitHub Security Advisory. Credit will be given to the reporter unless
anonymity is requested.
