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
import database from "better-sqlite3";
import { rateLimit } from 'express-rate-limit'
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
    /**
     * Represents a Database connection.
     * 
     * @class
     * @param {string} dbPath - The path to the database file.
     * @param {object} options - Configuration options for the database connection.
     */
    constructor(dbPath, options) {
        this.database = new database(dbPath, options);
    }

    /**
     * Executes a given SQL query asynchronously.
     *
     * @param {string} sql - The SQL query to be executed.
     * @returns {Promise<any>} A promise that resolves with the result of the SQL query execution or rejects with an error.
     * @memberof Database
    */
    exec = (sql) => {
        return new Promise((resolve, reject) => {
            try {
                const result = this.database.exec(sql);
                resolve(result !== undefined);
            } catch (error) {
                reject(error);
            }
        });
    };

    /**
     * Prepares an SQL statement for execution.
     *
     * @param {string} sql - The SQL query to be prepared.
     * @returns {object} The prepared statement object.
     */
    prepare = (sql) => {
        return this.database.prepare(sql);
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
    set limiter(config) {
        this.app.use(rateLimit(config));
    }

    /**
     * @public
     * @description Set the endpoints for the Express application.
     * @memberof Server
     * @param {Object} data - An object containing the endpoints and their handlers.
     */
    set endpoints(data) {
        this.#bindEndpoints = data;
        this.#bind.call(this);
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
        const requestTime = function (req, res, next) {
            req.requestTime = Date.now()
            next()
        }
          
        this.app.use(requestTime)
          
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
                console.log('Binding route:', method, route);

                this.app[method](route, async (req, res) => {
                    await handler(this, req, res);

                    if (this.callback)
                        this.callback(req, res);
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
     * @param {string} dbPath - The path to the SQLite3 database file.
     * @param {object} options - Configuration options for the database connection.
     * @param {Function} callback - A callback function to be executed after the server is started.
     * @memberof Server
     * @returns {Server}
     */
    constructor(dbPath, options, callback) {
        super(dbPath, options);
        this.callback = callback;
        this.app = express();
        this.#middleware();
    }

    /**
     * Start the server.
     * @public
     * @description Start the server on the specified port.
     * @memberof Server
     */
    listen = async (port) => {
        return new Promise((resolve, reject) => {
            const server = this.app.listen(port, () => {
                resolve({ server, port });
            });

            server.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Create a new user.
     * @public
     * @description Create a new user with the specified name and identifier.
     * @memberof Server
     * @param {Object} data - An object containing the user data.
     */
    parseExec = (array) => {
        return array.reduce((promiseChain, sql) => {
            return promiseChain.then(results =>
                this.exec(sql)
                    .then(result => [...results, result])
            );
        }, Promise.resolve([]));
    };

};

/**
 * @module Server
 * @description A module for the Server class.
 * @exports Server
 * @see {@link Server}
 * @see {@link Database}
 */
export default Server; // Export the Server class