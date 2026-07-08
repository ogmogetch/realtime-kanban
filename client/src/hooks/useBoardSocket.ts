import { useEffect } from 'react';
import { getSocket } from '../socket.js';
import { useBoardStore } from '../store.js';
import { useAuthStore } from '../authStore.js';
import type { BoardSnapshot, Column, Card, Label, PresenceUser } from '../types.js';

export function useBoardSocket(boardId: string | null) {
  const token = useAuthStore((s) => s.token);
  const setSnapshot = useBoardStore((s) => s.setSnapshot);
  const setColumns = useBoardStore((s) => s.setColumns);
  const setCards = useBoardStore((s) => s.setCards);
  const setLabels = useBoardStore((s) => s.setLabels);
  const setPresence = useBoardStore((s) => s.setPresence);
  const setCursor = useBoardStore((s) => s.setCursor);
  const removeCursor = useBoardStore((s) => s.removeCursor);
  const setMe = useBoardStore((s) => s.setMe);
  const setConnected = useBoardStore((s) => s.setConnected);
  const setReconnecting = useBoardStore((s) => s.setReconnecting);
  const setBoardError = useBoardStore((s) => s.setBoardError);

  useEffect(() => {
    if (!boardId || !token) return;
    const socket = getSocket();

    const join = () => {
      socket.emit(
        'board:join',
        { boardId },
        (res: { snapshot?: BoardSnapshot; you?: PresenceUser; error?: string }) => {
          if (res?.error) {
            setBoardError(res.error);
            useBoardStore.setState({ board: null, columns: [], cards: [], labels: [], members: [], presence: [], cursors: {} });
            return;
          }
          if (res.snapshot) setSnapshot(res.snapshot);
          if (res.you) setMe(res.you);
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
    };
    const onColumns = (columns: Column[]) => setColumns(columns);
    const onCards = (cards: Card[]) => setCards(cards);
    const onLabels = (labels: Label[]) => setLabels(labels);
    const onPresence = (users: PresenceUser[]) => setPresence(users);
    const onCursorUpdate = (payload: { socketId: string; x: number; y: number }) => setCursor(payload);
    const onCursorLeave = ({ socketId }: { socketId: string }) => removeCursor(socketId);
    const onConnectError = (err: Error) => {
      setBoardError(err.message || 'connection failed');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('board:columns', onColumns);
    socket.on('board:cards', onCards);
    socket.on('board:labels', onLabels);
    socket.on('presence:update', onPresence);
    socket.on('cursor:update', onCursorUpdate);
    socket.on('cursor:leave', onCursorLeave);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('board:columns', onColumns);
      socket.off('board:cards', onCards);
      socket.off('board:labels', onLabels);
      socket.off('presence:update', onPresence);
      socket.off('cursor:update', onCursorUpdate);
      socket.off('cursor:leave', onCursorLeave);
    };
  }, [boardId, token, setSnapshot, setColumns, setCards, setLabels, setPresence, setCursor, removeCursor, setMe, setConnected, setReconnecting, setBoardError]);
}
