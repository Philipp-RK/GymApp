// api/calendar.js  —  Vercel Serverless Function
// Creates recurring calendar reminders for each workout day.
// Uses the user's OAuth access token — no secret needed server-side for Calendar.

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const DAY_NAMES = {
  push:  "💪 Push Day – Bench, Shrugs, Lateral Raises, Fly, Skulls",
  pull:  "🔙 Pull Day – Pull Ups, Rows, Pullover, Reverse Fly, Curls",
  legs:  "🦵 Leg Day – Squat, RDL, Calf Raises, Crunches",
  rest1: "😴 Rest Day – Recovery",
  upper: "🏋️ Upper Day – Bench, Row, Lateral, Pull Ups, Fly, Curls, Skulls",
  lower: "🔻 Lower Day – Squat, RDL, Calf Raises, Crunches",
  rest2: "😴 Rest Day – Recovery",
};

const SCHEDULE = ["push", "pull", "legs", "rest1", "upper", "lower", "rest2"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { accessToken, startDate } = req.body;
  if (!accessToken || !startDate) return res.status(400).json({ error: "Missing accessToken or startDate" });

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const created = [];
    const base = new Date(startDate);

    // Create 4 weeks of events (28 days = 4 full cycles)
    for (let day = 0; day < 28; day++) {
      const date = new Date(base);
      date.setDate(base.getDate() + day);

      const dayKey = SCHEDULE[day % 7];
      const title = DAY_NAMES[dayKey];
      const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD

      const event = {
        summary: title,
        description: "Open GRIND app to start your workout.",
        start: { date: dateStr },
        end: { date: dateStr },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 480 }, // 8 hours before midnight = ~8am
          ],
        },
      };

      const r = await fetch(CALENDAR_BASE, {
        method: "POST",
        headers,
        body: JSON.stringify(event),
      });

      if (r.ok) created.push(dateStr);
    }

    return res.status(200).json({ ok: true, eventsCreated: created.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
