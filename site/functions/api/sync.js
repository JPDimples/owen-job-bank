// POST /api/sync — request a listings re-check.
// Writes a request record to the SYNC_KV namespace and returns a run_id.
// A 10-minute cooldown prevents duplicate/overlapping runs: if a record
// with status "requested" or "running" was created within the last
// 10 minutes, the existing run_id is returned with HTTP 409.

const COOLDOWN_MS = 10 * 60 * 1000;
const KEY = "sync-request";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!env.SYNC_KV) {
    return json({ ok: false, error: "kv_not_configured" }, 500);
  }

  let existing = null;
  try {
    const raw = await env.SYNC_KV.get(KEY);
    if (raw) existing = JSON.parse(raw);
  } catch {
    existing = null;
  }

  if (
    existing &&
    (existing.status === "requested" || existing.status === "running") &&
    existing.requested_at &&
    Date.now() - Date.parse(existing.requested_at) < COOLDOWN_MS
  ) {
    return json({ ok: false, error: "already_running", run_id: existing.run_id }, 409);
  }

  const record = {
    run_id: crypto.randomUUID(),
    requested_at: new Date().toISOString(),
    status: "requested",
  };

  await env.SYNC_KV.put(KEY, JSON.stringify(record));
  return json({ ok: true, run_id: record.run_id }, 200);
}
