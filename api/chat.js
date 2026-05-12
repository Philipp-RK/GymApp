export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  const { messages, systemPrompt, maxTokens } = body;
  if (!messages) return res.status(400).json({ error: "Missing messages" });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: "Groq API key not configured" });

  const groqMessages = [];
  if (systemPrompt) groqMessages.push({ role: "system", content: systemPrompt });
  for (const m of messages) {
    groqMessages.push({ role: m.role === "ai" ? "assistant" : "user", content: m.text });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        messages: groqMessages,
        max_tokens: maxTokens ?? 800,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message ?? JSON.stringify(data);
      console.error(`[chat] Groq ${response.status}:`, msg);
      return res.status(200).json({ error: `Groq ${response.status}: ${msg}` });
    }

    const reply = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't respond right now.";
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("[chat] fetch error:", err.message);
    return res.status(200).json({ error: err.message });
  }
}
