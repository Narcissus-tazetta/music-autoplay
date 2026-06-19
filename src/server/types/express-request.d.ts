import type { IncomingHttpHeaders, Server as HttpServer } from 'node:http';
import type { Socket } from 'node:net';

declare module 'express-serve-static-core' {
    interface Application {
        all(path: string, ...handlers: RequestHandler[]): this;
        disable(setting: string): this;
        get(path: string, ...handlers: RequestHandler[]): this;
        listen(port: number, callback?: () => void): HttpServer;
        post(path: string, ...handlers: RequestHandler[]): this;
        use(path: string, ...handlers: RequestHandler[]): this;
        use(...handlers: RequestHandler[]): this;
    }

    interface NextFunction {
        (): void;
    }

    interface RequestHandler {
        (req: Request, res: Response, next: NextFunction): unknown;
    }

    interface Request {
        body?: unknown;
        headers: IncomingHttpHeaders;
        ip?: string;
        method: string;
        params: Record<string, string | undefined>;
        path?: string;
        query: Record<string, string | string[] | undefined>;
        requestId?: string;
        socket: Socket;
        url: string;
    }

    interface Response {
        json(body: unknown): this;
        setHeader(name: string, value: number | string | readonly string[]): this;
        status(code: number): this;
    }
}
