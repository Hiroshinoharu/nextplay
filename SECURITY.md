# Security Policy

## Supported Versions

NextPlay is currently maintained as a rolling project rather than multiple long-lived release branches. Security fixes are applied to the current `main` branch and the latest deployment built from it.

| Version | Supported |
| ------- | --------- |
| `main` | Yes |
| Latest deployed revision from `main` | Yes |
| Older commits, forks, and untagged snapshots | No |

If the project starts publishing versioned releases, this policy will be updated to list supported release lines explicitly.

## Reporting a Vulnerability

Please do not report security issues through public GitHub issues, discussions, or pull requests.

Preferred reporting channel:

- Use GitHub Private Vulnerability Reporting for this repository if it is enabled.

If private reporting is not available, contact the repository owner through a private channel and include as much of the following as possible:

- A clear description of the issue and the affected component
- Steps to reproduce or a proof of concept
- Impact assessment, including what an attacker could gain
- Any relevant logs, request samples, payloads, or screenshots
- The commit hash, branch, deployment URL, or environment where you observed the issue

Response expectations:

- Initial acknowledgement within 3 business days
- Follow-up status updates at least once every 7 calendar days while the report is being triaged or fixed
- Coordination on disclosure timing once a fix or mitigation is available

What to expect:

- If the report is accepted, the issue will be triaged, a fix or mitigation will be prepared, and disclosure will be coordinated after users have had a reasonable chance to update
- If the report is declined, you will be told why, for example because the issue is out of scope, not reproducible, already known, or requires assumptions that do not match the supported deployment model

Please avoid public disclosure until the issue has been reviewed and a remediation plan is in place.