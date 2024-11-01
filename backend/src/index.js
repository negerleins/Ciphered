"use strict";

/**
 * @fileoverview Entry point for the backend server.
 *
 * This file sets up and configures the Express application.
 *
 * @require server - A custom server class that extends the Express application.
*/
import Server from "server";
import Config from "config";
import path from "path";
import url from "url";

// Define the file and directory paths
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __path = path.resolve(__dirname, "database.db");

// Create a new server instance and bind the endpoints
const server = new Server(__path, {}, ( _, res ) => {
    res.on('finish', () => {
        console.log('Request finished', res.statusCode, res.statusMessage);
    });
});

// Create a new configuration instance
const config = new Config();

// Set the server configuration
server.limiter = config.limiter;
server.endpoints = config.endpoints;

// Reset the database
server.parseExec([
    `DELETE FROM users`,
    `DELETE FROM sessions`,
    `DELETE FROM chats`
]).catch((err) => {
    console.error("Database reset error:", err.message);
});

// Setup the database
server.parseExec([
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
]).catch((err) => {
    console.error("Database setup error:", err.message);
});

// Start the server
server.listen(3003).then(({_, port}) => {
    console.log(" <?> Listening on port:", port);
}).catch((err) => {
    console.error(" <!> Server start error:", err.message);
});