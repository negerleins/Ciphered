export default Config;
declare class Config {
    endpoints: {
        get: {
            "/": (_: any, req: any, res: any) => any;
        };
        post: {
            "/send": (database: any, req: any, res: any) => any;
            "/receive": (database: any, req: any, res: any) => any;
            "/user": (database: any, req: any, res: any) => any;
            "/claim": (database: any, req: any, res: any) => any;
            "/invite": (database: any, req: any, res: any) => any;
            "/create": (database: any, req: any, res: any) => any;
        };
    };
    callback: (req: any, res: any) => void;
    middleware: (_: any, res: any) => void;
    limiter: {
        windowMs: number;
        limit: number;
        standardHeaders: string;
        legacyHeaders: boolean;
        message: string;
        handler: (req: any, res: any, next: any, options: any) => any;
        keyGenerator: (req: any) => any;
    };
    #private;
}
