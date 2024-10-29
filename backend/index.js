"use strict";

/**
 * @fileoverview Entry point for the backend server.
 *
 * This file sets up and configures the Express application.
 *
 * @requires server.js - The server class that handles the HTTP requests.
*/
import Server from "server";

// Create a new server instance and bind the endpoints
const server = new Server();
server.PORT = 3001;

// Start the server
server.listen();