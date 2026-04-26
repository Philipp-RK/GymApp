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

  // Verify Google token and get email
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

  if (action === "load") {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/user_data?user_email=eq.${encodeURIComponent(email)}&select=*`,
      { headers: sbHeaders }
    );
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(200).json({ program: null, history: [], chat_sessions: [], sheet_id: null, rest_enabled: true });
    return res.status(200).json(rows[0]);
  }

  if (action === "save") {
    const row = { user_email: email, updated_at: new Date().toISOString(), ...data };
    await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
      method: "POST",
      headers: { ...sbHeaders, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify(row),
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
