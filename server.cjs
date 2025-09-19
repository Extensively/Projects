import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};
let chatHistory = [];
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client("YOUR_GOOGLE_CLIENT_ID");

app.post("/auth/verify", async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "YOUR_GOOGLE_CLIENT_ID"
    });
    const payload = ticket.getPayload();
    if (!payload.email.endsWith("@bcc.vic.edu.au")) {
      return res.json({ authorised: false });
    }

    res.json({
      authorised: true,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    });
  } catch (err) {
    res.json({ authorised: false });
  }
});

io.use((socket, next) => {
  const user = socket.handshake.auth.user;
  if (user && user.email.endsWith("@bcc.vic.edu.au")) {
    socket.user = user;
    next();
  } else {
    next(new Error("Unauthorised"));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.user.email);

  socket.on("chat message", (msg) => {
    const fullMsg = `${socket.user.name}: ${msg}`;
    io.emit("chat message", fullMsg);
  });
});

io.on("connection", (socket) => {
  socket.on("set_username", (username) => {
    users[socket.id] = username;

    // join message
    const joinMsg = { username: "System", msg: `${username} joined`, type: "system" };
    chatHistory.push(joinMsg);
    io.emit("chat_message", joinMsg);

    // send chat history to new user
    socket.emit("chat_history", chatHistory);
    io.emit("update_users", Object.values(users));
  });

  socket.on("chat_message", (data) => {
    chatHistory.push(data);
    io.emit("chat_message", data);
  });

  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      delete users[socket.id];
      const leaveMsg = { username: "System", msg: `${username} left`, type: "system" };
      chatHistory.push(leaveMsg);
      io.emit("chat_message", leaveMsg);
      io.emit("update_users", Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
