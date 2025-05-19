import { createRequestHandler } from '@react-router/express';
import compression from 'compression';
import express from 'express';
import morgan from 'morgan';
import { Server } from 'socket.io';

const viteDevServer = process.env.NODE_ENV === 'production'
    ? undefined
    : await import('vite').then(vite =>
        vite.createServer({
            server: { middlewareMode: true },
        })
    );
const reactRouterHandler = createRequestHandler({
    build: viteDevServer
        ? () => viteDevServer.ssrLoadModule('virtual:react-router/server-build')
        // @ts-expect-error
        : await import('./build/server/index.js'),
});

const port = process.env.PORT || 5173;
const app = express();
const server = app.listen(port, () => {
    console.log(`Server is running at ${port}`);
});

app.use(compression());
app.disable('x-powered-by');

if (viteDevServer) app.use(viteDevServer.middlewares);
else {
    app.use(
        '/assets',
        express.static('build/client/assets', { immutable: true, maxAge: '1y' }),
    );
}

app.use(express.static('build/client', { maxAge: '1h' }));
app.use(morgan('tiny'));

app.all('*splat', reactRouterHandler);

const io = new Server(server);

io.on('connection', socket => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});
