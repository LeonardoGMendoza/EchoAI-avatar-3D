const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.geminiProxy = onRequest(
  { secrets: [geminiApiKey], cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      const { contents, generationConfig, safetySettings } = req.body;

      if (!contents) {
        return res.status(400).json({ error: "Campo 'contents' é obrigatório" });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.value()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents, generationConfig, safetySettings }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Erro da API Gemini:", data);
        return res.status(response.status).json({ error: "Erro ao consultar Gemini" });
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro interno no servidor" });
    }
  }
);