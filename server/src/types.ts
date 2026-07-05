export interface Card {
  id: string;
  columnId: string;
  title: string;
  order: number;
}

export interface Column {
  id: string;
  boardId: string;
  title: string;
  order: number;
}

export interface Board {
  id: string;
  title: string;
  createdAt: number;
}

export interface BoardSnapshot {
  board: Board;
  columns: Column[];
  cards: Card[];
}

export interface PresenceUser {
  socketId: string;
  name: string;
  color: string;
}

export interface CardMovePayload {
  cardId: string;
  toColumnId: string;
  toIndex: number;
}
