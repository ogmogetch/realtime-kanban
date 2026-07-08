import 'node:process';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://kanban:kanban@localhost:5432/kanban',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
};
