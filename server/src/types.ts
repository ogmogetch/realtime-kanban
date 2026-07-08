export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarColor: string;
  background: string | null;
}

export interface Card {
  id: string;
  columnId: string;
  title: string;
  description: string;
  order: number;
  color: string | null;
  labelIds: string[];
  assigneeIds: string[];
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
  ownerId: string;
  createdAt: string;
  background: string | null;
  visibility: 'private' | 'link';
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface BoardMember {
  userId: string;
  username: string;
  displayName: string | null;
  avatarColor: string;
  role: string;
}

export interface CardEvent {
  id: string;
  cardId: string;
  userId: string | null;
  username: string | null;
  kind: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface BoardSnapshot {
  board: Board;
  columns: Column[];
  cards: Card[];
  labels: Label[];
  members: BoardMember[];
}

export interface PresenceUser {
  socketId: string;
  userId: string;
  name: string;
  color: string;
}

export interface CardMovePayload {
  cardId: string;
  toColumnId: string;
  toIndex: number;
}

export interface AuthPayload {
  userId: string;
  username: string;
}
