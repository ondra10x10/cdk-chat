const express = require("express");
const http = require("http");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const SECRET = "tajny_klic";

// jednoduchá databáze v paměti
const users = [
  {
    id: 1,
    username: "admin",
    password: bcrypt.hashSync("admin", 10),
    role: "admin"
  }
];

let messages = [];

/* LOGIN */
app.post("/login", async (req, res) => {
  const user = users.find(u => u.username === req.body.username);
  if (!user) return res.sendStatus(400);

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.sendStatus(400);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET
  );

  res.json({ token });
});

/* SOCKET AUTH */
io.use((socket, next) => {
  try {
    socket.user = jwt.verify(socket.handshake.auth.token, SECRET);
    next();
  } catch {
    next(new Error("neoprávněný přístup"));
  }
});

/* CHAT */
io.on("connection", (socket) => {

  socket.emit("messages", messages);

  socket.on("send", (text) => {
    const msg = {
      id: Date.now(),
      user: socket.user.username,
      text
    };

    messages.push(msg);
    io.emit("message", msg);
  });

  /* ADMIN SMAZÁNÍ ZPRÁV */
  socket.on("delete", (id) => {
    if (socket.user.role !== "admin") return;

    messages = messages.filter(m => m.id !== id);
    io.emit("delete", id);
  });

});

server.listen(3000, () => {
  console.log("server běží");
});
