import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};
let chatHistory = [];

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
