"use strict";

/**
 * @fileoverview Entry point for the backend server.
 *
 * This file sets up and configures the Express application.
 *
 * @requires server.js - The server class that handles the HTTP requests.
*/
import Server from "server";
import path from "path";
import url from "url";
import Joi from "joi";
import { StatusCodes }from 'http-status-codes';

// Import the path module
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __path = path.resolve(__dirname, "database.db");

// Create a new server instance and bind the endpoints
const createUserSchema = Joi.object({
    name: Joi.string().required(),
    identifier: Joi.string().required()
});

const getUserSchema = Joi.object({
    identifier: Joi.string().required()
});

const inviteSchema = Joi.object({
    userId: Joi.number().required(),
    key: Joi.string().required(),
    identifier: Joi.string().required()
});

const messageSchema = Joi.object({
    content: Joi.string().required(),
    key: Joi.string().required(),
    userId: Joi.number()
});

const keySchema = Joi.object({
    key: Joi.string().required()
});

// Create a new server instance and bind the endpoints
const server = new Server(__path, { verbose: console.log });
server.endpoints = {
    get: {
        ["/"]: (_, __, res) => {
            return res.status(StatusCodes.OK).send({
                response: "We are online!",
                status: StatusCodes.OK
            });
        }
    },
    post: {
        ["/send"]: (database, req, res) => {
            const { error, value } = messageSchema.validate(req.body);

            if (error) {
                return res.status(StatusCodes).send({
                    error: "Invalid request",
                    details: error.details[0].message,
                });
            }

            const { key, content } = value;

            try {
                // Insert the new message
                const stmt = database.prepare("INSERT INTO chats (key, content) VALUES (?, ?)");
                stmt.run(key, content);

                res.status(StatusCodes.OK).send({
                    response: "Message sent successfully",
                });

                // Delete the message after a period of time if it has not been claimed.
                setTimeout(() => {
                    database.prepare("DELETE FROM chats WHERE key = ?").run(content);
                    console.log("Message deleted after timeout");
                }, 60000); // after 1 minute
            } catch (err) {
                console.error("Database fetch error:", err.message);

                res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                    error: "Failed to fetch user",
                    details: err.message,
                });
            }
        },
        ["/receive"]: (database, req, res) => {
            const { error, value } = keySchema.validate(req.body);

            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).send({
                    error: "Invalid request",
                    details: error.details[0].message,
                });
            }

            const { key } = value;

            try {
                const chats = database.prepare("SELECT * FROM chats WHERE key = ?").all(key);

                if (chats.length === 0) {
                    return res.status(StatusCodes.NOT_FOUND).send({
                        error: "Not Found",
                        details: "No messages found.",
                    });
                }

                res.status(StatusCodes.OK).send({
                    response: "Messages found",
                    chats,
                });

                // Delete the message after it has been claimed
                database.prepare("DELETE FROM chats WHERE key = ?").run(key);
            } catch (err) {
                console.error("Database fetch error:", err.message);

                res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                    error: "Failed to fetch session",
                    details: err.message,
                });
            }
        },
        ["/user"]: (database, req, res) => {
            const { error, value } = getUserSchema.validate(req.body);

            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).send({
                    error: "Invalid request",
                    details: error.details[0].message,
                });
            }

            const { identifier } = value;

            try {
                // Check if the user exists using the correct column name (e.g., 'id')
                const user = database.prepare("SELECT * FROM users WHERE identifier = ?").get(identifier);

                if (!user) {
                    return res.status(StatusCodes.NOT_FOUND).send({
                        error: "Not Found",
                        details: "User not found.",
                    });
                }

                res.status(StatusCodes.OK).send({
                    response: "User found",
                    data: user,
                });
            } catch (err) {
                console.error("Database fetch error:", err.message);

                res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                    error: "Failed to fetch user",
                    details: err.message,
                });
            }
        },
        ["/claim"]: (database, req, res) => {
            const { error, value } = keySchema.validate(req.body);

            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).send({
                    error: "Invalid request",
                    details: error.details[0].message,
                });
            }

            const { key } = value;

            try {
                const session = database.prepare("SELECT * FROM sessions WHERE key = ?").get(key);

                if (!session) {
                    return res.status(StatusCodes.NOT_FOUND).send({
                        error: "Not Found",
                        details: "Session not found.",
                    });
                }

                res.status(StatusCodes.OK).send({
                    response: "Session found",
                    session,
                });

                // Delete the session after it has been claimed
                database.prepare("DELETE FROM sessions WHERE key = ?").run(key);
            } catch (err) {
                console.error("Database fetch error:", err.message);

                res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                    error: "Failed to fetch session",
                    details: err.message,
                });
            }
        },
        ["/invite"]: (database, req, res) => {
            const { error, value } = inviteSchema.validate(req.body);

            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).send({
                    error: "Invalid request",
                    details: error.details[0].message,
                });
            }

            const { userId, key, identifier } = value;

            try {
                // Check if the user already exists
                const existingEncryption = database
                    .prepare("SELECT * FROM sessions WHERE key = ?")
                    .get(key);

                if (existingEncryption) {
                    return res.status(409).send({
                        error: "Conflict",
                        details: "Encryption key already exists.",
                    });
                }

                const existingSession = database
                    .prepare("SELECT * FROM users WHERE identifier = ? AND id = ?")
                    .get(identifier, userId);

                if (!existingSession) {
                    return res.status(StatusCodes.CONFLICT).send({
                        error: "Invalid session.",
                    });
                }

                // Insert the new user
                const stmt = database.prepare("INSERT INTO sessions (userId, key) VALUES (?, ?)");
                stmt.run(userId, key);

                res.status(201).send({
                    response: "Session created successfully",
                });
            } catch (err) {
                console.error("Database insertion error:", err.message);

                // Handle unique constraint violations (as a fallback)
                if (err.code === "SQLITE_CONSTRAINT") {
                    return res.status(StatusCodes.CONFLICT).send({
                        error: "Conflict",
                        details: "Session already exists.",
                    });
                }

                res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                    error: "Failed to create session",
                    details: err.message,
                });
            }
        },
        ["/create"]: (database, req, res) => {
            // Validate the incoming request data
            const { error, value } = createUserSchema.validate(req.body);

            if (error) {
                return res.status(StatusCodes.BAD_REQUEST).send({
                    error: "Invalid request",
                    details: error.details[0].message,
                });
            }

            const { name, identifier } = value;

            try {
                const existingIdentifier = database
                    .prepare("SELECT * FROM users WHERE identifier = ?")
                    .get(identifier);

                if (existingIdentifier) {
                    return res.status(409).send({
                        error: "Conflict",
                        details: "A user with this identifier already exists.",
                    });
                }

                // Insert the new user (fixed the VALUES clause)
                const stmt = database.prepare(
                    "INSERT INTO users (name, identifier) VALUES (?, ?)"
                );
                const info = stmt.run(name, identifier);

                res.status(StatusCodes.OK).send({
                    response: "User created successfully",
                    userId: info.lastInsertRowid,
                });
            } catch (err) {
                console.error("Database insertion error:", err.message);

                // Handle unique constraint violations (as a fallback)
                if (err.code === "SQLITE_CONSTRAINT") {
                    return res.status(StatusCodes.CONFLICT).send({
                        error: "Conflict",
                        details: "Already exists.",
                    });
                } else {
                    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                        error: "Failed to create user",
                        details: err.message,
                    });
                }
            }
        }
    }
}

server.parseExec(
    [
        `DELETE FROM users`,
        `DELETE FROM sessions`,
        `DELETE FROM chats`
    ]
);

server.parseExec(
    [
        `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL
);`,
        `CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  key TEXT NOT NULL
);`,
        `CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  content TEXT NOT NULL
);`
    ]
);

server.rate_limit = {
    windowMs: 1 * 60 * 1000, // 15 minutes
    max: 5,
    message: "Too many requests",
    handler: (req, res, next, options) =>
		res.status(options.statusCode).send({
            message: options.message,
            status: options.statusCode
        })
};

// Start the server
server.listen(3002);