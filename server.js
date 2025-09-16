import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};          // { socketId: username }
let chatHistory = [];    // all messages in order

io.on("connection", (socket) => {
  // When user sets their username
  socket.on("set_username", (username) => {
    users[socket.id] = username;

    // Send existing chat history to the new user
    socket.emit("chat_history", chatHistory);

    // Notify all clients that a new user joined
    io.emit("user_joined", { username, users: Object.values(users) });
  });

  // When a chat message is sent
  socket.on("chat_message", (data) => {
    chatHistory.push(data);      // save in history
    io.emit("chat_message", data); // broadcast to all
  });

  // When a user disconnects
  socket.on("disconnect", () => {
    const username = users[socket.id];
    delete users[socket.id];
    io.emit("user_left", { username, users: Object.values(users) });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));