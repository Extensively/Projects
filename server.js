import express from "express";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`Server running on port ${port}`));

const wss = new WebSocketServer({ server });

let clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);
  console.log("New client connected. Total clients:", clients.length);

  ws.on("message", async (msg) => {
    const text = msg.toString();
    console.log("Received:", text);

    // Broadcast to everyone
    clients.forEach(c => c.send(text));

    // Check for @gpt command (case-insensitive)
    if (text.trim().toLowerCase().startsWith("@nathangpt")) {
      const userPrompt = text.replace(/@nathangpt/i, "").trim();
      if (!userPrompt) return;

      try {
        const response = await fetch(
          "https://api-inference.huggingface.co/models/gpt2", // Replace with another model if desired
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.HF_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ inputs: userPrompt })
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.error("Hugging Face request failed:", response.status, errText);
          clients.forEach(c => c.send("🤖 NATHANGPT: Sorry, I can't respond right now."));
          return;
        }

        const data = await response.json();
        const aiReply = "🤖 NATHANGPT: " + (data[0]?.generated_text || "Sorry, no response.");
        clients.forEach(c => c.send(aiReply));

      } catch (err) {
        console.error("Hugging Face error:", err);
        clients.forEach(c => c.send("🤖 NATHANGPT: Sorry, something went wrong."));
      }
    }
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
    console.log("Client disconnected. Total clients:", clients.length);
  });
});
