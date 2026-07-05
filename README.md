# Realtime Kanban

Trello-like board with realtime drag & drop synced across browsers via WebSockets.

## Stack

- **Frontend**: React + Vite + TypeScript + Zustand + dnd-kit
- **Backend**: Node.js + Express + Socket.io + TypeScript
- **Storage**: in-memory (MVP), swappable to Postgres/Mongo

## Structure

```
/server   Express + Socket.io
/client   Vite + React
```

## Dev

```bash
# server
cd server && npm install && npm run dev

# client (new terminal)
cd client && npm install && npm run dev
```

Server on `http://localhost:4000`, client on `http://localhost:5173`.

Open two browsers on the same board URL to see live sync.
