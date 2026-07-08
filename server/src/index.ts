import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { rest } from './rest.js';
import { registerSocketHandlers } from './sockets.js';
import { config } from './config.js';
import { waitForDb, pool, runMigrations } from './db.js';

async function main() {
  console.log(`[server] waiting for database…`);
  await waitForDb();
  await runMigrations();
  console.log(`[server] database ready`);

  const app = express();
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json());
  app.use('/api', rest);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.clientOrigin, methods: ['GET', 'POST'] },
  });
  registerSocketHandlers(io);

  server.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
    console.log(`[server] CORS origin: ${config.clientOrigin}`);
  });

  const shutdown = async (sig: string) => {
    console.log(`\n[server] ${sig} — shutting down`);
    server.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  console.error('[server] fatal', e);
  process.exit(1);
});
