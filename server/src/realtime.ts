import type { Server } from 'socket.io';
import { getSnapshot, getBoard } from './store.js';

let ioRef: Server | null = null;

export function setIo(io: Server) {
  ioRef = io;
}

export async function broadcastMeta(boardId: string) {
  if (!ioRef) return;
  const board = await getBoard(boardId);
  if (board) ioRef.to(boardId).emit('board:meta', board);
}

export async function broadcastMembers(boardId: string) {
  if (!ioRef) return;
  const snap = await getSnapshot(boardId);
  if (snap) ioRef.to(boardId).emit('board:members', snap.members);
}

export async function broadcastFull(boardId: string) {
  if (!ioRef) return;
  const snap = await getSnapshot(boardId);
  if (!snap) return;
  ioRef.to(boardId).emit('board:meta', snap.board);
  ioRef.to(boardId).emit('board:members', snap.members);
}
