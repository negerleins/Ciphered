/**
 * Configuration file for the backend server.
 * 
 * @module config
 * @requires Joi
 * @requires http-status-codes
 * @requires cors
 * @requires express
 */
import Joi from "joi";
import cors from "cors";
import helmet from "helmet";
import express from "express";
import { StatusCodes } from 'http-status-codes';

class Module {
    #keySchema = Joi.object({
        key: Joi.string().required()
    });

    #createUserSchema = Joi.object({
        name: Joi.string().required(),
        identifier: Joi.string().required()
    });

    #getUserSchema = Joi.object({
        identifier: Joi.string().required()
    });

    #inviteSchema = Joi.object({
        key: Joi.string().required(),
        identifier: Joi.string().required()
    });

    #messageSchema = Joi.object({
        content: Joi.string().required(),
        key: Joi.string().required(),
        userId: Joi.number()
    });

    #config = {
        limiter: {
            windowMs: 1 * 15 * 1000,
            limit: 10,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: "Too many requests",
            handler: (_, res, __, options) =>
                res.status(options.statusCode).send({
                    message: options.message,
                    status: options.statusCode
                }),
            keyGenerator: (req) => {
                return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            }
        },
        callback: (req, res) => {
            res.on('send', () => {
                console.log('Response sent', res.statusCode, res.statusMessage);
            });

            res.on('close', () => {
                console.log('Response closed', res.statusCode, res.statusMessage);
            });

            res.on('finish', () => {
                console.log('Request finished', res.statusCode, res.statusMessage);
            });

            res.on('error', (err) => {
                console.error('Response error', err.message);
            });

            res.on('timeout', () => {
                console.error('Response timeout');
            });

            res.on('end', () => {
                console.log('Response ended');
            });
        },
        middleware: () => {
            this.server.app.use(helmet());
            this.server.app.disable('x-powered-by');
            this.server.app.set('trust proxy', 1);
            this.server.app.use(express.json());
            this.server.app.use(express.urlencoded({ extended: true }));
            this.server.app.use((req, _, next) => {
                req.requestTime = Date.now()
                next()
            });
            this.server.app.use((req, res, next) => {
                const headersToRemove = [
                    'X-Powered-By', 'Server', 'Date', 'Connection',
                    'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers',
                    'Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials',
                    'Access-Control-Expose-Headers', 'Access-Control-Max-Age', 'X-Download-Options',
                    'X-Content-Type-Options', 'X-Frame-Options', 'Strict-Transport-Security',
                    'Content-Security-Policy', 'X-XSS-Protection', 'Referrer-Policy', 'Expect-CT',
                    'Feature-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy',
                    'Cross-Origin-Embedder-Policy', 'Cross-Origin-Resource-Policy', 'Alt-Svc',
                    'X-XXS-Protection', 'X-Content-Type-Options', 'X-Permitted-Cross-Domain-Policies',
                    'X-DNS-Prefetch-Control', 'Origin-Agent-Cluster', 'Timing-Allow-Origin',
                ];
    
                headersToRemove.forEach(header => {
                    res.removeHeader(header);
                });

                next();
            });
        },
        afterware: (_, res) => {
            res.status(StatusCodes.NOT_ACCEPTABLE).send({
                error: "Method Not Allowed"
            });
        },
        endpoints: {
            get: {
                ["/"]: (_, req, res) => {
                    return res.status(StatusCodes.OK).send({
                        response: "We are online!",
                        status: StatusCodes.OK,
                        data: {
                            requestTime: Date.now() - req.requestTime
                        }
                    });
                }
            },
            post: {
                ["/send"]: (database, req, res) => {
                    const { error, value } = this.#messageSchema.validate(req.body);

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
                    const { error, value } = this.#keySchema.validate(req.body);

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
                    const { error, value } = this.#getUserSchema.validate(req.body);

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
                    const { error, value } = this.#keySchema.validate(req.body);

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

                        const user = database.prepare("SELECT * FROM users WHERE id = ?").get(session.userId);

                        if (!user) {
                            return res.status(StatusCodes.NOT_FOUND).send({
                                error: "Not Found",
                                details: "User not found.",
                            });
                        }

                        res.status(StatusCodes.OK).send({
                            response: "Session found",
                            session: {
                                identifier: user.identifier
                            }
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
                ["/create"]: (database, req, res) => {
                    const { error, value } = this.#inviteSchema.validate(req.body);

                    if (error) {
                        return res.status(StatusCodes.BAD_REQUEST).send({
                            error: "Invalid request",
                            details: error.details[0].message,
                        });
                    }

                    const { key, identifier } = value;

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
                            .prepare("SELECT * FROM users WHERE identifier = ?")
                            .get(identifier);

                        if (!existingSession) {
                            return res.status(StatusCodes.CONFLICT).send({
                                error: "Invalid session.",
                            });
                        }

                        const userId = existingSession.id;

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
                ["/signup"]: (database, req, res) => {
                    const { error, value } = this.#createUserSchema.validate(req.body);

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
                        } else {
                            database.prepare("INSERT INTO users (name, identifier) VALUES (?, ?)").run(name, identifier);
                        }

                        res.status(StatusCodes.OK).send({
                            response: "User created successfully"
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

    };

    load() {
        return new Promise((resolve, reject) => {
            try {
                this.server.config = this.#config;
                this.server.bind();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Constructor for the Config class.
     * @constructor
     * @description Create a new instance of the Config class.
     * @param {Server} server - The server instance to bind the configuration to.
     * @memberof Config
     * @returns {Config}
     */
    constructor(server) {
        this.server = server;
    }
}

export default Module;