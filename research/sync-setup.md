# Owen's Job Bank — Sync setup notes

How the "Sync listings" button works, and the pieces it needs. Kept in
research/ because it documents the data pipeline; no credential values are
recorded here, ever.

## Design (2026-11-17)

- The site stays a static Cloudflare Pages site. The VM remains the ONLY
  deployer (`wrangler pages deploy` from this VM). No GitHub Actions deploy,
  no GitHub-connected Pages project.
- A "Sync listings" button on the site POSTs to a Pages Function
  (`site/functions/api/sync.js`). The Function writes a request record to a
  KV namespace and returns a run_id. A 10-minute cooldown prevents hammering.
- A runner on this VM polls the KV namespace every 5 minutes (cron). When it
  finds an unprocessed request it runs `scripts/check_sources.py` (re-checks
  every source URL), then `build.py`, commits + pushes only if research/ or
  data/ changed, redeploys via the Cloudflare helper, and writes
  `site/data/sync-status.json` (which the site polls to show the result).
- The checker never deletes a record, never invents a wage or a checked date,
  and never marks a 403/429/5xx as dead (those are "unverifiable this run").

## KV namespace

- Title: `owen-job-bank-sync`
- Namespace ID: `de2c0a843dfa479c9f7104dc34b2024c`
- Created: 2026-11-17 via the Cloudflare API (surrogate pattern, same as
  `~/workspace/custom-connectors/custom.cloudflare/bin/cloudflare.py`).
- Binding name in the Pages Function: `SYNC_KV`
- Keys used: `sync-request` (the pending/running request), `sync-status`
  (latest finished run summary, mirrored to site/data/sync-status.json).

## Function + binding (2026-11-17)

- Function: `site/functions/api/sync.js` — POST only (other methods 405
  `method_not_allowed`). Reads `sync-request` from the `SYNC_KV` binding;
  if a record with status `requested`/`running` and `requested_at` within
  the last 10 minutes exists, returns 409 `already_running` with the
  existing `run_id`; otherwise writes a new record
  `{run_id, requested_at, status:"requested"}` and returns 200
  `{ok:true, run_id}`. Missing KV binding returns 500 `kv_not_configured`.
  All responses `Content-Type: application/json`.
- Binding method that worked: **wrangler.toml** —
  `site/wrangler.toml` with `pages_build_output_dir = "."`,
  `compatibility_date = "2025-01-01"`,
  `compatibility_flags = ["nodejs_compat"]`, and
  `[[kv_namespaces]]` binding `SYNC_KV` → id
  `de2c0a843dfa479c9f7104dc34b2024c`. No API fallback was needed.
  - Gotcha 1: without `pages_build_output_dir`, wrangler 4.164.0 ignores
    the wrangler.toml entirely ("Pages now has wrangler.toml support"
    warning) and the binding is not applied.
  - Gotcha 2: with wrangler.toml but no `nodejs_compat`, the Functions
    bundle failed to publish ("No such module \"node:stream\""). Adding
    `compatibility_date` + `compatibility_flags = ["nodejs_compat"]`
    fixed it.
- Deploy: `python3 ~/workspace/custom-connectors/custom.cloudflare/bin/cloudflare.py pages-deploy --dir ~/workspace/owen-job-bank/site --project owen-job-bank` — succeeded, deployment `54674ce5.owen-job-bank.pages.dev`.
- Live curl tests (2026-11-17 ~13:59 EST, 3 requests only):
  - POST https://owen-job-bank.pages.dev/api/sync → **200**
    `{"ok":true,"run_id":"fe760030-585c-4594-a0ba-f88188283206"}`
  - Second POST (same minute) → **409**
    `{"ok":false,"error":"already_running","run_id":"fe760030-585c-4594-a0ba-f88188283206"}`
    — same run_id, cooldown works.
  - GET same URL → **405** `{"ok":false,"error":"method_not_allowed"}`.
- Note: the live test left a `requested` record in KV with run_id
  `fe760030-585c-4594-a0ba-f88188283206`; the runner will treat it as a
  real sync request on its next poll (intended — it exercises the full
  path).
