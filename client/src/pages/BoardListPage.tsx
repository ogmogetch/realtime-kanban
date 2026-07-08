import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuthStore } from '../authStore.js';
import { disconnectSocket } from '../socket.js';
import { boardGradient } from '../utils/boardColor.js';
import type { Board } from '../types.js';

export default function BoardListPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  async function load() {
    try {
      setBoards(await api.listBoards());
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await api.createBoard(title.trim());
      setTitle('');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this board? All columns and cards will be lost.')) return;
    try {
      await api.deleteBoard(id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function logout() {
    clear();
    disconnectSocket();
    navigate('/login');
  }

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <h1>Your boards</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Create a board, invite teammates, and see every change sync live.
          </p>
        </div>
        <div className="topbar-right">
          {user && (
            <Link to="/settings" className="username-chip" style={{ textDecoration: 'none' }}>
              <span className="dot" style={{ background: user.avatarColor ?? undefined }} />
              {user.displayName || user.username}
            </Link>
          )}
          <button onClick={logout}>Sign out</button>
        </div>
      </div>

      <form className="new-board-form" onSubmit={submit} style={{ marginTop: 24 }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name a new board…"
          maxLength={80}
        />
        <button className="primary" disabled={busy || !title.trim()}>
          {busy ? 'Creating…' : 'Create board'}
        </button>
      </form>

      {err && <div className="form-error" style={{ marginBottom: 16 }}>{err}</div>}

      {boards.length === 0 ? (
        <div className="board-empty">
          <div style={{ fontSize: 15, marginBottom: 6, color: 'var(--text)' }}>
            No boards yet
          </div>
          Create your first one above to get started.
        </div>
      ) : (
        <div className="board-grid">
          {boards.map((b) => (
            <Link
              to={`/b/${b.id}`}
              key={b.id}
              className="board-card"
              style={{ background: b.background ?? boardGradient(b.id) }}
              aria-label={`Open board ${b.title}`}
            >
              <div className="board-card-actions">
                {b.ownerId === user?.id && (
                  <button onClick={(e) => remove(e, b.id)} title="Delete board">Delete</button>
                )}
              </div>
              <div className="board-card-title">{b.title}</div>
              <div className="board-card-meta">
                <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                {b.ownerId === user?.id && <span className="badge" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>owner</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
