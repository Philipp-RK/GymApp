// api/sheets.js  —  Vercel Serverless Function
// Creates / reads / writes the user's Google Sheet.
// Receives the user's Google OAuth access_token from the frontend.
// The Google OAuth Client ID is public (safe in frontend), but this
// server handles all direct Sheets API calls so no secret leaks.

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, accessToken, spreadsheetId, session } = req.body;
  if (!accessToken) return res.status(401).json({ error: "Missing access token" });

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // ── CREATE a new spreadsheet for a new user ──────────────────────────
    if (action === "create") {
      const createRes = await fetch(SHEETS_BASE, {
        method: "POST",
        headers,
        body: JSON.stringify({
          properties: { title: "GRIND – Workout Tracker" },
          sheets: [
            { properties: { title: "Sessions" } },
            { properties: { title: "Weights" } },
          ],
        }),
      });
      const sheet = await createRes.json();
      if (!createRes.ok) return res.status(500).json({ error: sheet });

      // Write header row to Sessions sheet
      await fetch(`${SHEETS_BASE}/${sheet.spreadsheetId}/values/Sessions!A1:H1?valueInputOption=RAW`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          values: [["Date", "Day", "Exercise", "Weight(kg)", "Set1", "Set2", "Set3", "Note"]],
        }),
      });

      return res.status(200).json({ spreadsheetId: sheet.spreadsheetId });
    }

    // ── APPEND a finished session ────────────────────────────────────────
    if (action === "append") {
      if (!spreadsheetId || !session) return res.status(400).json({ error: "Missing data" });

      const rows = [];
      session.exercises.forEach((ex) => {
        if (ex.skipped) return;
        rows.push([
          session.date,
          session.dayKey,
          ex.name,
          ex.weight,
          ex.sets?.[0]?.reps ?? "",
          ex.sets?.[1]?.reps ?? "",
          ex.sets?.[2]?.reps ?? "",
          rows.length === 0 ? (session.note ?? "") : "", // note only on first row
        ]);
      });

      const appendRes = await fetch(
        `${SHEETS_BASE}/${spreadsheetId}/values/Sessions!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ values: rows }),
        }
      );
      const result = await appendRes.json();
      if (!appendRes.ok) return res.status(500).json({ error: result });
      return res.status(200).json({ ok: true, updatedRows: result.updates?.updatedRows });
    }

    // ── SYNC weights ─────────────────────────────────────────────────────
    if (action === "syncWeights") {
      if (!spreadsheetId) return res.status(400).json({ error: "Missing spreadsheetId" });
      const { weights } = req.body;
      const rows = Object.entries(weights).map(([k, v]) => [k, v]);

      await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/Weights!A:B?valueInputOption=RAW`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ values: [["ExerciseID", "Weight(kg)"], ...rows] }),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
