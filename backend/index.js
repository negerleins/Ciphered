/**
 * @fileoverview Entry point for the backend server.
 *
 * This file sets up and configures the Express application.
 *
 * @requires express - Fast, unopinionated, minimalist web framework for Node.js.
 */
import express from "express";
import cors from "cors";
import db from "./database.js";
import Joi from "joi"; // For input validation
import { WebSocketServer } from "ws"; // Import ws WebSocketServer

const port = 3001;
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse x-www-form-urlencoded bodies

// Create HTTP server
const server = app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });
// Map to store clients by session keys
const sessions = new Map();

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  console.log("Client attempting to connect");

  // Example: Retrieve the session key from query parameters (or send it in the first message)
  const params = new URLSearchParams(req.url.replace("/?", ""));
  const sessionKey = params.get("key");

  if (!sessionKey) {
    ws.close(4001, "Missing session key"); // Close connection if no key is provided
    return;
  }

  // Check if the session key exists in the database
  const session = db.prepare("SELECT * FROM sessions WHERE key = ?").get(sessionKey);

  if (!session) {
    ws.close(4002, "Invalid session key"); // Close connection if key is invalid
    return;
  }

  console.log(`Client connected with session key: ${sessionKey}`);

  // Store the session key in the WebSocket instance for future reference
  ws.sessionKey = sessionKey;

  // Add the WebSocket to the session's list of clients
  if (!sessions.has(sessionKey)) {
    sessions.set(sessionKey, []);
  }
  sessions.get(sessionKey).push(ws);

  // Handle incoming WebSocket messages
  ws.on("message", (message) => {
    console.log(`Received message in session ${sessionKey}: ${message}`);

    // Broadcast the message to all clients in the same session
    const clientsInSession = sessions.get(sessionKey);
    clientsInSession.forEach((client) => {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(message);
      }
    });
  });

  // Handle WebSocket disconnection
  ws.on("close", () => {
    console.log("Client disconnected");

    // Remove the WebSocket from the session
    const clientsInSession = sessions.get(sessionKey);
    const index = clientsInSession.indexOf(ws);
    if (index !== -1) {
      clientsInSession.splice(index, 1);
    }

    // If the session is empty, delete it from the map
    if (clientsInSession.length === 0) {
      sessions.delete(sessionKey);
    }
  });
});

// Input Validation Schema using Joi
const createUserSchema = Joi.object({
  name: Joi.string().required(),
  identifier: Joi.string().required(),
});

const getUserSchema = Joi.object({
  userId: Joi.number().required(),
});

const inviteSchema = Joi.object({
  userId: Joi.number().required(),
  key: Joi.string().required(),
  identifier: Joi.string().required(),
});

const messageSchema = Joi.object({
  content: Joi.string().required(),
  key: Joi.string().required(),
  userId: Joi.number(),
});

const keySchema = Joi.object({
  key: Joi.string().required(),
});

// Routes
app.get("/", (_, res) => {
  res.status(200).send({
    response: "We are online!",
  });
});

app.post("/send", (req, res) => {
  const { error, value } = messageSchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      error: "Invalid request",
      details: error.details[0].message,
    });
  }

  const { key, content } = value;

  try {
    // Insert the new message
    const stmt = db.prepare("INSERT INTO chats (key, content) VALUES (?, ?)");
    stmt.run(key, content);

    // Broadcast the message to all connected WebSocket clients
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ key, content }));
      }
    });

    res.status(200).send({
      response: "Message sent successfully",
    });

    // Delete the message after a period of time if it has not been claimed.
    setTimeout(() => {
      db.prepare("DELETE FROM chats WHERE key = ?").run(content);
      console.log("Message deleted after timeout");
    }, 60000); // after 1 minute
  } catch (err) {
    console.error("Database fetch error:", err.message);

    res.status(500).send({
      error: "Failed to fetch user",
      details: err.message,
    });
  }
});

app.post("/receive", (req, res) => {
  const { error, value } = keySchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      error: "Invalid request",
      details: error.details[0].message,
    });
  }

  const { key } = value;

  try {
    const chats = db.prepare("SELECT * FROM chats WHERE key = ?").all(key);

    if (chats.length === 0) {
      return res.status(404).send({
        error: "Not Found",
        details: "No messages found.",
      });
    }

    res.status(200).send({
      response: "Messages found",
      chats,
    });

    // Delete the message after it has been claimed
    db.prepare("DELETE FROM chats WHERE key = ?").run(key);
  } catch (err) {
    console.error("Database fetch error:", err.message);

    res.status(500).send({
      error: "Failed to fetch session",
      details: err.message,
    });
  }
});

app.post("/user", (req, res) => {
  const { error, value } = getUserSchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      error: "Invalid request",
      details: error.details[0].message,
    });
  }

  const { userId } = value;

  try {
    // Check if the user exists using the correct column name (e.g., 'id')
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

    if (!user) {
      return res.status(404).send({
        error: "Not Found",
        details: "User not found.",
      });
    }

    res.status(200).send({
      response: "User found",
      data: {
        name: user.name,
        id: user.id,
      },
    });
  } catch (err) {
    console.error("Database fetch error:", err.message);

    res.status(500).send({
      error: "Failed to fetch user",
      details: err.message,
    });
  }
});

app.post("/claim", (req, res) => {
  const { error, value } = keySchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      error: "Invalid request",
      details: error.details[0].message,
    });
  }

  const { key } = value;

  try {
    const session = db.prepare("SELECT * FROM sessions WHERE key = ?").get(key);

    if (!session) {
      return res.status(404).send({
        error: "Not Found",
        details: "Session not found.",
      });
    }

    res.status(200).send({
      response: "Session found",
      session,
    });

    // Delete the session after it has been claimed
    db.prepare("DELETE FROM sessions WHERE key = ?").run(key);
  } catch (err) {
    console.error("Database fetch error:", err.message);

    res.status(500).send({
      error: "Failed to fetch session",
      details: err.message,
    });
  }
});

app.post("/invite", (req, res) => {
  const { error, value } = inviteSchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      error: "Invalid request",
      details: error.details[0].message,
    });
  }

  const { userId, key, identifier } = value;

  try {
    // Check if the user already exists
    const existingEncryption = db
      .prepare("SELECT * FROM sessions WHERE key = ?")
      .get(key);

    if (existingEncryption) {
      return res.status(409).send({
        error: "Conflict",
        details: "Encryption key already exists.",
      });
    }

    const existingSession = db
      .prepare("SELECT * FROM users WHERE identifier = ? AND id = ?")
      .get(identifier, userId);

    if (!existingSession) {
      return res.status(409).send({
        error: "Invalid session.",
      });
    }

    // Insert the new user
    const stmt = db.prepare("INSERT INTO sessions (userId, key) VALUES (?, ?)");
    stmt.run(userId, key);

    res.status(201).send({
      response: "Session created successfully",
    });
  } catch (err) {
    console.error("Database insertion error:", err.message);

    // Handle unique constraint violations (as a fallback)
    if (err.code === "SQLITE_CONSTRAINT") {
      return res.status(409).send({
        error: "Conflict",
        details: "Session already exists.",
      });
    }

    res.status(500).send({
      error: "Failed to create session",
      details: err.message,
    });
  }
});

app.post("/create", (req, res) => {
  // Validate the incoming request data
  const { error, value } = createUserSchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      error: "Invalid request",
      details: error.details[0].message,
    });
  }

  const { name, identifier } = value;

  try {
    // Check if the user already exists
    const existingUser = db
      .prepare("SELECT * FROM users WHERE name = ?")
      .get(name);

    if (existingUser) {
      return res.status(409).send({
        error: "Conflict",
        details: "A user with this name already exists.",
      });
    }

    const existingIdentifier = db
      .prepare("SELECT * FROM users WHERE identifier = ?")
      .get(identifier);

    if (existingIdentifier) {
      return res.status(409).send({
        error: "Conflict",
        details: "A user with this identifier already exists.",
      });
    }

    // Insert the new user (fixed the VALUES clause)
    const stmt = db.prepare(
      "INSERT INTO users (name, identifier) VALUES (?, ?)"
    );
    const info = stmt.run(name, identifier);

    res.status(201).send({
      response: "User created successfully",
      userId: info.lastInsertRowid,
    });
  } catch (err) {
    console.error("Database insertion error:", err.message);

    // Handle unique constraint violations (as a fallback)
    if (err.code === "SQLITE_CONSTRAINT") {
      return res.status(409).send({
        error: "Conflict",
        details: "Already exists.",
      });
    } else {
      res.status(500).send({
        error: "Failed to create user",
        details: err.message,
      });
    }
  }
});

// Handle unsupported methods
app.use((_, res) => {
  res.status(405).send({
    error: "Method Not Allowed",
  });
});

// Clear the database tables
db.exec("DELETE FROM users");
db.exec("DELETE FROM sessions");
db.exec("DELETE FROM chats");

// Start the server
app.listen(port, '127.0.0.1', () => {
    console.log(`Server is listening on port ${port}`);
  });
  