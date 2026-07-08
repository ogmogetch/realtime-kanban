import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useBoardStore } from '../store.js';
import { useAuthStore } from '../authStore.js';
import BoardView from '../components/BoardView.js';
import { boardGradient } from '../utils/boardColor.js';
import type { BoardSnapshot } from '../types.js';

export default function ViewPage() {
  const { token } = useParams<{ token: string }>();
  const setSnapshot = useBoardStore((s) => s.setSnapshot);
  const reset = useBoardStore((s) => s.reset);
  const board = useBoardStore((s) => s.board);
  const authUser = useAuthStore((s) => s.user);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const snap: BoardSnapshot = await api.publicSnapshot(token);
        if (!cancelled) setSnapshot(snap);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      reset();
    };
  }, [token, setSnapshot, reset]);

  const gradient = board?.background ?? (board ? boardGradient(board.id) : undefined);

  if (loading) return <div className="container">Loading board…</div>;
  if (err) {
    return (
      <div className="container">
        <h1>Cannot view this board</h1>
        <div className="form-error">{err}</div>
        <p>
          {authUser ? (
            <Link to="/">Back to your boards</Link>
          ) : (
            <Link to="/login">Sign in to continue</Link>
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      className="board-page"
      data-hue
      style={{ ['--board-bg' as string]: gradient }}
    >
      <div className="header">
        <div className="header-left">
          {authUser ? (
            <Link to="/" className="back-link">← Boards</Link>
          ) : (
            <Link to="/login" className="back-link">Sign in</Link>
          )}
          <strong>{board?.title ?? 'Board'}</strong>
        </div>
        <span className="badge">read-only</span>
      </div>
      <div className="readonly-banner">
        You're viewing this board via a public link. {' '}
        {authUser ? (
          <>You must be invited as a member to make changes.</>
        ) : (
          <><Link to={`/login?next=/join/${token}`} style={{ color: '#fff', textDecoration: 'underline' }}>Sign in to join</Link> and start editing.</>
        )}
      </div>
      {board && <BoardView readOnly />}
    </div>
  );
}
