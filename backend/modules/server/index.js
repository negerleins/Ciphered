/**
 * @fileoverview Entry point for the backend server.
 *
 * This file sets up and configures the Express application.
 *
 * @require express - A web application framework for Node.js.
 * @require database - A custom database class that extends the SQLite3 database.
 * @require rateLimit - A middleware function to limit repeated requests to public APIs and/or endpoints.
*/
import express from "express";
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
    };

    /**
     * Serialize the database.
     * 
     * @public
     * @memberof Database
     * @returns {void}
     * @description Serialize the database to a buffer.
     * @see {@link https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md#serializeoptions---buffer | better-sqlite3}
    */
    serialize = () => {
        try {
            const buffer = this.database.serialize();
            this.database.close();

            console.log("Database serialized:", buffer);

            this.database = new database(buffer);
        } catch (error) {
            console.error("Database serialization error:", error.message);
        }
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
        this.app.use(
            rateLimit(config)
        );
    }

    /**
     * @public
     * @description Set the callback function for the Express application.
     * @memberof Server
     * @param {Function} func 
     */
    set callback(func) {
        this.#_callback = func;
    };

    /**
     * @public
     * @description Set the endpoints for the Express application.
     * @memberof Server
     * @param {Object} data - An object containing the endpoints and their handlers.
     */
    set endpoints(data) {
        this.#_endpoints = data;
    }

    /**
     * @public
     * @description Set the middleware for the Express application.
     * @memberof Server
     * @param {Function} func 
     */
    set middleware(func) {
        this.#_middleware = func;
    }

    /**
     * @public
     * @description Set the afterware for the Express application.
     * @memberof Server
     * @param {Function} func 
     */
    set afterware(func) {
        this.#_afterware = func;
    }

    /**
     * @private
     * @type {Object}
     * @description An object containing the endpoints and their handlers.
     * @memberof Server
    */
    #_endpoints = null;

    /**
     * @private
     * @type {Function}
     * @description An function containing the middleware for the Express application.
     * @memberof Server
    */
    #_middleware = null;

    /**
     * @private
     * @type {Function}
     * @description An function containing the afterware for the Express application.
     * @memberof Server
    */
    #_afterware = null;

    /**
     * @private
     * @type {Function}
     * @description An function containing the callback for the Express application.
     * @memberof Server
    */
    #_callback = null;

    /**
     * @public
     * @description Bind the endpoints to the Express application.
     * @returns {void}
     * @memberof Server
     */
    bind() {
        if (this.#_middleware)
            this.#_middleware();

        if (this.#_endpoints) {
            Object.entries(this.#_endpoints).forEach(([method, routes]) => {
                Object.entries(routes).forEach(([route, handler]) => {
                    console.log('Binding route:', method, route);
    
                    this.app[method](route, async (req, res) => {
                        if (this.#_callback)
                            this.#_callback(req, res);

                        await handler(this, req, res);
                    });
                })
            });
        };

        if (this.#_afterware)
            this.app.use(this.#_afterware);
    }

    /**
     * @public
     * @description Set the configuration for the Express application.
     * @memberof Server
     * @param {Object} config - An object containing the configuration data.
     */
    set config(config) {
        Object.entries(config).forEach(([name, data]) => {
            this[name] = data;
        });
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
        this.app = express();
        
        if (callback)
            this.#_callback = callback;
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