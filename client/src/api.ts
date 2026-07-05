import type { Board } from './types.js';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  listBoards: () => fetch(`${BASE}/api/boards`).then((r) => json<Board[]>(r)),
  createBoard: (title: string) =>
    fetch(`${BASE}/api/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then((r) => json<Board>(r)),
};

export const API_URL = BASE;
