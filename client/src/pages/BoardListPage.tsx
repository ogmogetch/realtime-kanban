import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import type { Board } from '../types.js';

export default function BoardListPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setBoards(await api.listBoards());
    } catch (e) {
      setErr(String(e));
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
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <h1>Realtime Kanban</h1>
      <p style={{ color: 'var(--muted)' }}>
        Create a board, then open the same URL in two browsers to see live sync.
      </p>

      <form className="inline-form" onSubmit={submit} style={{ margin: '16px 0' }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New board title"
        />
        <button className="primary" disabled={busy || !title.trim()}>Create</button>
      </form>

      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}

      <div className="board-list">
        {boards.length === 0 && <div style={{ color: 'var(--muted)' }}>No boards yet.</div>}
        {boards.map((b) => (
          <Link key={b.id} to={`/b/${b.id}`} className="board-list-item">
            <span>{b.title}</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{b.id}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
