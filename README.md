# Realtime Kanban

A modern, Trello-like collaborative board where every action — dragging a card, creating a column, editing a title, adding a label — is synchronized live across every browser open on the same board. No refresh. No polling. WebSockets only.

Built to showcase mastery of two areas most junior candidates skip:

- **Real-time synchronization** (Socket.io rooms, optimistic UI, reconciliation)
- **Complex frontend state** (Zustand store, drag & drop with `dnd-kit`, remote cursors)

Backed by PostgreSQL with a clean auth layer (JWT + bcrypt) so multiple users can register, sign in, and collaborate on their own boards.

---

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Zustand, `@dnd-kit`, `socket.io-client`, React Router |
| Backend | Node.js, Express, Socket.io, TypeScript (ESM), Zod for input validation |
| Database | PostgreSQL 16 (via Docker Compose), `pg` driver, transactional writes |
| Auth | JSON Web Tokens (7-day TTL), `bcryptjs` password hashing |

---

## Features

### Core

- **Accounts**: register with email + username + password, log in with either email or username
- **Boards, columns, cards CRUD** — all persisted in Postgres
- **Live drag & drop** of cards inside a column and across columns, broadcast to every connected client
- **Optimistic UI**: the local state is updated instantly, then reconciled against the server broadcast
- **Presence bar**: colored avatars for everyone currently viewing the board
- **Live remote cursors** (Figma-style) with per-user color and name
- **Auto-reconnect**: on connection loss, a banner shows the reconnecting state and a fresh snapshot is pulled once the socket is back
- **Server-authoritative permissions**: every socket event is re-checked against board membership on the server

### Boards you can actually use

- **Labels**: create, color-pick, attach/detach on cards, delete from the board — synced live
- **Card details modal**: full title, description, label management, deletion
- **Column management**: create, delete
- **Members**: the board owner can invite any registered user by username; every member gets access via socket
- **Delete a board** (owner only) — cascades cleanly to columns, cards, labels, memberships

### Realtime plumbing

- Socket.io **rooms per board** (`socket.join(boardId)`) so broadcasts stay scoped
- Every client mutation is emitted with an `ack` so the caller knows whether the write stuck
- Full board snapshot is re-sent on reconnect; per-mutation broadcasts carry just the affected resource (`board:cards`, `board:columns`, `board:labels`, `presence:update`)
- Server is the source of truth for card order; clients apply the broadcast payload as-is

---

## Repository layout

```
.
├── client/            Vite + React frontend
│   └── src/
│       ├── pages/     Login, Register, BoardList, Board
│       ├── components/ BoardView, ColumnView, CardView, CardModal, PresenceBar, RemoteCursors, BoardHeader
│       ├── hooks/     useBoardSocket
│       ├── store.ts   Zustand board state
│       ├── authStore.ts
│       └── api.ts     REST client
├── server/
│   ├── src/
│   │   ├── index.ts   HTTP + Socket.io bootstrap
│   │   ├── rest.ts    Express routes (auth, boards, members)
│   │   ├── sockets.ts Socket.io event handlers
│   │   ├── store.ts   Postgres data access (transactions for moves + board creation)
│   │   ├── auth.ts    Register, login, JWT signing/verification, middleware
│   │   ├── db.ts      pg Pool, tx helper, waitForDb
│   │   ├── config.ts  Environment variables
│   │   └── types.ts
│   ├── db/init/       SQL schema loaded on first container start
│   └── .env.example
├── docker-compose.yml PostgreSQL service
└── README.md
```

---

## Getting started

You need Node.js 20+ and Docker (or a local Postgres 16 instance).

### 1. Start the database

```bash
docker compose up -d
```

This starts a `postgres:16-alpine` container on port `5432` with the following credentials (matching `server/.env.example`):

```
user:     kanban
password: kanban
database: kanban
```

The schema in `server/db/init/001_schema.sql` is executed automatically the first time the container starts.

### 2. Start the API server

```bash
cd server
cp .env.example .env    # then edit JWT_SECRET for anything non-dev
npm install
npm run dev             # http://localhost:4000
```

### 3. Start the frontend

```bash
cd client
npm install
npm run dev             # http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173), create an account, create a board, and then open the same board URL in a second browser (or an incognito window with a second account) to watch the live sync in action.

---

## Environment variables

**Server** (`server/.env`):

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | HTTP + WebSocket port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS + Socket.io allowed origin |
| `DATABASE_URL` | `postgres://kanban:kanban@localhost:5432/kanban` | Postgres connection string |
| `JWT_SECRET` | `dev-secret-change-me` | Signing key for JWTs. **Change this in production.** |

**Client** (`client/.env`):

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:4000` | Base URL for both REST and WebSocket |

---

## Realtime architecture

```
Client A ──drag card──▶ socket.io-client ──emit('card:move')──▶ Server
                                                                  │
                                                                  ▼
                                                     Postgres transaction
                                                     (reorder both columns)
                                                                  │
                                                                  ▼
                                    io.to(boardId).emit('board:cards', ...)
                                                                  │
                                                                  ▼
                                            Every client in the room
                                            replaces its cards[] state
```

- **Rooms**: `socket.join(boardId)` scopes broadcasts to a single board
- **Optimistic move**: the dragging client updates its Zustand `cards` locally *before* the server responds; the server broadcast then reconciles any race
- **Server authority**: card order is computed server-side inside a Postgres transaction that `SELECT ... FOR UPDATE` locks the moving card; clients never override it
- **Reconnect flow**: on `connect`, the client re-emits `board:join`; the ack returns a fresh `BoardSnapshot` that replaces local state wholesale

---

## Socket events

| Event | Direction | Payload | Notes |
| --- | --- | --- | --- |
| `board:join` | client → server | `{ boardId }` | Ack: `{ snapshot, you } \| { error }`. Server checks membership. |
| `card:move` | client → server | `{ cardId, toColumnId, toIndex }` | Runs in a transaction. |
| `card:create` | client → server | `{ columnId, title }` | |
| `card:update` | client → server | `{ cardId, title?, description? }` | |
| `card:delete` | client → server | `{ cardId }` | |
| `column:create` | client → server | `{ title }` | |
| `column:delete` | client → server | `{ columnId }` | |
| `label:create` | client → server | `{ name, color }` | |
| `label:delete` | client → server | `{ labelId }` | |
| `card:label:toggle` | client → server | `{ cardId, labelId }` | |
| `cursor:move` | client → server | `{ x, y }` | Rate-limited to `requestAnimationFrame` client-side. |
| `board:cards` | server → room | `Card[]` | Broadcast after any card mutation. |
| `board:columns` | server → room | `Column[]` | |
| `board:labels` | server → room | `Label[]` | |
| `presence:update` | server → room | `PresenceUser[]` | |
| `cursor:update` | server → room | `{ socketId, x, y }` | |
| `cursor:leave` | server → room | `{ socketId }` | |

---

## REST endpoints

All endpoints under `/api`. Auth-guarded routes require `Authorization: Bearer <jwt>`.

### Auth (public)

- `POST /auth/register` — `{ email, username, password }` → `{ user, token }`
- `POST /auth/login` — `{ identifier, password }` (identifier = email or username) → `{ user, token }`
- `GET  /auth/me` — returns the authenticated user

### Boards (auth required)

- `GET    /boards` — boards the user is a member of
- `POST   /boards` — `{ title }` — also seeds three columns (`To Do`, `In Progress`, `Done`) and four default labels
- `GET    /boards/:id` — board metadata (403 if not a member)
- `GET    /boards/:id/snapshot` — full board state (columns, cards, labels, members)
- `DELETE /boards/:id` — owner only; cascades to everything below
- `POST   /boards/:id/members` — owner only; `{ username }` → adds a member

### Health

- `GET /health` — `{ ok: true }`

---

## Database schema

Defined in `server/db/init/001_schema.sql`:

- `users` — id, email (unique), username (unique), password_hash, created_at
- `boards` — id, title, owner_id, created_at
- `board_members` — board_id, user_id, role (`owner` | `member`), added_at
- `columns` — id, board_id, title, order
- `cards` — id, column_id, title, description, order, created_at
- `labels` — id, board_id, name, color
- `card_labels` — card_id, label_id (many-to-many)

All foreign keys `ON DELETE CASCADE` so deleting a board wipes its columns → cards → card_labels, plus its labels and memberships, in one shot.

---

## Multi-user demo

1. Register two accounts (open a second browser or use an incognito window).
2. Account A creates a board and copies the URL.
3. Account A invites account B by username via the header **+ Invite** button.
4. Account B navigates to the same board URL — both accounts now show up in the presence bar.
5. Drag a card in one window and watch it move in the other; the remote cursor floats around as you mouse.

---

## Roadmap

- Undo / redo synced across clients
- Card activity log (who moved what, when)
- Reorderable columns via drag & drop
- Deployment: Vercel (frontend) + Railway or Fly.io (backend — WebSockets need a persistent process, not serverless)
- Email invites for users who don't have an account yet

## License

MIT
