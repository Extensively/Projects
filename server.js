import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {}; // { socketId: username }
let chatHistory = []; // stores all messages

io.on("connection", (socket) => {
  // When a new user sets their username
  socket.on("set_username", (username) => {
    users[socket.id] = username;

    // Send current chat history to this new user
    socket.emit("chat_history", chatHistory);

    io.emit("user_joined", { username, users: Object.values(users) });
  });

  // When a message is sent
  socket.on("chat_message", (data) => {
    // Save to chat history
    chatHistory.push(data);

    // Broadcast to everyone
    io.emit("chat_message", data);
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
