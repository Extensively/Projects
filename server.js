// server.js — auto-selects a working HF model and uses it for @gpt
import express from "express";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`Server running on port ${port}`));
const wss = new WebSocketServer({ server });

let clients = [];

// candidate models to try (must support Inference API)
// you can add/remove entries here
const CANDIDATE_MODELS = [
  "distilgpt2",
  "openai-community/gpt2",
  "bigscience/bloom-560m",
  // "EleutherAI/gpt-neo-125M" // tried earlier — may 404 for some accounts
];

let HF_MODEL = null;
let HF_URL = null;

async function testModel(model) {
  const url = `https://api-inference.huggingface.co/models/${model}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.HF_API_KEY || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: "Hello" })
    });
    console.log(`[model-test] ${model} -> status ${resp.status}`);
    if (!resp.ok) {
      const text = await resp.text().catch(()=>"<no-text>");
      console.log(`[model-test] ${model} returned non-ok: ${resp.status} ${text}`);
      return false;
    }
    // parse to confirm we got generated text
    const j = await resp.json().catch(()=>null);
    if (!j) return false;
    // some models return [{generated_text: "..."}]
    if (Array.isArray(j) && j[0]?.generated_text) return true;
    // some return {generated_text: "..."}
    if (j?.generated_text) return true;
    // else still ok enough (some models respond differently)
    return true;
  } catch (err) {
    console.log(`[model-test] ${model} error:`, err.message || err);
    return false;
  }
}

async function chooseModel() {
  if (!process.env.HF_API_KEY) {
    console.error("HF_API_KEY is not set! Set HF_API_KEY in Render env vars.");
    return;
  }
  for (const m of CANDIDATE_MODELS) {
    const ok = await testModel(m);
    if (ok) {
      HF_MODEL = m;
      HF_URL = `https://api-inference.huggingface.co/models/${m}`;
      console.log(`[model] Selected model: ${HF_MODEL}`);
      return;
    }
  }
  console.error("No candidate model responded OK. Check HF_API_KEY and models availability.");
}

await chooseModel(); // run on startup

wss.on("connection", (ws) => {
  clients.push(ws);
  console.log("New client connected. Total clients:", clients.length);

  ws.on("message", async (msg) => {
    const text = msg.toString();
    console.log("Received:", text);

    // broadcast user message
    clients.forEach(c => {
      try { c.send(text); } catch(e) {}
    });

    if (text.trim().toLowerCase().startsWith("@gpt")) {
      if (!HF_URL) {
        const msgNo = "🤖 GPT: No working model available right now. Check server logs.";
        clients.forEach(c => { try { c.send(msgNo); } catch(e){} });
        return;
      }

      const userPrompt = text.replace(/@gpt/i, "").trim();
      if (!userPrompt) return;

      try {
        console.log("Calling HF model:", HF_MODEL);
        const response = await fetch(HF_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.HF_API_KEY || ""}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ inputs: userPrompt })
        });

        console.log("HF status:", response.status);

        const bodyText = await response.text();
        let data;
        try { data = JSON.parse(bodyText); } catch(e){ data = bodyText; }

        if (!response.ok) {
          console.error("Hugging Face request failed:", response.status, bodyText);
          clients.forEach(c => { try { c.send("🤖 GPT: Sorry, I can't respond (model error)."); } catch(e){} });
          return;
        }

        // handle common formats
        let generated = null;
        if (Array.isArray(data) && data[0]?.generated_text) generated = data[0].generated_text;
        else if (data?.generated_text) generated = data.generated_text;
        else if (typeof data === "string") generated = data; // fallback

        if (!generated) {
          console.log("HF returned unexpected format:", data);
          clients.forEach(c => { try { c.send("🤖 GPT: Sorry, no usable response."); } catch(e){} });
          return;
        }

        // avoid sending the exact echoed prompt if present
        let reply = generated;
        if (reply.startsWith(userPrompt)) reply = reply.slice(userPrompt.length).trim();
        if (!reply) reply = generated;

        clients.forEach(c => { try { c.send("🤖 GPT: " + reply); } catch(e){} });

      } catch (err) {
        console.error("Hugging Face error:", err);
        clients.forEach(c => { try { c.send("🤖 GPT: Sorry, something went wrong."); } catch(e){} });
      }
    }
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
    console.log("Client disconnected. Total clients:", clients.length);
  });
});