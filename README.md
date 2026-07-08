# Realtime Kanban

A collaborative kanban board built to demonstrate mastery of two areas most junior engineers skip: **real-time synchronization** and **complex frontend state**.

Every action — dragging a card, editing a title, attaching a label, changing a role — is synchronized live across every browser open on the same board, with no polling and no refresh. Backed by PostgreSQL, guarded by JWT auth, and delivered through a modern, keyboard-friendly UI.

---

## Table of contents

1. [Highlights](#highlights)
2. [Stack](#stack)
3. [Getting started](#getting-started)
4. [Environment](#environment)
5. [Architecture](#architecture)
6. [Feature reference](#feature-reference)
7. [Keyboard shortcuts](#keyboard-shortcuts)
8. [REST API](#rest-api)
9. [Socket events](#socket-events)
10. [Database schema](#database-schema)
11. [Repository layout](#repository-layout)
12. [Development workflow](#development-workflow)
13. [Roadmap](#roadmap)
14. [License](#license)

---

## Highlights

- **Live everything**. Card moves, column reorders, labels, assignees, board settings, and member changes are broadcast to all connected clients through Socket.io rooms.
- **Authenticated multi-user**. Register with email + username, log in with either, backed by bcrypt password hashing and JWT session tokens.
- **Role-based access**. Every board has an owner, members, and read-only viewers. Server-side gates enforce every mutation; client hides destructive controls when the role does not permit them.
- **Shareable invite links**. Owners generate signed invite tokens; recipients auto-join after signing in. Public boards expose a `/view/:token` read-only route that works without an account.
- **Rich cards**. Colors, labels, assignees, dedicated link attachments (with add form and clickable list), description, and a per-card activity timeline.
- **Board personalization**. Owners choose from gradient, solid, or uploaded PNG backgrounds and flip visibility between private and public.
- **User personalization**. `/settings` page for display name, avatar color, and default board background.
- **Search & filters that scale**. Dashboard search across boards; per-board card filter with text, label pills or dropdown (auto-collapsed past 10 labels), and assignee avatars or dropdown (past 10 members).
- **Keyboard-first**. Global shortcuts on the board (search, add card, add column, help overlay). Enter submits every add form. Description textarea keeps native newline behavior.
- **WebSocket-only transport**. Explicit `transports: ['websocket']` on both ends, 25 s ping interval, 30 s timeout — no more `xhr poll error` flapping.
- **Presence + live cursors**. Colored avatar bar of everyone currently on the board, Figma-style remote cursors.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Zustand, `@dnd-kit`, React Router, `socket.io-client` |
| Backend | Node.js 20+, Express 4, Socket.io 4, TypeScript (ESM), Zod for input validation |
| Database | PostgreSQL 16 (via Docker Compose), `pg` driver, startup migrations |
| Auth | JSON Web Tokens (7-day sessions, 30-day invite tokens), `bcryptjs` password hashing |
| Tooling | `tsx watch` (server dev), Vite HMR (client), Docker Compose (database) |

---

## Getting started

**Prerequisites.** Node.js 20 or newer, Docker (or a local PostgreSQL 16), and npm.

```bash
# 1. Database
docker compose up -d

# 2. Server
cd server
cp .env.example .env      # optional: change JWT_SECRET for anything non-dev
npm install
npm run dev               # http://localhost:4000

# 3. Client
cd ../client
npm install
npm run dev               # http://localhost:5173
```

Open <http://localhost:5173>, create an account, create a board, then open the same URL in a second browser (or an incognito window with a second account) to see everything sync live.

Startup migrations run automatically the first time the server connects to a fresh database. Subsequent restarts are no-ops.

---

## Environment

### Server (`server/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | HTTP + WebSocket port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS + Socket.io allowed origin |
| `DATABASE_URL` | `postgres://kanban:kanban@localhost:5432/kanban` | PostgreSQL connection string |
| `JWT_SECRET` | `dev-secret-change-me` | Signing key for session and invite tokens. **Change in production.** |

### Client (`client/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:4000` | Base URL for REST and WebSocket |

---

## Architecture

```
┌────────────┐        WebSocket (rooms)         ┌────────────┐
│  Client A  │ ◄──────────────────────────────► │            │
├────────────┤                                  │  Express   │
│  Zustand   │        JWT-auth REST             │  + Socket  │◄──► PostgreSQL
│  store     │ ◄──────────────────────────────► │  handlers  │
└────────────┘                                  └────────────┘
      ▲                                                ▲
      │                                                │
      │      board:cards / board:columns / …           │
      └────────────────── broadcasts ──────────────────┘
```

**Optimistic updates.** Drag-and-drop applies the reorder locally the moment the drop lands, then reconciles once the server broadcast comes back. The server owns the canonical order.

**Rooms.** Every board has its own Socket.io room (`socket.join(boardId)`). Broadcasts stay scoped: presence, cursors, mutations, member updates.

**REST-then-broadcast.** Mutations that go through REST (board settings, member role changes, invite acceptance) push their result back into the socket room via a shared `realtime.ts` helper so every viewer sees the change without refreshing.

**Reconnect.** On `connect`, the client re-emits `board:join` and replaces its local state with a fresh snapshot. A visible banner shows the reconnecting state; disconnect never leaves the UI in an inconsistent state.

---

## Feature reference

### Boards, columns, cards
- Create, rename, delete boards, columns, and cards
- Drag cards inside a column or across columns
- Drag columns to reorder them
- Per-card color, description, labels, assignees, and link attachments
- Card activity log records every mutation with the actor and timestamp
- Cards are permalinkable via `?c=<cardId>` in the board URL

### Labels
- Default palette on board creation (`Bug`, `Feature`, `Urgent`, `Idea`)
- Create, color-pick, and delete labels from the card modal
- Filter cards by label; the filter collapses into a searchable dropdown past 10 labels

### Members and roles
- `owner` — full control, board deletion, visibility, member management
- `member` — read + write on cards, columns, labels
- `viewer` — read-only, banner shown, mutations rejected server-side
- Owner-only Members panel in board settings: list, role dropdown, remove
- Removed members receive a banner explaining they lost access

### Sharing
- Owner generates a signed invite link (30-day JWT), copies from a popover
- `/join/:token` accepts the invite when the recipient signs in (auto-redirect after login)
- Public boards additionally expose `/view/:token` — read-only, no account required

### Personalization
- `/settings` — display name, avatar color, default board background
- Board settings — gradient, solid color, or uploaded PNG background; visibility toggle
- Backgrounds are stored as raw CSS values (gradient, hex, or `url(data:image/png;base64,…)`), served with a `cover` fit

### Search and filters
- Dashboard: text search + all/owned/shared filter over board tiles
- Board: text search across card titles and descriptions
- Label pills (or dropdown past 10 labels) filter cards
- Assignee avatars (or dropdown past 10 members) filter cards
- `Clear` button resets every active filter at once

### Presence and cursors
- Colored avatar bar shows everyone currently on the board
- Figma-style remote cursors driven by `requestAnimationFrame`-batched `cursor:move` events
- Reconnect banner + graceful state re-sync

---

## Keyboard shortcuts

Available anywhere on the board page while no input is focused.

| Key | Action |
| --- | --- |
| <kbd>/</kbd> | Focus the card search bar |
| <kbd>N</kbd> | Start adding a card in the first column |
| <kbd>C</kbd> | Start adding a new column |
| <kbd>?</kbd> | Show or hide the shortcuts overlay |
| <kbd>Esc</kbd> | Close the overlay, the card modal, or an open popover |

`Enter` submits every add form (new board, new column, new card, invite, label, link), title rename inline edits, and the profile form. The description textarea keeps native `Enter` behavior for newlines.

---

## REST API

All endpoints live under `/api`. Auth-guarded routes require `Authorization: Bearer <jwt>`.

### Auth
- `POST /auth/register` — `{ email, username, password }` → `{ user, token }`
- `POST /auth/login` — `{ identifier, password }` → `{ user, token }`
- `GET  /auth/me` — the authenticated user
- `PATCH /auth/me` — `{ displayName?, avatarColor?, background? }`

### Boards
- `GET    /boards` — boards the user is a member of
- `POST   /boards` — `{ title }`; seeds three columns and four default labels
- `GET    /boards/:id` — board metadata (403 if not a member)
- `GET    /boards/:id/snapshot` — full board snapshot
- `PATCH  /boards/:id` — `{ background?, visibility? }` (owner only)
- `DELETE /boards/:id` — owner only; cascades to columns, cards, labels, memberships

### Members
- `PATCH  /boards/:id/members/:userId` — `{ role: 'member' | 'viewer' }` (owner only)
- `DELETE /boards/:id/members/:userId` — owner only

### Invites
- `POST /boards/:id/invite-link` — owner only; returns `{ token, url }`
- `POST /invites/accept` — `{ token }`; adds the caller as a member

### Public
- `GET /public/boards/:token/snapshot` — read-only snapshot when the board has `visibility=public`

### Health
- `GET /health` — `{ ok: true }`

---

## Socket events

| Event | Direction | Payload | Notes |
| --- | --- | --- | --- |
| `board:join` | client → server | `{ boardId }` | Ack: `{ snapshot, you, role } \| { error }` |
| `board:refresh` | client → server | `{}` | Ack + broadcasts `board:meta` and `board:members` |
| `card:move` | client → server | `{ cardId, toColumnId, toIndex }` | Runs inside a transaction |
| `card:create` / `card:update` / `card:delete` | client → server | see rest.ts | Broadcasts `board:cards` + card activity |
| `card:assignee:toggle` | client → server | `{ cardId, userId }` | Requires target to be a board member |
| `card:label:toggle` | client → server | `{ cardId, labelId }` | |
| `card:link:add` / `card:link:remove` | client → server | see sockets.ts | Broadcasts `board:cards` |
| `card:events:list` | client → server | `{ cardId }` | Ack returns the activity log |
| `column:create` / `column:update` / `column:move` / `column:delete` | client → server | see sockets.ts | Broadcasts `board:columns` |
| `label:create` / `label:delete` | client → server | see sockets.ts | Broadcasts `board:labels` |
| `cursor:move` | client → server | `{ x, y }` | Rate-limited to `requestAnimationFrame` |
| `board:cards` | server → room | `Card[]` | After any card mutation |
| `board:columns` | server → room | `Column[]` | After any column mutation |
| `board:labels` | server → room | `Label[]` | After any label mutation |
| `board:members` | server → room | `BoardMember[]` | After role change, kick, join, or invite acceptance |
| `board:meta` | server → room | `Board` | After background / visibility change |
| `card:events` | server → room | `{ cardId, events }` | After each card mutation |
| `presence:update` | server → room | `PresenceUser[]` | On join or leave |
| `cursor:update` / `cursor:leave` | server → room | `{ socketId, x, y }` / `{ socketId }` | |

Every REST mutation that affects a board pushes its result into the socket room via `server/src/realtime.ts`, so no viewer ever sees stale data without refreshing.

---

## Database schema

Defined in `server/db/init/001_schema.sql` plus additive startup migrations in `server/src/db.ts`.

| Table | Notable columns |
| --- | --- |
| `users` | `email` (unique), `username` (unique), `password_hash`, `display_name`, `avatar_color`, `background` |
| `boards` | `owner_id`, `background`, `visibility` (`private` \| `public`) |
| `board_members` | `board_id`, `user_id`, `role` (`owner` \| `member` \| `viewer`) |
| `columns` | `board_id`, `title`, `order` |
| `cards` | `column_id`, `title`, `description`, `order`, `color` |
| `card_labels` | `card_id`, `label_id` |
| `card_assignees` | `card_id`, `user_id` |
| `card_links` | `card_id`, `url`, `title`, `position` |
| `card_events` | `card_id`, `board_id`, `user_id`, `kind`, `meta`, `created_at` |
| `labels` | `board_id`, `name`, `color` |
| `schema_migrations` | `name` (unique) — tracks applied startup migrations |

All foreign keys use `ON DELETE CASCADE` so removing a board wipes columns, cards, labels, memberships, activity events, and card links in one operation.

---

## Repository layout

```
.
├── client/
│   └── src/
│       ├── pages/          Login, Register, Join, View, BoardList, Board, Settings
│       ├── components/     BoardView, ColumnView, CardView, CardModal,
│       │                   BoardHeader, BoardSettings, PresenceBar,
│       │                   RemoteCursors, ShortcutsOverlay,
│       │                   LabelFilterDropdown, MemberFilterDropdown
│       ├── hooks/          useBoardSocket
│       ├── utils/          boardColor, autolink
│       ├── store.ts        Zustand board state
│       ├── authStore.ts    JWT + user store
│       ├── api.ts          REST client with typed helpers
│       └── socket.ts       Socket.io client factory (WebSocket only)
├── server/
│   ├── src/
│   │   ├── index.ts        HTTP + Socket.io bootstrap
│   │   ├── rest.ts         Express routes
│   │   ├── sockets.ts      Socket.io handlers
│   │   ├── store.ts        Postgres data access (transactional moves)
│   │   ├── auth.ts         Register, login, JWT helpers, invite tokens
│   │   ├── realtime.ts     Shared io reference used by REST for broadcasts
│   │   ├── db.ts           pg Pool, startup migrations, tx helper
│   │   ├── config.ts       Environment variables
│   │   └── types.ts
│   ├── db/init/            SQL executed on first container start
│   └── .env.example
├── docker-compose.yml      PostgreSQL 16 service
└── README.md
```

---

## Development workflow

- **Branch per feature.** History is organized into `feat/*` branches: `feat/postgres-auth`, `feat/card-features`, `feat/user-settings`, `feat/board-settings`, `feat/search-filters`, `feat/card-color-board-image`, `feat/card-links`, `feat/team-roles`, `feat/ui-polish-links-upload`, `feat/keyboard-shortcuts`.
- **Commit style.** Conventional Commits, imperative subject, terse body explaining the *why* when it isn't obvious.
- **Type-safety end to end.** `types.ts` is duplicated between server and client so REST payloads and socket events stay strongly typed on both sides.
- **Migrations.** Additive only, name-keyed, tracked in `schema_migrations`. To ship a schema change, append to the `MIGRATIONS` array in `server/src/db.ts` with a new unique name.

---

## Roadmap

- Undo / redo synchronized across clients
- Reorderable card link list via drag-and-drop
- Email-based invites for recipients without an account
- Deployment: Vercel (frontend) + Railway or Fly.io (backend — WebSockets need a persistent process, not serverless)
- Storage-backed image uploads (S3 or similar) instead of inline data URLs
- Card comments and mentions

---

## License

MIT
