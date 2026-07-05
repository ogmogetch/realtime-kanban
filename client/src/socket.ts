import { io, Socket } from 'socket.io-client';
import { API_URL } from './api.js';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
