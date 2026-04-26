// api/chat.js  —  Vercel Serverless Function
// Proxies requests to Google Gemini. The API key stays server-side only.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, systemPrompt } = req.body;
  if (!messages) return res.status(400).json({ error: "Missing messages" });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  console.log("[chat] GEMINI_API_KEY present:", !!GEMINI_API_KEY, "length:", GEMINI_API_KEY?.length ?? 0);
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "Gemini API key not configured" });

  // Build Gemini contents array from chat history
  // Gemini uses "user" / "model" roles (not "assistant")
  const contents = messages.map((m) => ({
    role: m.role === "ai" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  console.log("[chat] Sending to Gemini. messages:", messages.length, "contents:", JSON.stringify(contents).slice(0, 200));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents,
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.7,
        },
      }),
    });

    console.log("[chat] Gemini response status:", response.status, response.statusText);

    const rawText = await response.text();
    console.log("[chat] Gemini raw response:", rawText.slice(0, 500));

    if (!response.ok) {
      console.error(`[chat] Gemini API error ${response.status}:`, rawText);
      let errDetail;
      try { errDetail = JSON.parse(rawText); } catch { errDetail = rawText; }
      return res.status(500).json({ error: "Gemini error", status: response.status, detail: errDetail });
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("[chat] Failed to parse Gemini JSON:", parseErr.message, rawText.slice(0, 200));
      return res.status(500).json({ error: "Invalid JSON from Gemini", detail: rawText.slice(0, 200) });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't respond right now.";
    console.log("[chat] Extracted reply length:", reply.length);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("[chat] Gemini fetch error:", err.name, err.message);
    return res.status(500).json({ error: err.message });
  }
}
