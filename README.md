# Realtime Kanban

A Trello-like board where drag & drop, card creation, and presence are synchronized live across every browser open on the same board — no refresh, no polling. WebSockets only.

Built to showcase mastery of real-time synchronization and complex frontend state, both areas most junior candidates skip.

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Zustand + dnd-kit + socket.io-client
- **Backend**: Node.js + Express + Socket.io + TypeScript (ESM)
- **Storage**: in-memory (swappable to Postgres / Mongo)

## Features

- Boards, columns, cards CRUD
- Drag & drop cards inside and across columns, synced in real time to every connected client
- Optimistic UI: the drag is applied instantly locally, then reconciled with the server
- Presence bar: colored avatars for every user currently on the board
- Live remote cursors (Figma-style)
- Editable display name (persisted in `localStorage`)
- Auto-reconnect on connection loss with a visible banner and clean state re-sync
- Server-authoritative board & column ownership checks on every socket event

## Repo layout

```
/server   Express + Socket.io API
/client   Vite + React frontend
```

## Getting started

```bash
# Terminal 1 — server
cd server
npm install
npm run dev          # http://localhost:4000

# Terminal 2 — client
cd client
npm install
npm run dev          # http://localhost:5173
```

Then open [http://localhost:5173](http://localhost:5173), create a board, and open the same board URL in a second browser to see live sync.

### Environment

`client/.env.example`:

```
VITE_API_URL=http://localhost:4000
```

Server env vars:

- `PORT` (default `4000`)
- `CLIENT_ORIGIN` (default `http://localhost:5173`) — CORS + Socket.io origin

## Realtime architecture

```
Client A --drag card--> Socket.io client --emit('card:move')--> Server
Server --broadcast('board:cards', cards)--> everyone in room boardId
Every client updates local Zustand state without a full re-fetch
```

- Socket.io **rooms** per board (`socket.join(boardId)`)
- Every mutation emits an `ack` so the client knows whether the optimistic update stuck
- The server is the source of truth for card order — clients apply the broadcast payload as-is
- Reconnect: on `connect`, the client re-emits `board:join` and replaces state with the server snapshot

## Socket events

| Event | Direction | Payload |
| --- | --- | --- |
| `board:join` | client → server | `{ boardId, name }` — ack returns `{ snapshot, you }` |
| `board:cards` | server → room | `Card[]` — full ordered list for the board |
| `board:columns` | server → room | `Column[]` |
| `presence:update` | server → room | `PresenceUser[]` |
| `cursor:move` | client → server | `{ x, y }` |
| `cursor:update` | server → room | `{ socketId, x, y }` |
| `cursor:leave` | server → room | `{ socketId }` |
| `card:move` | client → server | `{ cardId, toColumnId, toIndex }` |
| `card:create` | client → server | `{ columnId, title }` |
| `card:delete` | client → server | `{ cardId }` |
| `column:create` | client → server | `{ title }` |

## REST endpoints

- `GET  /api/health`
- `GET  /api/boards`
- `POST /api/boards` `{ title }`
- `GET  /api/boards/:id`
- `GET  /api/boards/:id/snapshot`
- `POST /api/boards/:id/columns` `{ title }`
- `POST /api/columns/:id/cards` `{ title }`

## Roadmap

- Persistent storage (Postgres)
- Auth
- Card details modal, comments, labels
- Undo / redo synced across clients
- Deployment: Vercel (front) + Railway (back — WebSockets require a persistent process)

## License

MIT
