import type { Server } from 'socket.io';

export function setupSocketHandlers(io: Server) {
    io.on('connection', socket => {
        console.info(`🔌 New client connected: ${socket.id}`);
    });
}
