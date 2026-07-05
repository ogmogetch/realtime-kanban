import { create } from 'zustand';
import type { Board, Card, Column, CursorPos, PresenceUser } from './types.js';

interface BoardState {
  board: Board | null;
  columns: Column[];
  cards: Card[];
  presence: PresenceUser[];
  cursors: Record<string, CursorPos>;
  me: PresenceUser | null;
  connected: boolean;
  reconnecting: boolean;

  setSnapshot: (payload: { board: Board; columns: Column[]; cards: Card[] }) => void;
  setColumns: (columns: Column[]) => void;
  setCards: (cards: Card[]) => void;
  applyOptimisticMove: (cardId: string, toColumnId: string, toIndex: number) => void;
  setPresence: (users: PresenceUser[]) => void;
  setCursor: (c: CursorPos) => void;
  removeCursor: (socketId: string) => void;
  setMe: (u: PresenceUser | null) => void;
  setConnected: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
  reset: () => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  board: null,
  columns: [],
  cards: [],
  presence: [],
  cursors: {},
  me: null,
  connected: false,
  reconnecting: false,

  setSnapshot: ({ board, columns, cards }) =>
    set({
      board,
      columns: [...columns].sort((a, b) => a.order - b.order),
      cards: [...cards].sort((a, b) => a.order - b.order),
    }),
  setColumns: (columns) => set({ columns: [...columns].sort((a, b) => a.order - b.order) }),
  setCards: (cards) => set({ cards: [...cards].sort((a, b) => a.order - b.order) }),

  applyOptimisticMove: (cardId, toColumnId, toIndex) =>
    set((state) => {
      const card = state.cards.find((c) => c.id === cardId);
      if (!card) return state;
      const fromColumnId = card.columnId;
      const others = state.cards.filter((c) => c.id !== cardId);
      const target = others
        .filter((c) => c.columnId === toColumnId)
        .sort((a, b) => a.order - b.order);
      const clamped = Math.max(0, Math.min(toIndex, target.length));
      target.splice(clamped, 0, { ...card, columnId: toColumnId });
      const rebuilt = [...others.filter((c) => c.columnId !== toColumnId), ...target].map((c) => {
        if (c.columnId !== toColumnId) return c;
        const idx = target.findIndex((t) => t.id === c.id);
        return { ...c, order: idx };
      });
      if (fromColumnId !== toColumnId) {
        const src = rebuilt
          .filter((c) => c.columnId === fromColumnId)
          .sort((a, b) => a.order - b.order);
        const rebuilt2 = rebuilt.map((c) => {
          if (c.columnId !== fromColumnId) return c;
          const idx = src.findIndex((s) => s.id === c.id);
          return { ...c, order: idx };
        });
        return { cards: rebuilt2.sort((a, b) => a.order - b.order) };
      }
      return { cards: rebuilt.sort((a, b) => a.order - b.order) };
    }),

  setPresence: (users) => set({ presence: users }),
  setCursor: (c) => set((s) => ({ cursors: { ...s.cursors, [c.socketId]: c } })),
  removeCursor: (socketId) =>
    set((s) => {
      const next = { ...s.cursors };
      delete next[socketId];
      return { cursors: next };
    }),
  setMe: (u) => set({ me: u }),
  setConnected: (v) => set({ connected: v }),
  setReconnecting: (v) => set({ reconnecting: v }),
  reset: () =>
    set({
      board: null,
      columns: [],
      cards: [],
      presence: [],
      cursors: {},
      me: null,
    }),
}));
