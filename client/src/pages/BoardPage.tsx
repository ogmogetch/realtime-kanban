import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBoardStore } from '../store.js';
import { useBoardSocket } from '../hooks/useBoardSocket.js';
import BoardView from '../components/BoardView.js';
import PresenceBar from '../components/PresenceBar.js';
import RemoteCursors from '../components/RemoteCursors.js';
import BoardHeader from '../components/BoardHeader.js';
import { boardGradient } from '../utils/boardColor.js';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const board = useBoardStore((s) => s.board);
  const connected = useBoardStore((s) => s.connected);
  const reconnecting = useBoardStore((s) => s.reconnecting);
  const boardError = useBoardStore((s) => s.boardError);
  const reset = useBoardStore((s) => s.reset);

  useBoardSocket(boardId ?? null);

  useEffect(() => {
    return () => reset();
  }, [boardId, reset]);

  const gradient = boardId ? boardGradient(boardId) : undefined;

  return (
    <div
      className="board-page"
      data-hue
      style={{ ['--board-bg' as string]: gradient }}
    >
      <div className="header">
        <div className="header-left">
          <Link to="/" className="back-link">← Boards</Link>
          <span className={`status-dot ${connected ? 'on' : ''}`} title={connected ? 'Connected' : 'Disconnected'} />
          <strong>{board?.title ?? boardId}</strong>
          {board && <BoardHeader />}
        </div>
        <PresenceBar />
      </div>
      {reconnecting && <div className="banner">Connection lost — reconnecting…</div>}
      {boardError && (
        <div className="banner err">
          {boardError} — <Link to="/">back to boards</Link>
        </div>
      )}
      {board && <BoardView />}
      <RemoteCursors />
    </div>
  );
}
