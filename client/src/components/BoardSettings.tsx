import { useEffect, useRef, useState } from 'react';
import { useBoardStore } from '../store.js';
import { useAuthStore } from '../authStore.js';
import { api } from '../api.js';
import { getSocket } from '../socket.js';


const BACKGROUNDS: Array<{ name: string; value: string }> = [
  { name: 'Indigo dusk',   value: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  { name: 'Ocean',         value: 'linear-gradient(135deg, #0ea5e9, #22d3ee)' },
  { name: 'Forest',        value: 'linear-gradient(135deg, #22c55e, #84cc16)' },
  { name: 'Sunset',        value: 'linear-gradient(135deg, #f97316, #f43f5e)' },
  { name: 'Rose violet',   value: 'linear-gradient(135deg, #ec4899, #8b5cf6)' },
  { name: 'Aurora',        value: 'linear-gradient(135deg, #14b8a6, #0ea5e9)' },
  { name: 'Ember',         value: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  { name: 'Cosmos',        value: 'linear-gradient(135deg, #a855f7, #ec4899)' },
];

const SOLID_COLORS = ['#0f172a', '#1e293b', '#334155', '#3b3f5b', '#4c1d95', '#155e75', '#065f46', '#7f1d1d'];

function initials(name: string) { return name.slice(0, 2).toUpperCase(); }

export default function BoardSettings() {
  const board = useBoardStore((s) => s.board);
  const members = useBoardStore((s) => s.members);
  const setBoardMeta = useBoardStore((s) => s.setBoardMeta);
  const me = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!board || board.ownerId !== me?.id) return null;

  const visibility = (board as { visibility?: string }).visibility ?? 'private';

  async function updateBoard(patch: { background?: string | null; visibility?: 'private' | 'public' }) {
    if (!board) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.updateBoard(board.id, patch);
      setBoardMeta(updated);
      getSocket().emit('board:refresh', {}, () => {});
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function applyImage() {
    const url = imageUrl.trim();
    if (!url) return;
    updateBoard({ background: `url("${url}") center/cover no-repeat` });
    setImageUrl('');
  }

  return (
    <div className="board-header-extra" style={{ position: 'relative' }} ref={popRef}>
      <button className="ghost small" onClick={() => setOpen((v) => !v)}>
        {open ? 'Close' : '⚙ Settings'}
      </button>
      {open && (
        <div className="board-settings-popover">
          <div>
            <h4>Gradient background</h4>
            <div className="bg-picker">
              <button
                className={`bg-swatch ${board.background === null ? 'sel' : ''}`}
                style={{ background: 'var(--surface-2)' }}
                onClick={() => updateBoard({ background: null })}
                disabled={busy}
                title="Default"
              >—</button>
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.value}
                  className={`bg-swatch ${board.background === b.value ? 'sel' : ''}`}
                  style={{ background: b.value }}
                  onClick={() => updateBoard({ background: b.value })}
                  disabled={busy}
                  title={b.name}
                />
              ))}
            </div>
          </div>
          <div>
            <h4>Solid</h4>
            <div className="bg-picker">
              {SOLID_COLORS.map((c) => (
                <button
                  key={c}
                  className={`bg-swatch ${board.background === c ? 'sel' : ''}`}
                  style={{ background: c }}
                  onClick={() => updateBoard({ background: c })}
                  disabled={busy}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div>
            <h4>Image URL</h4>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => { if (e.key === 'Enter') applyImage(); }}
              />
              <button className="primary small" onClick={applyImage} disabled={busy || !imageUrl.trim()}>
                Apply
              </button>
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              Paste an image URL to use it as the board background.
            </div>
          </div>
          <div>
            <h4>Visibility</h4>
            <div className="visibility-toggle">
              <button
                className={visibility === 'private' ? 'active' : ''}
                onClick={() => updateBoard({ visibility: 'private' })}
                disabled={busy}
              >
                🔒 Private
              </button>
              <button
                className={visibility === 'public' ? 'active' : ''}
                onClick={() => updateBoard({ visibility: 'public' })}
                disabled={busy}
              >
                🌐 Public
              </button>
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {visibility === 'public'
                ? 'Anyone with the link can view the board. Editing still requires being a member.'
                : 'Only board members can view or edit. Sign-in required.'}
            </div>
          </div>
          <div>
            <h4>Members</h4>
            <div className="member-list">
              {members.map((m) => (
                <div key={m.userId} className="member-list-row">
                  <span className="avatar small" style={{ background: m.avatarColor }}>
                    {initials(m.displayName || m.username)}
                  </span>
                  <div className="member-list-name">
                    <div>{m.displayName || m.username}</div>
                    <div className="muted small">@{m.username}</div>
                  </div>
                  {m.role === 'owner' ? (
                    <span className="badge">owner</span>
                  ) : m.userId === me?.id ? (
                    <span className="badge">you</span>
                  ) : (
                    <>
                      <select
                        value={m.role}
                        disabled={busy}
                        onChange={async (e) => {
                          const role = e.target.value as 'member' | 'viewer';
                          setBusy(true);
                          try {
                            await api.setMemberRole(board.id, m.userId, role);
                            getSocket().emit('board:refresh', {}, () => {});
                          } catch (err) { setErr((err as Error).message); }
                          finally { setBusy(false); }
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        className="icon"
                        title="Remove"
                        disabled={busy}
                        onClick={async () => {
                          if (!confirm(`Remove ${m.username} from this board?`)) return;
                          setBusy(true);
                          try {
                            await api.removeMember(board.id, m.userId);
                            getSocket().emit('board:refresh', {}, () => {});
                          } catch (err) { setErr((err as Error).message); }
                          finally { setBusy(false); }
                        }}
                      >×</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          {err && <div className="form-error small">{err}</div>}
        </div>
      )}
    </div>
  );
}
