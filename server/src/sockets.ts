import type { Server, Socket } from 'socket.io';
import {
  getSnapshot,
  moveCard,
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  updateColumnTitle,
  updateCard,
  createLabel,
  deleteLabel,
  toggleCardLabel,
  boardIdForColumn,
  boardIdForCard,
  isBoardMember,
} from './store.js';
import { verifyToken } from './auth.js';
import type { CardMovePayload, PresenceUser } from './types.js';

const PRESENCE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

interface RoomState {
  users: Map<string, PresenceUser>;
}

const rooms = new Map<string, RoomState>();

function getRoom(boardId: string): RoomState {
  let r = rooms.get(boardId);
  if (!r) {
    r = { users: new Map() };
    rooms.set(boardId, r);
  }
  return r;
}

function broadcastPresence(io: Server, boardId: string) {
  const room = rooms.get(boardId);
  if (!room) return;
  io.to(boardId).emit('presence:update', [...room.users.values()]);
}

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    username: string;
    boardId?: string;
    user?: PresenceUser;
  };
}

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    const payload = verifyToken(token);
    if (!payload) return next(new Error('invalid token'));
    (socket as AuthedSocket).data.userId = payload.userId;
    (socket as AuthedSocket).data.username = payload.username;
    next();
  });

  io.on('connection', (raw: Socket) => {
    const socket = raw as AuthedSocket;
    console.log(`[socket] connected ${socket.id} user=${socket.data.username}`);

    socket.on('board:join', async ({ boardId }: { boardId: string }, ack?: Function) => {
      if (!boardId) return ack?.({ error: 'boardId required' });
      const member = await isBoardMember(boardId, socket.data.userId);
      if (!member) return ack?.({ error: 'forbidden' });
      const snap = await getSnapshot(boardId);
      if (!snap) return ack?.({ error: 'board not found' });

      if (socket.data.boardId && socket.data.boardId !== boardId) {
        leaveBoard(io, socket, socket.data.boardId);
      }
      socket.join(boardId);
      socket.data.boardId = boardId;
      const color = PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)];
      const user: PresenceUser = {
        socketId: socket.id,
        userId: socket.data.userId,
        name: socket.data.username,
        color,
      };
      socket.data.user = user;
      const room = getRoom(boardId);
      room.users.set(socket.id, user);
      broadcastPresence(io, boardId);
      ack?.({ snapshot: snap, you: user });
    });

    socket.on('card:move', async (payload: CardMovePayload, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      const targetBoardId = await boardIdForColumn(payload.toColumnId);
      const sourceBoardId = await boardIdForCard(payload.cardId);
      if (targetBoardId !== boardId || sourceBoardId !== boardId) {
        return ack?.({ error: 'forbidden' });
      }
      const result = await moveCard(payload.cardId, payload.toColumnId, payload.toIndex);
      if (!result) return ack?.({ error: 'card or column missing' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true });
    });

    socket.on('card:create', async ({ columnId, title }: { columnId: string; title: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      if ((await boardIdForColumn(columnId)) !== boardId) return ack?.({ error: 'forbidden' });
      const trimmed = (title ?? '').trim().slice(0, 200);
      if (!trimmed) return ack?.({ error: 'title required' });
      const card = await createCard(columnId, trimmed);
      if (!card) return ack?.({ error: 'column missing' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true, card });
    });

    socket.on('card:delete', async ({ cardId }: { cardId: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      if ((await boardIdForCard(cardId)) !== boardId) return ack?.({ error: 'forbidden' });
      await deleteCard(cardId);
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true });
    });

    socket.on('card:update', async ({ cardId, title, description }: { cardId: string; title?: string; description?: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      if ((await boardIdForCard(cardId)) !== boardId) return ack?.({ error: 'forbidden' });
      const patch: { title?: string; description?: string } = {};
      if (typeof title === 'string') patch.title = title.trim().slice(0, 200);
      if (typeof description === 'string') patch.description = description.slice(0, 2000);
      const card = await updateCard(cardId, patch);
      if (!card) return ack?.({ error: 'no update' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true, card });
    });

    socket.on('column:create', async ({ title }: { title: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      const trimmed = (title ?? '').trim().slice(0, 80);
      if (!trimmed) return ack?.({ error: 'title required' });
      const col = await createColumn(boardId, trimmed);
      if (!col) return ack?.({ error: 'board missing' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:columns', snap?.columns ?? []);
      ack?.({ ok: true, column: col });
    });

    socket.on('column:update', async ({ columnId, title }: { columnId: string; title: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      if ((await boardIdForColumn(columnId)) !== boardId) return ack?.({ error: 'forbidden' });
      const trimmed = (title ?? '').trim().slice(0, 80);
      if (!trimmed) return ack?.({ error: 'title required' });
      const col = await updateColumnTitle(columnId, trimmed);
      if (!col) return ack?.({ error: 'not found' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:columns', snap?.columns ?? []);
      ack?.({ ok: true, column: col });
    });

    socket.on('column:delete', async ({ columnId }: { columnId: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      if ((await boardIdForColumn(columnId)) !== boardId) return ack?.({ error: 'forbidden' });
      const removed = await deleteColumn(columnId);
      if (!removed) return ack?.({ error: 'not found' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:columns', snap?.columns ?? []);
      io.to(boardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true });
    });

    socket.on('label:create', async ({ name, color }: { name: string; color: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      const n = (name ?? '').trim().slice(0, 40);
      const c = (color ?? '').trim().slice(0, 20);
      if (!n || !c) return ack?.({ error: 'name/color required' });
      const label = await createLabel(boardId, n, c);
      if (!label) return ack?.({ error: 'board missing' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:labels', snap?.labels ?? []);
      ack?.({ ok: true, label });
    });

    socket.on('label:delete', async ({ labelId }: { labelId: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      const owner = await deleteLabel(labelId);
      if (owner !== boardId) return ack?.({ error: 'forbidden' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:labels', snap?.labels ?? []);
      io.to(boardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true });
    });

    socket.on('card:label:toggle', async ({ cardId, labelId }: { cardId: string; labelId: string }, ack?: Function) => {
      const boardId = socket.data.boardId;
      if (!boardId) return ack?.({ error: 'not in board' });
      const result = await toggleCardLabel(cardId, labelId);
      if (!result || result.boardId !== boardId) return ack?.({ error: 'forbidden' });
      const snap = await getSnapshot(boardId);
      io.to(boardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true, attached: result.attached });
    });

    socket.on('cursor:move', ({ x, y }: { x: number; y: number }) => {
      const boardId = socket.data.boardId;
      if (!boardId) return;
      socket.to(boardId).emit('cursor:update', { socketId: socket.id, x, y });
    });

    socket.on('disconnect', () => {
      if (socket.data.boardId) leaveBoard(io, socket, socket.data.boardId);
      console.log(`[socket] disconnected ${socket.id}`);
    });
  });
}

function leaveBoard(io: Server, socket: AuthedSocket, boardId: string) {
  const room = rooms.get(boardId);
  if (!room) return;
  room.users.delete(socket.id);
  socket.leave(boardId);
  socket.to(boardId).emit('cursor:leave', { socketId: socket.id });
  broadcastPresence(io, boardId);
  if (room.users.size === 0) rooms.delete(boardId);
}
