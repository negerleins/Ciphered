/**
 * @fileoverview Entry point for the backend server.
 *
 * This file sets up and configures the Express application.
 *
 * @requires express - Fast, unopinionated, minimalist web framework for Node.js.
 */ // index.js
import express from "express";
import cors from "cors";
import db from "./database.js";
import Joi from "joi"; // For input validation

const port = 3001;
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse x-www-form-urlencoded bodies

// Input Validation Schema using Joi
const userSchema = Joi.object({
  name: Joi.string().required(),
});

const getUserSchema = Joi.object({
  userId: Joi.number().required(),
});

const inviteSchema = Joi.object({
  userId: Joi.number().required(),
  key: Joi.string().required(),
});

// Routes
app.get("/", (_, res) => {
  res.status(200).send({
    response: "We are online!",
  });
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
      user,
    });
  } catch (err) {
    console.error("Database fetch error:", err.message);

    res.status(500).send({
      error: "Failed to fetch user",
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

  const { userId, key } = value;

  try {
    // Check if the user already exists
    const existingEncryption = db
      .prepare("SELECT * FROM users WHERE key = ?")
      .get(key);

    if (existingEncryption) {
      return res.status(409).send({
        error: "Conflict",
        details: "Encryption key already exists.",
      });
    }

    // Insert the new user
    const stmt = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
    const info = stmt.run(userId, key);

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
        details: "Email already exists.",
      });
    }

    res.status(500).send({
      error: "Failed to create user",
      details: err.message,
    });
  }
});

app.post("/create", (req, res) => {
  // Validate the incoming request data
  const { error, value } = userSchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      error: "Invalid request",
      details: error.details[0].message,
    });
  }

  const { name } = value;

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

    // Insert the new user (fixed the VALUES clause)
    const stmt = db.prepare("INSERT INTO users (name) VALUES (?)");
    const info = stmt.run(name);

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
        details: "Name already exists.",
      });
    }

    res.status(500).send({
      error: "Failed to create user",
      details: err.message,
    });
  }
});

// Handle unsupported methods
app.use((_, res) => {
  res.status(405).send({
    error: "Method Not Allowed",
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
