import express from "express";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`Server running on ${port}`));
const wss = new WebSocketServer({ server });

let clients = [];
console.log(process.env.OPENAI_API_KEY);
wss.on("connection", (ws) => {
  clients.push(ws);

  ws.on("message", async (msg) => {
    const text = msg.toString();

    // Broadcast user message to everyone
    clients.forEach(c => c.send(text));

    // If message starts with @gpt, ask OpenAI
    if (text.startsWith("@nathangpt")) {
      const userPrompt = text.replace("@nathangpt", "").trim();
      console.log("Fetching GPT:", userPrompt)
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: userPrompt }]
          })
        });

        const data = await response.json();
        const aiReply = "🤖 GPT: " + data.choices[0].message.content;

        // Send reply to everyone
        clients.forEach(c => c.send(aiReply));
      } catch (err) {
        console.error("OpenAI error:", err);
      }
    }
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });
});
