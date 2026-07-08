import { io, Socket } from 'socket.io-client';
import { API_URL } from './api.js';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket {
  const token = localStorage.getItem('rk_token');
  if (socket && currentToken === token) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = token;
  socket = io(API_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    auth: { token },
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = null;
}
