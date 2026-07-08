import type { Board, BoardSnapshot, User } from './types.js';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function getToken(): string | null {
  return localStorage.getItem('rk_token');
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface ProfilePatch {
  displayName?: string | null;
  avatarColor?: string;
  background?: string | null;
}

export interface BoardPatch {
  background?: string | null;
  visibility?: 'private' | 'public';
}

export const api = {
  register: (body: { email: string; username: string; password: string }) =>
    req<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { identifier: string; password: string }) =>
    req<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => req<{ user: User }>('/api/auth/me'),
  updateProfile: (patch: ProfilePatch) =>
    req<{ user: User }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(patch) }),

  listBoards: () => req<Board[]>('/api/boards'),
  createBoard: (title: string) =>
    req<Board>('/api/boards', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteBoard: (id: string) =>
    req<{ ok: true }>(`/api/boards/${id}`, { method: 'DELETE' }),
  updateBoard: (id: string, patch: BoardPatch) =>
    req<Board>(`/api/boards/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  createInviteLink: (boardId: string) =>
    req<{ token: string; url: string }>(`/api/boards/${boardId}/invite-link`, { method: 'POST' }),
  acceptInvite: (token: string) =>
    req<{ boardId: string }>(`/api/invites/accept`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  publicSnapshot: (token: string) =>
    req<BoardSnapshot>(`/api/public/boards/${token}/snapshot`),
};

export const API_URL = BASE;
