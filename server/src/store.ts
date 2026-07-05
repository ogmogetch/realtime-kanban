import { nanoid } from 'nanoid';
import type { Board, Column, Card, BoardSnapshot } from './types.js';

const boards = new Map<string, Board>();
const columns = new Map<string, Column>();
const cards = new Map<string, Card>();

export function createBoard(title: string): Board {
  const board: Board = { id: nanoid(10), title, createdAt: Date.now() };
  boards.set(board.id, board);
  const seedTitles = ['To Do', 'In Progress', 'Done'];
  seedTitles.forEach((t, i) => {
    const col: Column = { id: nanoid(10), boardId: board.id, title: t, order: i };
    columns.set(col.id, col);
  });
  return board;
}

export function getBoard(boardId: string): Board | undefined {
  return boards.get(boardId);
}

export function listBoards(): Board[] {
  return [...boards.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getSnapshot(boardId: string): BoardSnapshot | null {
  const board = boards.get(boardId);
  if (!board) return null;
  const boardColumns = [...columns.values()]
    .filter((c) => c.boardId === boardId)
    .sort((a, b) => a.order - b.order);
  const columnIds = new Set(boardColumns.map((c) => c.id));
  const boardCards = [...cards.values()]
    .filter((c) => columnIds.has(c.columnId))
    .sort((a, b) => a.order - b.order);
  return { board, columns: boardColumns, cards: boardCards };
}

export function createColumn(boardId: string, title: string): Column | null {
  if (!boards.has(boardId)) return null;
  const order = [...columns.values()].filter((c) => c.boardId === boardId).length;
  const col: Column = { id: nanoid(10), boardId, title, order };
  columns.set(col.id, col);
  return col;
}

export function createCard(columnId: string, title: string): Card | null {
  if (!columns.has(columnId)) return null;
  const order = [...cards.values()].filter((c) => c.columnId === columnId).length;
  const card: Card = { id: nanoid(10), columnId, title, order };
  cards.set(card.id, card);
  return card;
}

export function deleteCard(cardId: string): boolean {
  return cards.delete(cardId);
}

export function moveCard(cardId: string, toColumnId: string, toIndex: number): Card | null {
  const card = cards.get(cardId);
  if (!card) return null;
  if (!columns.has(toColumnId)) return null;
  const fromColumnId = card.columnId;
  card.columnId = toColumnId;

  const targetCards = [...cards.values()]
    .filter((c) => c.columnId === toColumnId && c.id !== cardId)
    .sort((a, b) => a.order - b.order);
  const clampedIndex = Math.max(0, Math.min(toIndex, targetCards.length));
  targetCards.splice(clampedIndex, 0, card);
  targetCards.forEach((c, i) => (c.order = i));

  if (fromColumnId !== toColumnId) {
    const sourceCards = [...cards.values()]
      .filter((c) => c.columnId === fromColumnId)
      .sort((a, b) => a.order - b.order);
    sourceCards.forEach((c, i) => (c.order = i));
  }
  return card;
}

export function boardIdForColumn(columnId: string): string | null {
  return columns.get(columnId)?.boardId ?? null;
}

export function boardIdForCard(cardId: string): string | null {
  const card = cards.get(cardId);
  if (!card) return null;
  return columns.get(card.columnId)?.boardId ?? null;
}
