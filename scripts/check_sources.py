#!/usr/bin/env python3
"""Owen's Job Bank — source link checker.

Checks every record's top-level source_url in research/*.json for liveness
and updates the records in place:

- LIVE (2xx, no error markers in the body): set checked_date to today.
  The verified flag is NEVER changed by liveness alone — verified means a
  human read the posting. A stale sync_note on a now-live record is removed.
- DEAD (404 / DNS failure / timeout after retry / redirect to an error page /
  error markers in the body): set verified=false and add/overwrite sync_note
  explaining why in plain words.
- UNVERIFIABLE (403 / 429 / 5xx / anything else ambiguous): leave the record
  exactly as-is.

The minimum-wage source (research/minimum-wage.json) is liveness only: no
rate or other field is ever changed, and if its page is dead or ambiguous it
is reported as unverifiable, never flagged dead.

Career-path step source_urls are also fetched for liveness and reported
separately, but a dead step link NEVER changes the path record's verified flag.

Never deletes a record. Never changes a wage, rate, title, or any field other
than checked_date, verified, sync_note.

Stdlib only. Polite: a browser User-Agent, 15s timeout, one retry on
timeout, ~0.5s delay between requests, and each unique URL fetched once.

Usage:
    python3 scripts/check_sources.py [--dry-run]

Without --dry-run: writes the updated research/*.json files in place and
writes scripts/check-report.json. With --dry-run: prints the same human
report and writes no files.
"""

import argparse
import json
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "research"
REPORT_PATH = Path(__file__).resolve().parent / "check-report.json"

TODAY = "2026-11-17"
TIMEOUT = 15
DELAY = 0.5
MAX_BODY = 1_000_000  # bytes; enough to spot error markers

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Case-insensitive markers in a page body that mean "this is an error page".
ERROR_MARKERS = (
    "customerror",
    "under construction",
    "page not found",
    "this page isn't available",
)

# Markers in a final (post-redirect) URL that mean "we landed on an error page".
ERROR_URL_MARKERS = (
    "customerror",
    "error-page",
    "/404",
)

# (filename, kind) — kind is "list" for a JSON array, "object" for one record.
SOURCES = [
    ("jobs.json", "list"),
    ("programs.json", "list"),
    ("schooling.json", "list"),
    ("initiatives.json", "list"),
    ("career-paths.json", "list"),
    ("internships.json", "list"),
    ("job-sites.json", "list"),
    ("minimum-wage.json", "object"),
]


def label_of(filename, index, record):
    """Human label for a record, e.g. 'Cashier (CAN) (Walmart Canada)'."""
    if filename == "jobs.json":
        return f"{record.get('title', '?')} ({record.get('employer', '?')})"
    if filename == "minimum-wage.json":
        return "Ontario minimum wage"
    return record.get("name") or record.get("title") or "?"


def fetch(url):
    """GET url once (one retry on timeout). Returns (status, final_url, body_text).

    status is an int HTTP status, or None when no HTTP response was received.
    body_text is the decoded body (possibly truncated), or "".
    Raises URLError / socket errors for DNS failure, timeout after retry, etc.
    """
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    attempts = 0
    while True:
        attempts += 1
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                body = response.read(MAX_BODY).decode("utf-8", errors="ignore")
                return response.status, response.geturl(), body
        except urllib.error.HTTPError as e:
            # HTTPError is also a response: read its body for error markers.
            try:
                body = e.read(MAX_BODY).decode("utf-8", errors="ignore")
            except Exception:
                body = ""
            return e.code, e.geturl(), body
        except (socket.timeout, TimeoutError) as e:
            if attempts < 2:
                continue
            raise urllib.error.URLError(e)
        except urllib.error.URLError:
            raise


def is_dns_failure(exc):
    reason = getattr(exc, "reason", exc)
    if isinstance(reason, socket.gaierror):
        return True
    text = str(reason).lower()
    return (
        "name or service not known" in text
        or "nodename nor servname" in text
        or "temporary failure in name resolution" in text
        or "no address associated with hostname" in text
    )


def judge(url):
    """Fetch url and judge it. Returns (verdict, reason).

    verdict is one of "live", "dead", "unverifiable".
    """
    try:
        status, final_url, body = fetch(url)
    except urllib.error.URLError as e:
        if is_dns_failure(e):
            return "dead", f"DNS failure ({e.reason})"
        return "dead", f"request failed after retry: {e.reason}"
    except Exception as e:  # e.g. SSL error, unexpected network failure
        return "unverifiable", f"request error: {e}"

    if status is None:
        return "unverifiable", "no HTTP response received"

    lowered_body = body.lower()
    lowered_url = final_url.lower()
    marker = next((m for m in ERROR_MARKERS if m in lowered_body), None)
    url_marker = next((m for m in ERROR_URL_MARKERS if m in lowered_url), None)

    if status == 404:
        return "dead", "source page returned 404"
    if 200 <= status < 300:
        if marker:
            return "dead", f"page body contains error marker {marker!r}"
        if url_marker:
            return "dead", f"redirected to an error page ({final_url})"
        return "live", f"HTTP {status}"
    if status in (403, 429) or 500 <= status < 600:
        return "unverifiable", f"HTTP {status} (ambiguous — site may block automated requests)"
    if marker or url_marker:
        return "dead", f"error page (HTTP {status}, marker {marker or url_marker!r})"
    return "unverifiable", f"HTTP {status} (ambiguous)"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path, data):
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main():
    parser = argparse.ArgumentParser(description="Check Owen's Job Bank source URLs.")
    parser.add_argument("--dry-run", action="store_true",
                        help="report only; write no files")
    args = parser.parse_args()

    # Load all sources.
    datasets = {}  # filename -> (kind, data)
    for filename, kind in SOURCES:
        datasets[filename] = (kind, load_json(RESEARCH / filename))

    # Collect every URL to check, once each. Record URLs are judged and can
    # change records; step URLs are reported separately and never change a
    # record's verified flag.
    record_urls = {}   # url -> list of (filename, index-or-None, record)
    step_urls = {}     # url -> list of (path_name, step_title)
    for filename, (kind, data) in datasets.items():
        records = data if kind == "list" else [data]
        for i, record in enumerate(records):
            record_urls.setdefault(record["source_url"], []).append(
                (filename, i if kind == "list" else None, record)
            )
        if filename == "career-paths.json":
            for record in records:
                for step in record.get("steps") or []:
                    step_urls.setdefault(step.get("source_url"), []).append(
                        (record.get("name", "?"),
                         step.get("title") or step.get("name") or "?")
                    )

    # Fetch each unique URL once, politely spaced.
    verdicts = {}
    all_urls = list(record_urls) + [u for u in step_urls if u not in record_urls]
    for n, url in enumerate(all_urls):
        if n:
            time.sleep(DELAY)
        verdicts[url] = judge(url)

    # Apply record judgements.
    checked = 0
    live_count = 0
    flagged = []
    unverifiable = []
    changed_files = set()

    for filename, (kind, data) in datasets.items():
        records = data if kind == "list" else [data]
        is_min_wage = filename == "minimum-wage.json"
        for i, record in enumerate(records):
            checked += 1
            verdict, reason = verdicts[record["source_url"]]
            where = f"{filename}[{i}]" if kind == "list" else filename
            label = label_of(filename, i, record)
            if verdict == "live":
                live_count += 1
                if record.get("checked_date") != TODAY or "sync_note" in record:
                    record["checked_date"] = TODAY
                    record.pop("sync_note", None)
                    changed_files.add(filename)
            elif verdict == "dead":
                if is_min_wage:
                    # Minimum wage: liveness only — never flag it dead.
                    unverifiable.append(
                        f"{where} {label} — {reason} "
                        f"(minimum-wage source: reported as unverifiable, never flagged dead)"
                    )
                else:
                    note = f"Sync {TODAY}: {reason}."
                    if record.get("verified") is not False or record.get("sync_note") != note:
                        record["verified"] = False
                        record["sync_note"] = note
                        changed_files.add(filename)
                    flagged.append(f"{where} {label} — {reason}")
            else:  # unverifiable: leave the record exactly as-is
                unverifiable.append(f"{where} {label} — {reason}")

    # Report dead step links separately (they never change a path's flag).
    dead_steps = []
    for url, steps in step_urls.items():
        verdict, reason = verdicts[url]
        if verdict == "dead":
            for path_name, step_title in steps:
                dead_steps.append(
                    f"career-paths.json: {path_name} — step {step_title!r} — {reason} "
                    f"(step link only; path verified flag unchanged)"
                )

    report = {
        "checked": checked,
        "live": live_count,
        "flagged": flagged,
        "unverifiable": unverifiable,
        "dead_steps": dead_steps,
        "dry_run": args.dry_run,
    }

    # Human-readable report.
    print(f"Source check — {TODAY} ({'DRY RUN' if args.dry_run else 'LIVE RUN'})")
    print(f"  checked:      {checked}")
    print(f"  live:         {live_count}")
    print(f"  flagged dead: {len(flagged)}")
    print(f"  unverifiable: {len(unverifiable)}")
    print(f"  dead step links (career paths, reported only): {len(dead_steps)}")
    if flagged:
        print("\nFlagged dead:")
        for item in flagged:
            print(f"  - {item}")
    if unverifiable:
        print("\nUnverifiable (left unchanged):")
        for item in unverifiable:
            print(f"  - {item}")
    if dead_steps:
        print("\nDead career-path step links (path verified flag unchanged):")
        for item in dead_steps:
            print(f"  - {item}")
    if not flagged and not unverifiable and not dead_steps:
        print("\nAll sources live.")

    if args.dry_run:
        print("\nDry run — no files written.")
        return 0

    for filename in sorted(changed_files):
        kind, data = datasets[filename]
        dump_json(RESEARCH / filename, data)
    dump_json(REPORT_PATH, report)
    print(f"\nWrote {len(changed_files)} updated research file(s): "
          f"{', '.join(sorted(changed_files)) or 'none changed'}")
    print(f"Wrote {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
