import type { Board, User } from './types.js';

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

  listBoards: () => req<Board[]>('/api/boards'),
  createBoard: (title: string) =>
    req<Board>('/api/boards', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteBoard: (id: string) =>
    req<{ ok: true }>(`/api/boards/${id}`, { method: 'DELETE' }),
  createInviteLink: (boardId: string) =>
    req<{ token: string; url: string }>(`/api/boards/${boardId}/invite-link`, { method: 'POST' }),
  acceptInvite: (token: string) =>
    req<{ boardId: string }>(`/api/invites/accept`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};

export const API_URL = BASE;
