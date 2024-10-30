/**
 * @fileoverview Entry point for the backend server.
 *
 * This file sets up and configures the Express application.
 *
 * @requires express - Fast, unopinionated, minimalist web framework for Node.js.
 * @requires cors - Middleware for enabling Cross-Origin Resource Sharing (CORS) with various options.
 * @requires sqlite3 - Asynchronous, non-blocking SQLite3 bindings for Node.js.
 * @requires Joi - Object schema description language and validator for JavaScript objects.
 * @requires path - Utilities for working with file and directory paths.
 * @requires url - Utilities for URL resolution and parsing.
*/
import express from "express";
import cors from "cors";
import { rateLimit } from 'express-rate-limit'
import database from "better-sqlite3";
// import { WebSocketServer } from "ws"; // Import ws WebSocketServer

/**
 * @class Database
 *  @classdesc A class representing the database.
 * @property {Object} database - An instance of the SQLite3 database.
 * @property {Function} exec - A function to execute a SQL query.
 * @property {Function} prepare - A function to prepare a SQL query.
 * @memberof Database
 */
class Database {
    constructor(dbPath, options) {
        this.database = new database(dbPath, options);
    }

    exec = (sql) => {
        return this.database.exec(sql);
    }

    prepare = (sql) => {
        return this.database.prepare(sql);
    }
}

/**
 * @class CustomRateLimiter
 * @classdesc A class representing a custom rate limiter.
 * @property {Number} windowMs - The time window in milliseconds.
 * @property {Number} max - The maximum number of requests.
 * @property {Map} requests - A map of requests.
 * @memberof CustomRateLimiter
*/
class CustomRateLimiter {
    constructor(windowMs = 60000, max = 5) {
        this.windowMs = windowMs;
        this.max = max;
        this.requests = new Map();
    }

    getClientIp(req) {
        // Your custom IP detection logic here
        return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    }

    cleanupOldRequests() {
        const now = Date.now();
        
        for (const [ip, data] of this.requests) {
            if (now - data.timestamp > this.windowMs) {
                this.requests.delete(ip);
            }
        }
    }

    rateLimit(req, res, next) {
        const clientIp = this.getClientIp(req);
        console.log('Request from IP:', clientIp);

        this.cleanupOldRequests();

        const now = Date.now();
        if (!this.requests.has(clientIp)) {
            this.requests.set(clientIp, { count: 1, timestamp: now });
        } else {
            const data = this.requests.get(clientIp);
            if (now - data.timestamp > this.windowMs) {
                data.count = 1;
                data.timestamp = now;
            } else {
                data.count++;
            }
            this.requests.set(clientIp, data);
        }

        const requestCount = this.requests.get(clientIp).count;

        res.setHeader('X-RateLimit-Limit', this.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - requestCount));

        if (requestCount > this.max) {
            console.log('Rate limit exceeded for IP:', clientIp);
            return res.status(429).json({
                message: 'Too many requests, please try again later.',
                status: 429
            });
        }

        next();
    }
}


/**
 * @class Server
 * @classdesc A class representing the server.
 * @property {Object} app - An instance of the Express application.
 * @property {Function} listen - A function to start the server.
 * @property {Object} endpoints - An object containing the endpoints and their handlers.
 * @property {Function} parseExec - A function to execute an array of SQL queries.
 */
class Server extends Database {
    /**
     * @public
     * @type {Object}
     * @description An instance of the Express application.
     * @memberof Server
     * @property {Object} app - An instance of the Express application.
     * @default express()
     * @see {@link https://expressjs.com/}
     * @see {@link https://www.npmjs.com/package/express}
    */
    set rate_limit(config) {
        console.log('Setting up rate limiter with config:', config);
        this.limiter = new CustomRateLimiter(config.windowMs, config.max);
        this.app.use((req, res, next) => this.limiter.rateLimit(req, res, next));
        console.log('Rate limiter applied to app');
    }

    /**
     * @public
     * @description Set the endpoints for the Express application.
     * @memberof Server
     * @param {Object} data - An object containing the endpoints and their handlers.
     */
    set endpoints(data) {
        this.#bindEndpoints = data;
        this.#bind();
    }

    /**
     * @private
     * @type {Object}
     * @description An object containing the endpoints and their handlers.
     * @memberof Server
     * @property {Object} get - An object containing the GET endpoints and their handlers.
     * @property {Object} post - An object containing the POST endpoints and their handlers.
    */
    #bindEndpoints = {};

    /**
     * @private
     * @description Middleware for the Express application.
     * @returns {void}
     * @memberof Server
     */
    #middleware() {
        this.app.set('trust proxy', 1);
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
            Object.entries(routes).forEach(([route, handler]) => {
                if (this.limiter) {
                    console.log('Applying rate limiter to route:', route);
                }

                this.app[method](route, (req, res) => {
                    handler(this, req, res);
                });
            })
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
    constructor(dbPath, options) {
        super(dbPath, options);
        this.app = express();

        this.#middleware();
    }

    /**
     * Start the server.
     * @public
     * @description Start the server on the specified port.
     * @memberof Server
     */
    listen = (port) => {
        this.app.listen(port, () => {
            console.log(
                `Server is listening on port ${port}`
            );
        });
    }

    /**
     * Create a new user.
     * @public
     * @description Create a new user with the specified name and identifier.
     * @memberof Server
     * @param {Object} data - An object containing the user data.
     */
    parseExec = async (array) => {
        for (const sql of array) {
            await this.exec(sql);
        }
    }
};

/**
 * @module Server
 * @description A module for the Server class.
 * @exports Server
 * @see {@link Server}
 * @see {@link Database}
 */
export default Server; // Export the Server class