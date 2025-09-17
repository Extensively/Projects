import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};          // { socketId: username }
let chatHistory = [];    // all messages in order

io.on("connection", (socket) => {

  socket.on("set_username", (username) => {
    users[socket.id] = username;

    // Notify all clients about the join
    const joinMsg = { username: "System", msg: `${username} joined`, type: "system" };
    chatHistory.push(joinMsg);
    io.emit("chat_message", joinMsg);

    // Send existing chat history to the new user
    socket.emit("chat_history", chatHistory);

    // Update online users for everyone
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
const imageInput = document.getElementById("imageInput");
const sendImageBtn = document.getElementById("sendImage");

sendImageBtn.onclick = () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result; // base64 image string
    socket.emit("chat_message", {
      username,
      type: "image",
      img: dataUrl
    });
  };
  reader.readAsDataURL(file);

  imageInput.value = ""; // reset input
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
