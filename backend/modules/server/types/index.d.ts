export default Server;
/**
 * @class Server
 * @classdesc A class representing the server.
 * @property {Object} app - An instance of the Express application.
 * @property {Function} listen - A function to start the server.
 * @property {Object} endpoints - An object containing the endpoints and their handlers.
 * @property {Function} parseExec - A function to execute an array of SQL queries.
 */
declare class Server extends Database {
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
    public set rate_limit(config: any);
    limiter: any;
    /**
     * @public
     * @description Set the endpoints for the Express application.
     * @memberof Server
     * @param {Object} data - An object containing the endpoints and their handlers.
     */
    public set endpoints(data: any);
    app: any;
    /**
     * Start the server.
     * @public
     * @description Start the server on the specified port.
     * @memberof Server
     */
    public listen: (port: any) => Promise<any>;
    /**
     * Create a new user.
     * @public
     * @description Create a new user with the specified name and identifier.
     * @memberof Server
     * @param {Object} data - An object containing the user data.
     */
    public parseExec: (array: any) => Promise<void>;
    #private;
}
/**
 * @class Database
 *  @classdesc A class representing the database.
 * @property {Object} database - An instance of the SQLite3 database.
 * @property {Function} exec - A function to execute a SQL query.
 * @property {Function} prepare - A function to prepare a SQL query.
 * @memberof Database
 */
/**
 * Represents a Database connection.
 *
 * @class
 * @param {string} dbPath - The path to the database file.
 * @param {object} options - Configuration options for the database connection.
 */
declare class Database {
    constructor(dbPath: any, options: any);
    database: any;
    /**
     * Executes a given SQL query asynchronously.
     *
     * @param {string} sql - The SQL query to be executed.
     * @returns {Promise<any>} A promise that resolves with the result of the SQL query execution or rejects with an error.
     * @memberof Database
    */
    exec: (sql: string) => Promise<any>;
    /**
     * Prepares an SQL statement for execution.
     *
     * @param {string} sql - The SQL query to be prepared.
     * @returns {object} The prepared statement object.
     */
    prepare: (sql: string) => object;
}