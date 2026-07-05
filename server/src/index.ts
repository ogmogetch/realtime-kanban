import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { rest } from './rest.js';
import { registerSocketHandlers } from './sockets.js';

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
app.use('/api', rest);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});
registerSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] CORS origin: ${CLIENT_ORIGIN}`);
});
