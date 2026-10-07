// ============================================================
// CHATFLUX - MAIN SERVER
// Node.js + Express + Socket.IO
// ============================================================

// -------------------------
// IMPORT PACKAGES
// -------------------------

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

// -------------------------
// CREATE APPLICATION
// -------------------------

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// -------------------------
// SERVER SETTINGS
// -------------------------

const PORT = process.env.PORT || 3000;

// -------------------------
// MIDDLEWARE
// -------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the public folder
app.use(express.static(path.join(__dirname, "public")));

// -------------------------
// USERS
// -------------------------

// Store currently connected users.
//
// Example:
// {
//     socketId: {
//         username: "Harsha",
//         joinedAt: Date
//     }
// }

const users = new Map();

// -------------------------
// HELPER FUNCTIONS
// -------------------------

function getOnlineUsers() {
    return Array.from(users.values()).map((user) => ({
        username: user.username,
        joinedAt: user.joinedAt
    }));
}

function cleanText(text, maxLength = 500) {
    if (typeof text !== "string") {
        return "";
    }

    return text
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, maxLength);
}

function createTimestamp() {
    return new Date().toISOString();
}

function broadcastOnlineUsers() {
    io.emit("online users", getOnlineUsers());
}

// -------------------------
// BASIC ROUTES
// -------------------------

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Server health check
app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        server: "ChatFlux",
        status: "online",
        users: users.size,
        time: createTimestamp()
    });
});

// -------------------------
// SOCKET.IO CONNECTION
// -------------------------

io.on("connection", (socket) => {

    console.log("------------------------------------------------");
    console.log("New socket connection:", socket.id);
    console.log("------------------------------------------------");

    // ========================================================
    // USER JOIN
    // ========================================================

    socket.on("join chat", (username) => {

        username = cleanText(username, 30);

        // Username validation
        if (!username) {
            socket.emit("server error", {
                message: "Please enter a username."
            });

            return;
        }

        if (username.length < 2) {
            socket.emit("server error", {
                message: "Username must contain at least 2 characters."
            });

            return;
        }

        // Prevent duplicate usernames
        const usernameExists = Array.from(users.values())
            .some(
                (user) =>
                    user.username.toLowerCase() === username.toLowerCase()
            );

        if (usernameExists) {
            socket.emit("server error", {
                message: "That username is already online."
            });

            return;
        }

        // Save user
        users.set(socket.id, {
            username: username,
            joinedAt: createTimestamp()
        });

        console.log(`${username} joined the chat.`);

        // Confirm login to this user
        socket.emit("join successful", {
            username: username
        });

        // Tell everyone
        io.emit("system message", {
            text: `${username} joined the chat.`,
            time: createTimestamp()
        });

        // Update online users
        broadcastOnlineUsers();
    });

    // ========================================================
    // SEND MESSAGE
    // ========================================================

    socket.on("chat message", (messageText) => {

        const user = users.get(socket.id);

        // User must join first
        if (!user) {
            socket.emit("server error", {
                message: "You must join the chat first."
            });

            return;
        }

        // Clean message
        const message = cleanText(messageText, 500);

        // Ignore empty messages
        if (!message) {
            return;
        }

        // Create message object
        const messageData = {
            id: `${Date.now()}-${socket.id}`,
            username: user.username,
            message: message,
            time: createTimestamp()
        };

        console.log(
            `[MESSAGE] ${user.username}: ${message}`
        );

        // Send message to everyone
        io.emit("chat message", messageData);
    });

    // ========================================================
    // TYPING STARTED
    // ========================================================

    socket.on("typing", () => {

        const user = users.get(socket.id);

        if (!user) {
            return;
        }

        socket.broadcast.emit("user typing", {
            username: user.username
        });
    });

    // ========================================================
    // TYPING STOPPED
    // ========================================================

    socket.on("stop typing", () => {

        const user = users.get(socket.id);

        if (!user) {
            return;
        }

        socket.broadcast.emit("user stopped typing", {
            username: user.username
        });
    });

    // ========================================================
    // PRIVATE MESSAGE FOUNDATION
    // ========================================================

    socket.on("private message", ({ targetUsername, message }) => {

        const sender = users.get(socket.id);

        if (!sender) {
            return;
        }

        targetUsername = cleanText(targetUsername, 30);
        message = cleanText(message, 500);

        if (!targetUsername || !message) {
            return;
        }

        // Find target socket
        let targetSocketId = null;

        for (const [socketId, user] of users.entries()) {

            if (
                user.username.toLowerCase() ===
                targetUsername.toLowerCase()
            ) {
                targetSocketId = socketId;
                break;
            }
        }

        if (!targetSocketId) {
            socket.emit("server error", {
                message: `${targetUsername} is not online.`
            });

            return;
        }

        const privateMessage = {
            sender: sender.username,
            receiver: targetUsername,
            message: message,
            time: createTimestamp()
        };

        // Send to receiver
        io.to(targetSocketId).emit(
            "private message",
            privateMessage
        );

        // Send copy to sender
        socket.emit(
            "private message",
            privateMessage
        );
    });

    // ========================================================
    // GET ONLINE USERS
    // ========================================================

    socket.on("request online users", () => {

        socket.emit(
            "online users",
            getOnlineUsers()
        );
    });

    // ========================================================
    // DISCONNECT
    // ========================================================

    socket.on("disconnect", () => {

        const user = users.get(socket.id);

        if (user) {

            console.log(`${user.username} disconnected.`);

            users.delete(socket.id);

            // Tell everyone
            io.emit("system message", {
                text: `${user.username} left the chat.`,
                time: createTimestamp()
            });

            // Update user list
            broadcastOnlineUsers();
        }

        console.log("Socket disconnected:", socket.id);
    });
});

// ============================================================
// ERROR HANDLING
// ============================================================

process.on("uncaughtException", (error) => {

    console.error("UNCAUGHT EXCEPTION:");
    console.error(error);
});

process.on("unhandledRejection", (error) => {

    console.error("UNHANDLED PROMISE REJECTION:");
    console.error(error);
});

// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, () => {

    console.log("");
    console.log("================================================");
    console.log("              CHATFLUX SERVER");
    console.log("================================================");
    console.log("");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Port: ${PORT}`);
    console.log("Socket.IO: ENABLED");
    console.log("Real-time chat: ENABLED");
    console.log("Online users: ENABLED");
    console.log("Typing indicator: ENABLED");
    console.log("Private messaging: ENABLED");
    console.log("");
    console.log("Server is ready!");
    console.log("================================================");
    console.log("");
});