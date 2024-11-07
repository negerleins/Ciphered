export default Module;
declare class Module {
    /**
     * Constructor for the Config class.
     * @constructor
     * @description Create a new instance of the Config class.
     * @param {Server} server - The server instance to bind the configuration to.
     * @memberof Config
     * @returns {Config}
     */
    constructor(server: Server);
    load(): Promise<any>;
    server: Server;
    #private;
}
