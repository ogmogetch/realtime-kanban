import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBoardStore } from '../store.js';
import { useBoardSocket } from '../hooks/useBoardSocket.js';
import BoardView from '../components/BoardView.js';
import PresenceBar from '../components/PresenceBar.js';
import RemoteCursors from '../components/RemoteCursors.js';
import NameEditor from '../components/NameEditor.js';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const board = useBoardStore((s) => s.board);
  const connected = useBoardStore((s) => s.connected);
  const reconnecting = useBoardStore((s) => s.reconnecting);
  const reset = useBoardStore((s) => s.reset);

  useBoardSocket(boardId ?? null);

  useEffect(() => {
    return () => reset();
  }, [boardId, reset]);

  return (
    <div className="board-page">
      <div className="header">
        <div>
          <Link to="/" style={{ marginRight: 12 }}>← Boards</Link>
          <span className={`status-dot ${connected ? 'on' : ''}`} />
          <strong>{board?.title ?? boardId}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <NameEditor />
          <PresenceBar />
        </div>
      </div>
      {reconnecting && <div className="banner">Connection lost — reconnecting…</div>}
      <BoardView />
      <RemoteCursors />
    </div>
  );
}
