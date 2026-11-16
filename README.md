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
  `career-paths.json`, `minimum-wage.json`, plus `*-notes.md` and `alyn-check.md`).
- `build.py` — the Python builder. Reads `research/*.json`, validates every
  record (required fields, source URL, checked date, verification flag) and
  emits the site's data files. Re-run it to refresh the site after research
  updates. Stdlib only — no dependencies.
- `data/` — validated, built data files (output of `build.py`). This is what
  the site loads. Do not edit by hand; edit `research/` and rebuild.
- `site/` — the static site deployed to Cloudflare Pages. Loads JSON from
  `data/` at build time (copied in by `build.py`).

## Refreshing the data

```bash
python3 build.py        # validates research/*.json, writes data/ and site/data/
```

Then commit, push, and deploy:

```bash
python3 ~/workspace/custom-connectors/custom.cloudflare/bin/cloudflare.py pages-deploy --dir ~/workspace/owen-job-bank/site --project owen-job-bank
```

## Live site

https://owen-job-bank.pages.dev

## Repo

https://github.com/JPDimples/owen-job-bank
