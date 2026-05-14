export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: "Supabase not configured" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  const { action, accessToken, ...data } = body;
  if (!accessToken) return res.status(401).json({ error: "No access token" });

  let email;
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const info = await r.json();
    if (!info.email) return res.status(401).json({ error: "Invalid token" });
    email = info.email;
  } catch {
    return res.status(401).json({ error: "Token verification failed" });
  }

  const sbHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    "apikey": SUPABASE_SERVICE_KEY,
  };

  const sbGet = (table) =>
    fetch(`${SUPABASE_URL}/rest/v1/${table}?user_email=eq.${encodeURIComponent(email)}&select=*`, { headers: sbHeaders })
      .then(r => r.json())
      .then(rows => (Array.isArray(rows) && rows.length ? rows[0] : null));

  const sbUpsert = (table, row) =>
    fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_email: email, ...row }),
    });

  if (action === "load") {
    const [settings, program, statistics, chats, track, home] = await Promise.all([
      sbGet("settings"),
      sbGet("program"),
      sbGet("statistics"),
      sbGet("chats"),
      sbGet("track"),
      sbGet("home"),
    ]);
    return res.status(200).json({
      program:       program?.program       ?? null,
      history:       statistics?.history    ?? [],
      chat_sessions: chats?.chat_sessions   ?? [],
      sheet_id:      settings?.sheet_id     ?? null,
      rest_enabled:  settings?.rest_enabled ?? true,
      tracker_goals: track?.tracker_goals   ?? [],
      tracker_logs:  track?.tracker_logs    ?? [],
      meals:         track?.meals           ?? [],
      start_date:    home?.start_date       ?? null,
    });
  }

  const TABLE_COLUMNS = {
    settings:   ["rest_enabled", "sheet_id"],
    program:    ["program"],
    statistics: ["history"],
    chats:      ["chat_sessions"],
    track:      ["tracker_goals", "tracker_logs", "meals"],
    home:       ["start_date"],
  };

  if (action === "save") {
    const { table } = data;
    const allowed = TABLE_COLUMNS[table];
    if (!allowed) return res.status(400).json({ error: "Unknown table" });

    const row = {};
    for (const col of allowed) {
      if (data[col] !== undefined) row[col] = data[col];
    }

    await Promise.all([
      sbUpsert(table, row),
      sbUpsert("main", { updated_at: new Date().toISOString() }),
    ]);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
