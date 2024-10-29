/**
 * @fileoverview Entry point for the backend server.
 *
 * This file sets up and configures the Express application.
 *
 * @requires express - Fast, unopinionated, minimalist web framework for Node.js.
 * @requires cors - Middleware for enabling Cross-Origin Resource Sharing (CORS) with various options.
 * @requires sqlite3 - Asynchronous, non-blocking SQLite3 bindings for Node.js.
 * @requires Joi - Object schema description language and validator for JavaScript objects.
*/
import express from "express";
import cors from "cors";
import Joi from "joi"; // For input validation
import db from "./database.js";
// import { WebSocketServer } from "ws"; // Import ws WebSocketServer

/**
 * @class Server
 * @classdesc A class representing the server.
 * @property {Array} messages - An array of messages.
 * @property {Object} app - An instance of the Express application.
 * @method {Function} start - A method to start the server.
 * @method {Function} #middleware - A private method to set up middleware.
 * @method {Function} #bind - A private method to bind the endpoints.
 */
class Server {
    #createUserSchema = Joi.object({
      name: Joi.string().required(),
      identifier: Joi.string().required()
    });
  
    #getUserSchema = Joi.object({
      identifier: Joi.string().required()
    });
  
    #inviteSchema = Joi.object({
      userId: Joi.number().required(),
      key: Joi.string().required(),
      identifier: Joi.string().required()
    });
  
    #messageSchema = Joi.object({
      content: Joi.string().required(),
      key: Joi.string().required(),
      userId: Joi.number()
    });
  
    #keySchema = Joi.object({
      key: Joi.string().required()
    });
  
    /**
     * @private
     * @type {Object}
     * @description An object containing the endpoints and their handlers.
     * @memberof Server
     * @property {Object} get - An object containing the GET endpoints and their handlers.
     * @property {Object} post - An object containing the POST endpoints and their handlers.
    */
    #bindEndpoints = {
      get: {
        ["/"]: (_, res) => {
          return res.status(200).send({
            response: "We are online!",
          });
        }
      },
      post: {
        ["/send"]: (req, res) => {
          const { error, value } = this.#messageSchema.validate(req.body);
  
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
        },
        ["/receive"]: (req, res) => {
          const { error, value } = this.#keySchema.validate(req.body);
  
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
        },
        ["/user"]: (req, res) => {
          const { error, value } = this.#getUserSchema.validate(req.body);
  
          if (error) {
            return res.status(400).send({
              error: "Invalid request",
              details: error.details[0].message,
            });
          }
  
          const { identifier } = value;
  
          try {
            // Check if the user exists using the correct column name (e.g., 'id')
            const user = db.prepare("SELECT * FROM users WHERE identifier = ?").get(identifier);
  
            if (!user) {
              return res.status(404).send({
                error: "Not Found",
                details: "User not found.",
              });
            }
  
            res.status(200).send({
              response: "User found",
              data: user,
            });
          } catch (err) {
            console.error("Database fetch error:", err.message);
  
            res.status(500).send({
              error: "Failed to fetch user",
              details: err.message,
            });
          }
        },
        ["/claim"]: (req, res) => {
          const { error, value } = this.#keySchema.validate(req.body);
  
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
        },
        ["/invite"]: (req, res) => {
          const { error, value } = this.#inviteSchema.validate(req.body);
  
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
        },
        ["/create"]: (req, res) => {
          // Validate the incoming request data
          const { error, value } = this.#createUserSchema.validate(req.body);
  
          if (error) {
            return res.status(400).send({
              error: "Invalid request",
              details: error.details[0].message,
            });
          }
  
          const { name, identifier } = value;
  
          try {
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
        }
      }
    }
  
    /**
     * @private
     * @description Middleware for the Express application.
     * @returns {void}
     * @memberof Server
     */
    #middleware() {
      this.app.use(cors());
      this.app.use(express.json()); // To parse JSON bodies
      this.app.use(express.urlencoded({ extended: true })); // To parse x-www-form-urlencoded bodies
    };
  
    /**
     * @private
     * @description Bind the endpoints to the Express application.
     * @returns {void}
     * @memberof Server
     */
    #bind() {
      Object.entries(this.#bindEndpoints).forEach(([method, routes]) => {
        Object.entries(routes).forEach(([path, handler]) => {
          this.app[method](path, handler);
        });
      });
  
      this.app.use(
        (_, res) => {
          res.status(405).send({
            error: "Method Not Allowed",
          });
        }
      );
    }
  
    /**
     * Constructor for the Server class.
     * @constructor
     * @description Create a new instance of the Server class.
     * @memberof Server
     * @returns {Server}
     */
    constructor() {
      this.app = express();
      this.messages = [];

      // Set the default port number
      this._port = process.env.PORT || 3001;
  
      this.#middleware();
      this.#bind();
    }

    /**
     * Set the port number.
     * @public
     * @description Set the port number for the server.
     * @memberof Server
     * @param {number} integer - The port number.
     */
    set PORT(integer) {
      this._port = integer;
    }
  
    /**
     * Start the server.
     * @public
     * @description Start the server on the specified port.
     * @memberof Server
     */
    listen = () => {
      this.app.listen(this._port, () => {
        console.log(
          `Server is listening on port ${this._port}`
        );
      });
    }

    clearDatabase = () => {
      db.exec("DELETE FROM users");
      db.exec("DELETE FROM sessions");
      db.exec("DELETE FROM chats");
    }
};

//module.exports = Server; // Export the Server class
export default Server; // Export the Server class