// server/app.js
const http = require("http");
const { Server } = require("socket.io");

const usersInRoom = {}; // { roomId: [{ id, name }] }

const server = http.createServer((_, res) =>            // a basic HTTP server
  res.writeHead(200).end("Socket.IO server is running")
);

const io = new Server(server, {
  cors: {
    origin: "https://collaborativedraw.vercel.app",
    methods: ["GET", "POST"]
  },
});

// List of rooms and drawing history of each room
const roomHistories = {}; // { roomId: [drawingEvents] }

io.on("connection", (socket) => {   // listens for new cliend connections
  let roomId = socket.handshake.query.roomId; 

  if (roomId) {
    socket.join(roomId);
    if (!roomHistories[roomId]) roomHistories[roomId] = [];
  }

  // Event: Create new room as requested by client
  socket.on("create-room", (roomCode, callback) => {
    if (!roomHistories[roomCode]) {
      roomHistories[roomCode] = [];
      console.log("📌 Room created:", roomCode);
    }
    callback();
  });


  // Event: Join existing room as requested by client
  socket.on("join-room", ({ roomId: incomingRoomId, displayName }) => {
    roomId = incomingRoomId; // override it if passed from client
    socket.join(roomId);
    if (!usersInRoom[roomId]) usersInRoom[roomId] = [];
  
    usersInRoom[roomId].push({ id: socket.id, name: displayName });
    io.to(roomId).emit("update-users", usersInRoom[roomId]);
  });

  // Event: Check if room exists                      // used iin the JoinRoom flow
  socket.on("check-room", (roomCode, callback) => {
    const exists = !!roomHistories[roomCode];
    callback(exists);
  });

  socket.on("request-history", () => {
    if (roomId && roomHistories[roomId]) {
      socket.emit("history", roomHistories[roomId]);
    }
  });

  socket.on("start", (data) => {
    if (!roomId) return;
    
    const event = { ...data, id: socket.id, type: "start" };
    roomHistories[roomId].push(event);
    socket.to(roomId).emit("start", event);
  });

  socket.on("draw", (data) => {
    if (!roomId) return;
    
    const event = { ...data, id: socket.id, type: "draw"};
    roomHistories[roomId].push(event);
    socket.to(roomId).emit("draw", event);
  });

  socket.on("end", () => {
    if (!roomId) return;
    const event = { id: socket.id, type: "end" };
    roomHistories[roomId].push(event);
    socket.to(roomId).emit("end", event);
  });

  socket.on("clear", () => {
    if (!roomId) return;
    roomHistories[roomId] = [];
    io.to(roomId).emit("clear");
  });

  // This event is triggered when a user disconnects from the server
  socket.on("disconnect", () => {
    if (roomId && usersInRoom[roomId]) {
      usersInRoom[roomId] = usersInRoom[roomId].filter((u) => u.id !== socket.id);
      io.to(roomId).emit("update-users", usersInRoom[roomId]);
      }
  });
});




const PORT = process.env.PORT || 8080;

console.log("🧪 process.env.PORT =", process.env.PORT);
server.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
});
