import type { Server, Socket } from 'socket.io';
import {
  getSnapshot,
  moveCard,
  createCard,
  createColumn,
  deleteCard,
  boardIdForColumn,
  boardIdForCard,
} from './store.js';
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

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    let joinedBoardId: string | null = null;
    let user: PresenceUser | null = null;

    console.log(`[socket] connected ${socket.id}`);

    socket.on('board:join', ({ boardId, name }: { boardId: string; name?: string }, ack?: Function) => {
      const snap = getSnapshot(boardId);
      if (!snap) {
        ack?.({ error: 'board not found' });
        return;
      }
      if (joinedBoardId && joinedBoardId !== boardId) {
        leaveBoard(io, socket, joinedBoardId, user);
      }
      socket.join(boardId);
      joinedBoardId = boardId;
      const color = PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)];
      user = {
        socketId: socket.id,
        name: (name?.trim() || `User-${socket.id.slice(0, 4)}`).slice(0, 24),
        color,
      };
      const room = getRoom(boardId);
      room.users.set(socket.id, user);
      broadcastPresence(io, boardId);
      ack?.({ snapshot: snap, you: user });
      console.log(`[socket] ${socket.id} joined ${boardId} as ${user.name}`);
    });

    socket.on('card:move', (payload: CardMovePayload, ack?: Function) => {
      if (!joinedBoardId) return ack?.({ error: 'not in board' });
      const targetBoardId = boardIdForColumn(payload.toColumnId);
      const sourceBoardId = boardIdForCard(payload.cardId);
      if (targetBoardId !== joinedBoardId || sourceBoardId !== joinedBoardId) {
        return ack?.({ error: 'forbidden' });
      }
      const card = moveCard(payload.cardId, payload.toColumnId, payload.toIndex);
      if (!card) return ack?.({ error: 'card or column missing' });
      const snap = getSnapshot(joinedBoardId);
      io.to(joinedBoardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true });
      console.log(`[socket] card ${payload.cardId} moved by ${socket.id}`);
    });

    socket.on('card:create', ({ columnId, title }: { columnId: string; title: string }, ack?: Function) => {
      if (!joinedBoardId) return ack?.({ error: 'not in board' });
      if (boardIdForColumn(columnId) !== joinedBoardId) return ack?.({ error: 'forbidden' });
      const trimmed = (title ?? '').trim();
      if (!trimmed) return ack?.({ error: 'title required' });
      const card = createCard(columnId, trimmed);
      if (!card) return ack?.({ error: 'column missing' });
      const snap = getSnapshot(joinedBoardId);
      io.to(joinedBoardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true, card });
    });

    socket.on('card:delete', ({ cardId }: { cardId: string }, ack?: Function) => {
      if (!joinedBoardId) return ack?.({ error: 'not in board' });
      if (boardIdForCard(cardId) !== joinedBoardId) return ack?.({ error: 'forbidden' });
      deleteCard(cardId);
      const snap = getSnapshot(joinedBoardId);
      io.to(joinedBoardId).emit('board:cards', snap?.cards ?? []);
      ack?.({ ok: true });
    });

    socket.on('column:create', ({ title }: { title: string }, ack?: Function) => {
      if (!joinedBoardId) return ack?.({ error: 'not in board' });
      const trimmed = (title ?? '').trim();
      if (!trimmed) return ack?.({ error: 'title required' });
      const col = createColumn(joinedBoardId, trimmed);
      if (!col) return ack?.({ error: 'board missing' });
      const snap = getSnapshot(joinedBoardId);
      io.to(joinedBoardId).emit('board:columns', snap?.columns ?? []);
      ack?.({ ok: true, column: col });
    });

    socket.on('cursor:move', ({ x, y }: { x: number; y: number }) => {
      if (!joinedBoardId || !user) return;
      socket.to(joinedBoardId).emit('cursor:update', { socketId: socket.id, x, y });
    });

    socket.on('disconnect', () => {
      if (joinedBoardId) leaveBoard(io, socket, joinedBoardId, user);
      console.log(`[socket] disconnected ${socket.id}`);
    });
  });
}

function leaveBoard(io: Server, socket: Socket, boardId: string, user: PresenceUser | null) {
  const room = rooms.get(boardId);
  if (!room) return;
  room.users.delete(socket.id);
  socket.leave(boardId);
  socket.to(boardId).emit('cursor:leave', { socketId: socket.id });
  broadcastPresence(io, boardId);
  if (room.users.size === 0) rooms.delete(boardId);
}
