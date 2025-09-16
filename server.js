import express from "express";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`Server running on port ${port}`));

const wss = new WebSocketServer({ server });

let clients = [];

// 🔧 Choose your Hugging Face model here (must support Inference API!)
const HF_MODEL = "openai/gpt-oss-20b:nebius";  
const HF_URL = "https://router.huggingface.co/v1";

wss.on("connection", (ws) => {
  clients.push(ws);
  console.log("New client connected. Total clients:", clients.length);

  ws.on("message", async (msg) => {
    const text = msg.toString();
    console.log("Received:", text);

    // Broadcast user message to all clients
    clients.forEach(c => c.send(text));

    // GPT trigger
    if (text.trim().toLowerCase().startsWith("@gpt")) {
      const userPrompt = text.replace(/@gpt/i, "").trim();
      if (!userPrompt) return;

      try {
        console.log(`Calling Hugging Face model: ${HF_MODEL}`);

        const response = await fetch(HF_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ inputs: userPrompt })
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
          const errText = await response.text();
          console.error("Hugging Face request failed:", response.status, errText);
          clients.forEach(c => c.send("🤖 GPT: Sorry, I can't respond right now."));
          return;
        }

        const data = await response.json();
        console.log("Hugging Face response:", data);

        const aiReply =
          "🤖 GPT: " +
          (data[0]?.generated_text?.substring(userPrompt.length).trim() || "Sorry, no response.");
        clients.forEach(c => c.send(aiReply));

      } catch (err) {
        console.error("Hugging Face error:", err);
        clients.forEach(c => c.send("🤖 GPT: Sorry, something went wrong."));
      }
    }
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
    console.log("Client disconnected. Total clients:", clients.length);
  });
});
