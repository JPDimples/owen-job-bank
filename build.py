#!/usr/bin/env python3
"""Owen's Job Bank — data builder.

Reads the researchers' JSON files from research/, validates every record
(required fields, real source URL, checked date, verification flag), and emits
the validated data files the site loads, into data/ and site/data/.

Rules enforced here, not just by convention:
- Every record needs a source_url (http/https) and a checked_date.
- Every record needs a boolean `verified` flag. Unverified records are kept
  but flagged — the site must label them unverified, never present them as fact.
- No Tim Hortons, ever. Any job whose employer or title mentions Tim Hortons
  fails the build.

Stdlib only. Re-runnable: `python3 build.py`.

Exit code 0 = all files valid and written. Non-zero = validation failed, nothing
written.
"""

import json
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESEARCH = ROOT / "research"
DATA = ROOT / "data"
SITE_DATA = ROOT / "site" / "data"

TOWNS = [
    "Bowmanville", "Courtice", "Newcastle", "Orono",
    "Oshawa", "Whitby", "Ajax", "Pickering",
]

# (filename, required fields, list-or-object)
SOURCES = [
    ("jobs.json", ["title", "employer", "town", "source_url", "checked_date", "verified"], "list"),
    ("programs.json", ["name", "description", "source_url", "checked_date", "verified"], "list"),
    ("schooling.json", ["name", "description", "source_url", "checked_date", "verified"], "list"),
    ("initiatives.json", ["name", "description", "town", "source_url", "checked_date", "verified"], "list"),
    ("career-paths.json", ["name", "summary", "steps", "source_url", "checked_date", "verified"], "list"),
    ("job-sites.json", ["name", "description", "account", "url_template", "source_url", "checked_date", "verified"], "list"),
    ("minimum-wage.json", ["general_rate", "student_rate", "effective_date", "source_url", "checked_date", "verified"], "object"),
]


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def check_url(value, where):
    if not isinstance(value, str) or not value.startswith(("http://", "https://")):
        fail(f"{where}: source_url must be an http(s) URL, got {value!r}")


def check_record(rec, required, where):
    if not isinstance(rec, dict):
        fail(f"{where}: record is not an object: {rec!r}")
    for field in required:
        if field not in rec or rec[field] in (None, ""):
            fail(f"{where}: missing required field {field!r}")
    if not isinstance(rec["verified"], bool):
        fail(f"{where}: 'verified' must be true/false, got {rec['verified']!r}")
    check_url(rec["source_url"], where)


def load_and_validate(filename, required, kind):
    path = RESEARCH / filename
    if not path.exists():
        fail(f"missing research file: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        fail(f"{filename}: invalid JSON: {e}")
    if kind == "list":
        if not isinstance(data, list):
            fail(f"{filename}: expected a JSON array")
        for i, rec in enumerate(data):
            check_record(rec, required, f"{filename}[{i}]")
    else:
        if not isinstance(data, dict):
            fail(f"{filename}: expected a JSON object")
        check_record(data, required, filename)
    return data


def main():
    built = {}
    errors = []

    for filename, required, kind in SOURCES:
        built[filename] = load_and_validate(filename, required, kind)

    # Hard rule: no Tim Hortons, ever.
    for i, job in enumerate(built["jobs.json"]):
        hay = f"{job.get('employer', '')} {job.get('title', '')}".lower()
        if "tim horton" in hay:
            fail(f"jobs.json[{i}]: Tim Hortons is excluded — {job.get('employer')} / {job.get('title')}")

    # Job-site templates must carry a {town} placeholder the site substitutes.
    for i, site in enumerate(built["job-sites.json"]):
        if "{town}" not in (site.get("url_template") or ""):
            fail(f"job-sites.json[{i}]: url_template must contain a {{town}} placeholder, got {site.get('url_template')!r}")

    # Town check: jobs must name one covered town. Initiatives are often
    # regional, so their town field may name several towns — derive the list
    # of covered towns mentioned and require at least one.
    for i, job in enumerate(built["jobs.json"]):
        if job.get("town") not in TOWNS:
            errors.append(f"jobs.json[{i}]: town {job.get('town')!r} is not in the covered list {TOWNS}")
    for i, item in enumerate(built["initiatives.json"]):
        town_str = item.get("town") or ""
        towns = [t for t in TOWNS if t in town_str]
        if town_str in ("Durham Region", "Clarington", "Ontario"):
            towns = [town_str]
        if not towns:
            errors.append(f"initiatives.json[{i}]: town {town_str!r} names no covered town/region")
        else:
            item["towns"] = towns

    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    # Write validated data.
    DATA.mkdir(exist_ok=True)
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    for filename, data in built.items():
        text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        (DATA / filename).write_text(text, encoding="utf-8")
        (SITE_DATA / filename).write_text(text, encoding="utf-8")

    counts = {
        "jobs_total": len(built["jobs.json"]),
        "jobs_verified": sum(1 for j in built["jobs.json"] if j["verified"]),
        "jobs_by_town": {t: sum(1 for j in built["jobs.json"] if j["town"] == t) for t in TOWNS},
        "programs_total": len(built["programs.json"]),
        "programs_verified": sum(1 for p in built["programs.json"] if p["verified"]),
        "schooling_total": len(built["schooling.json"]),
        "initiatives_total": len(built["initiatives.json"]),
        "career_paths_total": len(built["career-paths.json"]),
        "job_sites_total": len(built["job-sites.json"]),
    }
    meta = {
        "generated_date": date.today().isoformat(),
        "minimum_wage": built["minimum-wage.json"],
        "counts": counts,
        "towns": TOWNS,
        "home_town": "Bowmanville",
    }
    meta_text = json.dumps(meta, indent=2, ensure_ascii=False) + "\n"
    (DATA / "meta.json").write_text(meta_text, encoding="utf-8")
    (SITE_DATA / "meta.json").write_text(meta_text, encoding="utf-8")

    print(f"Built OK ({meta['generated_date']}):")
    for key, value in counts.items():
        print(f"  {key}: {value}")
    print("Wrote data/ and site/data/.")


if __name__ == "__main__":
    main()
