# Alyn check — 2026-11-16

Standing rule: check https://alyn.dev/ before building, and install a skill only
if it genuinely helps. Checked 2026-11-16 (read-only, no sign-up, no MCP/CLI,
no spending).

## What was checked
- alyn.dev homepage (fetched directly).
- Targeted searches for Alyn-listed skills: Cloudflare Workers/Pages, job search /
  career data, charts / dashboards / data visualisation.

## Findings
- **Cloudflare:** the official Cloudflare skill (cloudflare/cloudflare on GitHub)
  exists and is listed on Alyn. It is a large, general platform skill (Workers,
  Pages, KV, R2, D1, AI, security). Our deploy path is already proven and
  documented in `~/workspace/custom-connectors/custom.cloudflare/CONNECTOR.md`
  (`pages-create` / `pages-deploy` via `cloudflare.py`, same flow used for
  hugo-links). A general skill adds nothing for a static Pages deploy, so it
  was NOT installed.
- **Cloudflare security-audit-skill** (cloudflare/security-audit-skill): a code
  auditing skill. Not relevant to a static content site. NOT installed.
- **Job search / career data:** no Alyn skill found that provides live Canadian
  youth job data. One "AI JOB SEARCH" skill (CV tailoring / cover letters)
  surfaced in social posts — wrong fit for a job bank. Research is done
  directly against Job Bank, employer career pages and official program pages.
- **Charts / dashboards:** a "data-visualization" skill exists on eliteai.tools
  (not Alyn) and requires an inference.sh CLI login. Not a fit. The site uses
  Chart.js client-side instead — no skill needed.

## Verdict
No Alyn skill installed for this project. Nothing found that genuinely helps
beyond the tooling already in place (Cloudflare connector helper, Chart.js,
Python stdlib builder).
