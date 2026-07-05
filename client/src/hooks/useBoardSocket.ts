import { useEffect, useRef } from 'react';
import { getSocket } from '../socket.js';
import { useBoardStore } from '../store.js';
import type { BoardSnapshot, Column, Card, PresenceUser } from '../types.js';

function getStoredName(): string {
  let name = localStorage.getItem('rk_name');
  if (!name) {
    name = `User-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem('rk_name', name);
  }
  return name;
}

export function useBoardSocket(boardId: string | null) {
  const setSnapshot = useBoardStore((s) => s.setSnapshot);
  const setColumns = useBoardStore((s) => s.setColumns);
  const setCards = useBoardStore((s) => s.setCards);
  const setPresence = useBoardStore((s) => s.setPresence);
  const setCursor = useBoardStore((s) => s.setCursor);
  const removeCursor = useBoardStore((s) => s.removeCursor);
  const setMe = useBoardStore((s) => s.setMe);
  const setConnected = useBoardStore((s) => s.setConnected);
  const setReconnecting = useBoardStore((s) => s.setReconnecting);

  const joinedRef = useRef(false);

  useEffect(() => {
    if (!boardId) return;
    const socket = getSocket();
    joinedRef.current = false;

    const join = () => {
      socket.emit(
        'board:join',
        { boardId, name: getStoredName() },
        (res: { snapshot?: BoardSnapshot; you?: PresenceUser; error?: string }) => {
          if (res?.error) {
            console.warn('join error', res.error);
            useBoardStore.setState({ board: null, columns: [], cards: [], presence: [], cursors: {} });
            return;
          }
          if (res.snapshot) setSnapshot(res.snapshot);
          if (res.you) setMe(res.you);
          joinedRef.current = true;
        }
      );
    };

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      join();
    };
    const onDisconnect = () => {
      setConnected(false);
      setReconnecting(true);
      joinedRef.current = false;
    };
    const onColumns = (columns: Column[]) => setColumns(columns);
    const onCards = (cards: Card[]) => setCards(cards);
    const onPresence = (users: PresenceUser[]) => setPresence(users);
    const onCursorUpdate = (payload: { socketId: string; x: number; y: number }) => setCursor(payload);
    const onCursorLeave = ({ socketId }: { socketId: string }) => removeCursor(socketId);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('board:columns', onColumns);
    socket.on('board:cards', onCards);
    socket.on('presence:update', onPresence);
    socket.on('cursor:update', onCursorUpdate);
    socket.on('cursor:leave', onCursorLeave);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('board:columns', onColumns);
      socket.off('board:cards', onCards);
      socket.off('presence:update', onPresence);
      socket.off('cursor:update', onCursorUpdate);
      socket.off('cursor:leave', onCursorLeave);
    };
  }, [boardId, setSnapshot, setColumns, setCards, setPresence, setCursor, removeCursor, setMe, setConnected, setReconnecting]);
}
