#!/usr/bin/env python3
"""Owen's Job Bank — sync runner.

Polls the Cloudflare KV namespace for a pending sync request (written by the
site's Pages Function when someone presses "Sync listings"), and when one is
found:

1. Marks the request "running" in KV (so a second runner never double-processes it).
2. Runs scripts/check_sources.py (re-checks every source URL, no --dry-run).
3. Runs build.py (validates research/*.json, writes data/ + site/data/).
4. Writes site/data/sync-status.json.
5. If the build succeeded: commits research/ + data/ + site/data/sync-status.json
   (only when something changed) and pushes, then redeploys the site via the
   Cloudflare helper. If the build failed: still deploys the status file so
   the UI shows the failure, and commits nothing.
6. Writes the finished record to KV (sync-status + sync-request "processed")
   and appends one line to sync-log.md.

Stdlib only. Idempotent: a re-run with no pending request exits 0 quietly
(and appends nothing to the log). A crashed mid-run leaves status "running"
and is retried after 30 minutes.

Usage:
    python3 scripts/sync_runner.py
"""

import fcntl
import json
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
LOG_PATH = ROOT / "sync-log.md"
STATUS_PATH = ROOT / "site" / "data" / "sync-status.json"
LOCK_PATH = SCRIPTS / ".sync.lock"

ACCOUNT_ID = "2287da9c3dfc69703251e92aeefa1155"
NAMESPACE_ID = "de2c0a843dfa479c9f7104dc34b2024c"
API = "https://api.cloudflare.com/client/v4"
ALLOWED = ["api.cloudflare.com"]

STALE_RUNNING_MINUTES = 30
CLOUDFLARE_PY = Path.home() / "workspace" / "custom-connectors" / "custom.cloudflare" / "bin" / "cloudflare.py"


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_iso(value):
    """Parse an ISO timestamp; return an aware datetime or None."""
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def kv_url(key):
    return (
        f"{API}/accounts/{ACCOUNT_ID}/storage/kv/namespaces/"
        f"{NAMESPACE_ID}/values/{key}"
    )


def kv_get(key):
    """Return the parsed JSON value for key, or None if the key is missing."""
    req = urllib.request.Request(kv_url(key))
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=ALLOWED)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    except Exception:
        raise


def kv_put(key, record):
    """Store record (dict) as the value for key. Raises on failure."""
    body = json.dumps(record).encode("utf-8")
    req = urllib.request.Request(kv_url(key), data=body, method="PUT")
    req.add_header("Content-Type", "application/json")
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=ALLOWED)
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if not payload.get("success", False):
        raise RuntimeError(f"KV PUT {key} failed: {payload}")
    return payload


def run(cmd, cwd=ROOT):
    """Run a command, capturing output. Returns the CompletedProcess."""
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=900)


def git_staged_changes():
    """True if `git diff --cached --quiet` reports staged changes."""
    return run(["git", "diff", "--cached", "--quiet"]).returncode != 0


def append_log(line):
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def main():
    # 1. Exclusive lock — another runner holding it means exit 0 quietly.
    lock_fh = LOCK_PATH.open("w")
    try:
        fcntl.flock(lock_fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return 0

    # 2. Read the pending request.
    try:
        request = kv_get("sync-request")
    except Exception as e:
        print(f"sync_runner: KV read failed: {e}", file=sys.stderr)
        return 1
    if not request:
        return 0
    status = request.get("status")
    if status == "processed":
        return 0
    if status == "running":
        started = parse_iso(request.get("started_at"))
        if started is not None:
            age_min = (datetime.now(timezone.utc) - started).total_seconds() / 60
            if age_min < STALE_RUNNING_MINUTES:
                return 0
        # Stale "running" (or no started_at): a crashed run — retry it.
    elif status != "requested":
        # Unknown status — do not touch it.
        print(f"sync_runner: unexpected sync-request status {status!r}; ignoring",
              file=sys.stderr)
        return 0

    run_id = request.get("run_id")
    if not run_id:
        print("sync_runner: sync-request has no run_id; ignoring", file=sys.stderr)
        return 0

    started_at = now_iso()
    today = datetime.now(timezone.utc).date().isoformat()

    # 3. Claim the request immediately so no second runner double-processes it.
    try:
        kv_put("sync-request", {
            **request,
            "status": "running",
            "started_at": started_at,
        })
    except Exception as e:
        print(f"sync_runner: could not mark request running: {e}", file=sys.stderr)
        return 1

    # 4. Checker, then builder.
    checker_ok = False
    report = {"checked": 0, "live": 0, "flagged": [], "unverifiable": []}
    checker_proc = run([sys.executable, str(SCRIPTS / "check_sources.py")])
    sys.stdout.write(checker_proc.stdout)
    sys.stderr.write(checker_proc.stderr)
    if checker_proc.returncode == 0:
        checker_ok = True
        try:
            report = json.loads((SCRIPTS / "check-report.json").read_text(encoding="utf-8"))
        except Exception as e:
            print(f"sync_runner: could not read check-report.json: {e}", file=sys.stderr)
            checker_ok = False

    build_ok = False
    build_proc = None
    if checker_ok:
        build_proc = run([sys.executable, str(ROOT / "build.py")])
        sys.stdout.write(build_proc.stdout)
        sys.stderr.write(build_proc.stderr)
        build_ok = build_proc.returncode == 0

    checked = report.get("checked", 0)
    live = report.get("live", 0)
    flagged = report.get("flagged", [])
    unverifiable = report.get("unverifiable", [])

    # 5. Status record (written to site/data/sync-status.json in both paths).
    if not checker_ok or not build_ok:
        run_status = "failed"
    elif flagged or unverifiable:
        run_status = "partial"
    else:
        run_status = "ok"
    status_record = {
        "run_id": run_id,
        "started_at": started_at,
        "finished_at": now_iso(),
        "status": run_status,
        "checked": checked,
        "live": live,
        "flagged": flagged,
        "unverifiable": unverifiable,
        "last_synced": today,
    }
    STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATUS_PATH.write_text(
        json.dumps(status_record, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # 6. Build failed: deploy the status file so the UI shows the failure,
    # commit nothing, mirror the failure to KV, log, exit non-zero.
    if not build_ok:
        deploy = run([
            sys.executable, str(CLOUDFLARE_PY), "pages-deploy",
            "--dir", str(ROOT / "site"), "--project", "owen-job-bank",
        ])
        sys.stdout.write(deploy.stdout)
        sys.stderr.write(deploy.stderr)
        deploy_ok = deploy.returncode == 0
        reason = "checker crashed" if not checker_ok else "build.py failed"
        kv_record = {**status_record, "note": f"{reason}; deploy={'ok' if deploy_ok else 'failed'}"}
        try:
            kv_put("sync-status", kv_record)
            kv_put("sync-request", {
                **request, "status": "processed", "finished_at": status_record["finished_at"],
            })
        except Exception as e:
            print(f"sync_runner: KV write failed: {e}", file=sys.stderr)
        append_log(
            f"{status_record['finished_at']} run {run_id} status=failed "
            f"checked={checked} live={live} flagged={len(flagged)} "
            f"unverifiable={len(unverifiable)} commit=none "
            f"deploy={'ok' if deploy_ok else 'failed'}"
        )
        return 1

    # 7. Build succeeded: commit + push only if something is staged, then deploy.
    commit = "none"
    run(["git", "add", "research", "data", "site/data/sync-status.json"])
    if git_staged_changes():
        short = run_id.split("-")[0]
        msg = (f"Sync {short}: checked {checked} listings, {live} live, "
               f"{len(flagged)} flagged")
        commit_proc = run(["git", "commit", "-m", msg])
        if commit_proc.returncode != 0:
            print(f"sync_runner: git commit failed:\n{commit_proc.stdout}{commit_proc.stderr}",
                  file=sys.stderr)
            commit = "failed"
        else:
            sha = run(["git", "rev-parse", "--short", "HEAD"]).stdout.strip()
            commit = sha or "yes"
            push_proc = run(["git", "push"])
            sys.stdout.write(push_proc.stdout)
            sys.stderr.write(push_proc.stderr)
            if push_proc.returncode != 0:
                print("sync_runner: git push failed", file=sys.stderr)

    deploy = run([
        sys.executable, str(CLOUDFLARE_PY), "pages-deploy",
        "--dir", str(ROOT / "site"), "--project", "owen-job-bank",
    ])
    sys.stdout.write(deploy.stdout)
    sys.stderr.write(deploy.stderr)
    deploy_ok = deploy.returncode == 0

    # 8. Mirror to KV and log. A failed deploy flips the KV record to failed
    # (the site still shows the previous status file, since this deploy failed).
    kv_record = status_record
    if not deploy_ok:
        kv_record = {**status_record, "status": "failed",
                     "note": "deploy failed after a successful build"}
    try:
        kv_put("sync-status", kv_record)
        kv_put("sync-request", {
            **request, "status": "processed", "finished_at": status_record["finished_at"],
        })
    except Exception as e:
        print(f"sync_runner: KV write failed: {e}", file=sys.stderr)
        return 1
    append_log(
        f"{status_record['finished_at']} run {run_id} status={kv_record['status']} "
        f"checked={checked} live={live} flagged={len(flagged)} "
        f"unverifiable={len(unverifiable)} commit={commit} "
        f"deploy={'ok' if deploy_ok else 'failed'}"
    )
    return 0 if deploy_ok else 1


if __name__ == "__main__":
    sys.exit(main())
