# Owen's Job Bank

A job bank for teens in Bowmanville & Durham Region, Ontario — first jobs that
are reachable without a car, after school and weekends, plus career paths,
schooling & training routes, government programs, and after-school initiatives.

Built for Owen (high-school student, Bowmanville, no car, first job) and his
dad James. Bowmanville is the home town; Courtice, Newcastle, Orono, Oshawa,
Whitby, Ajax and Pickering are also covered.

## Rules the data lives by

- **No Tim Hortons, ever.**
- **Never invent a wage, posting, program, or deadline.** Every record links to
  its real source page and carries a `checked_date` and a `verified` flag.
  Anything unverified is labelled unverified, never presented as fact.
- Jobs must be in the selected town and reachable without a car.

## Layout

- `research/` — raw research notes and the JSON files the researchers produced
  (`jobs.json`, `programs.json`, `schooling.json`, `initiatives.json`,
  `career-paths.json`, `internships.json`, `minimum-wage.json`, plus `*-notes.md` and `alyn-check.md`).
- `build.py` — the Python builder. Reads `research/*.json`, validates every
  record (required fields, source URL, checked date, verification flag) and
  emits the site's data files. Re-run it to refresh the site after research
  updates. Stdlib only — no dependencies.
- `data/` — validated, built data files (output of `build.py`). This is what
  the site loads. Do not edit by hand; edit `research/` and rebuild.
- `site/` — the static site deployed to Cloudflare Pages. Loads JSON from
  `data/` at build time (copied in by `build.py`).
- `scripts/` — the Sync machinery (see below). `check_sources.py` re-checks
  every source URL; `sync_runner.py` runs a requested sync end-to-end.
  `check-report.json` and `.sync.lock` are generated at run time, not
  committed.
- `sync-log.md` — one line per completed sync run (run id, status, counts,
  commit, deploy result).

## Refreshing the data

```bash
python3 build.py        # validates research/*.json, writes data/ and site/data/
```

Then commit, push, and deploy:

```bash
python3 ~/workspace/custom-connectors/custom.cloudflare/bin/cloudflare.py pages-deploy --dir ~/workspace/owen-job-bank/site --project owen-job-bank
```

## Sync listings button

The site has a **Sync listings** button in the trust bar. Anyone can press it;
no login, no account. It re-checks every listing already on the site against
its source page and refreshes the checked dates. It does NOT find brand-new
postings — those are still added by hand in `research/`.

How it works (one deploy path — this VM is the only deployer; never add a
GitHub Actions deploy or connect the Pages project to GitHub):

1. Pressing the button POSTs to the Pages Function `site/functions/api/sync.js`,
   which writes a request to the KV namespace `owen-job-bank-sync` (binding
   `SYNC_KV`, see `research/sync-setup.md`) and returns a run id. A second
   press within 10 minutes gets a 409 ("already running").
2. `scripts/sync_runner.py` runs every 5 minutes from a cron on this VM. When
   it finds an unprocessed request it runs `scripts/check_sources.py`
   (re-checks every `source_url`: live pages get today's `checked_date`;
   dead pages get `verified=false` plus a `sync_note`; 403/429/5xx pages are
   left exactly as-is as "unverifiable this run"), then `build.py`,
   commits + pushes only if `research/` or `data/` changed, redeploys, and
   writes `site/data/sync-status.json` (which the button polls to show the
   result, e.g. "Checked 75 listings: 45 live, 0 flagged").
3. The runner never deletes a record, never invents a wage or a checked date,
   and a failed `build.py` means no commit — the failure is still deployed
   as a status file so the button shows it.

Manual run (also the way to test the whole path without pressing the button):

```bash
python3 scripts/check_sources.py --dry-run   # report only, changes nothing
python3 scripts/check_sources.py             # real check, updates research/*.json
python3 build.py
python3 scripts/sync_runner.py               # processes a pending KV request, or exits quietly
```

Notes: `check_sources.py` re-serialises `research/*.json` with sorted keys,
so a sync commit shows large formatting diffs even when only `checked_date`
changed — the content is identical. Expect most runs to come back `partial`:
about a third of the sources (Indeed, LinkedIn, Loblaws/TJX career pages)
block automated checks and stay "unverifiable"; those need a real-browser
spot-check, not a code fix.

## Live site

https://owen-job-bank.pages.dev

## Repo

https://github.com/JPDimples/owen-job-bank
