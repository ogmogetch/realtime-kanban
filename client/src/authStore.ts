import { create } from 'zustand';
import type { User } from './types.js';

interface AuthState {
  user: User | null;
  token: string | null;
  ready: boolean;
  setAuth: (user: User, token: string) => void;
  clear: () => void;
  setReady: (v: boolean) => void;
}

const initialToken = localStorage.getItem('rk_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: initialToken,
  ready: false,
  setAuth: (user, token) => {
    localStorage.setItem('rk_token', token);
    set({ user, token, ready: true });
  },
  clear: () => {
    localStorage.removeItem('rk_token');
    set({ user: null, token: null, ready: true });
  },
  setReady: (v) => set({ ready: v }),
}));
