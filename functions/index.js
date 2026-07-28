const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const groqApiKey = defineSecret("GROQ_API_KEY");

exports.geminiProxy = onRequest(
  { secrets: [groqApiKey], cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      const { contents } = req.body;

      if (!contents) {
        return res.status(400).json({ error: "Campo 'contents' é obrigatório" });
      }

      // Converte o formato Gemini (role/parts) para o formato Groq/OpenAI (role/content)
      const messages = contents.map(c => ({
        role: c.role === "model" ? "assistant" : "user",
        content: c.parts.map(p => p.text).join("\n")
      }));

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqApiKey.value()}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.88,
            max_tokens: 300,
            top_p: 0.95
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Erro da API Groq:", data);
        return res.status(response.status).json({ error: "Erro ao consultar Groq" });
      }

      const text = data.choices?.[0]?.message?.content || "...";

      // Devolve no MESMO formato que o Gemini devolvia, pra não precisar mudar o app.js
      return res.status(200).json({
        candidates: [{ content: { parts: [{ text }] } }]
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro interno no servidor" });
    }
  }
);