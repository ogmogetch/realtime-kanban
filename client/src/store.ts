import { create } from 'zustand';
import type { Board, Card, CardEvent, Column, CursorPos, Label, BoardMember, PresenceUser } from './types.js';

interface BoardState {
  board: Board | null;
  columns: Column[];
  cards: Card[];
  labels: Label[];
  members: BoardMember[];
  presence: PresenceUser[];
  cursors: Record<string, CursorPos>;
  cardEvents: Record<string, CardEvent[]>;
  me: PresenceUser | null;
  connected: boolean;
  reconnecting: boolean;
  boardError: string | null;
  myRole: 'owner' | 'member' | 'viewer' | null;

  setSnapshot: (payload: { board: Board; columns: Column[]; cards: Card[]; labels: Label[]; members: BoardMember[] }) => void;
  setBoardMeta: (board: Board) => void;
  setMembers: (members: BoardMember[]) => void;
  setColumns: (columns: Column[]) => void;
  setCards: (cards: Card[]) => void;
  setLabels: (labels: Label[]) => void;
  applyOptimisticMove: (cardId: string, toColumnId: string, toIndex: number) => void;
  applyOptimisticColumnMove: (columnId: string, toIndex: number) => void;
  setPresence: (users: PresenceUser[]) => void;
  setCursor: (c: CursorPos) => void;
  removeCursor: (socketId: string) => void;
  setMe: (u: PresenceUser | null) => void;
  setConnected: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
  setBoardError: (v: string | null) => void;
  setMyRole: (v: 'owner' | 'member' | 'viewer' | null) => void;
  setCardEvents: (cardId: string, events: CardEvent[]) => void;
  reset: () => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  board: null,
  columns: [],
  cards: [],
  labels: [],
  members: [],
  presence: [],
  cursors: {},
  cardEvents: {},
  me: null,
  connected: false,
  reconnecting: false,
  boardError: null,
  myRole: null,

  setSnapshot: ({ board, columns, cards, labels, members }) =>
    set({
      board,
      columns: [...columns].sort((a, b) => a.order - b.order),
      cards: [...cards].sort((a, b) => a.order - b.order),
      labels,
      members,
      boardError: null,
    }),
  setBoardMeta: (board) => set({ board }),
  setMembers: (members) => set({ members }),
  setColumns: (columns) => set({ columns: [...columns].sort((a, b) => a.order - b.order) }),
  setCards: (cards) => set({ cards: [...cards].sort((a, b) => a.order - b.order) }),
  setLabels: (labels) => set({ labels }),

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

  applyOptimisticColumnMove: (columnId, toIndex) =>
    set((state) => {
      const col = state.columns.find((c) => c.id === columnId);
      if (!col) return state;
      const others = state.columns.filter((c) => c.id !== columnId).sort((a, b) => a.order - b.order);
      const clamped = Math.max(0, Math.min(toIndex, others.length));
      others.splice(clamped, 0, col);
      const columns = others.map((c, i) => ({ ...c, order: i }));
      return { columns };
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
  setBoardError: (v) => set({ boardError: v }),
  setMyRole: (v) => set({ myRole: v }),
  setCardEvents: (cardId, events) =>
    set((s) => ({ cardEvents: { ...s.cardEvents, [cardId]: events } })),
  reset: () =>
    set({
      board: null,
      columns: [],
      cards: [],
      labels: [],
      members: [],
      presence: [],
      cursors: {},
      cardEvents: {},
      me: null,
      boardError: null,
      myRole: null,
    }),
}));
