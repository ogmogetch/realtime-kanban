import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuthStore } from '../authStore.js';
import { disconnectSocket } from '../socket.js';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#a855f7', '#f43f5e',
];

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

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#6366f1');
  const [background, setBackground] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? '');
    setAvatarColor(user.avatarColor ?? '#6366f1');
    setBackground(user.background ?? null);
  }, [user?.id]);

  if (!user || !token) return null;

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { user: updated } = await api.updateProfile({
        displayName: displayName.trim() || null,
        avatarColor,
        background,
      });
      setAuth(updated, token!);
      setMsg('Saved');
      setTimeout(() => setMsg(null), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clear();
    disconnectSocket();
    navigate('/login');
  }

  const previewName = displayName.trim() || user.username;

  return (
    <div className="container settings-page">
      <div className="topbar">
        <div>
          <h1>Profile</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Personalize how you appear on your boards.
          </p>
        </div>
        <div className="topbar-right">
          <Link to="/" className="ghost">← Boards</Link>
          <button onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="settings-avatar-preview" style={{ background: avatarColor }}>
            {initials(previewName)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{previewName}</div>
            <div className="muted small">@{user.username}</div>
          </div>
        </div>

        <label>
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={user.username}
            maxLength={40}
          />
        </label>

        <div>
          <div className="modal-section-title">Avatar color</div>
          <div className="color-picker">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${avatarColor === c ? 'sel' : ''}`}
                style={{ background: c }}
                onClick={() => setAvatarColor(c)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="modal-section-title">Default board background</div>
          <div className="bg-picker">
            <button
              className={`bg-swatch ${background === null ? 'sel' : ''}`}
              style={{ background: 'var(--surface-2)' }}
              onClick={() => setBackground(null)}
              title="None"
            >—</button>
            {BACKGROUNDS.map((b) => (
              <button
                key={b.value}
                className={`bg-swatch ${background === b.value ? 'sel' : ''}`}
                style={{ background: b.value }}
                onClick={() => setBackground(b.value)}
                title={b.name}
              />
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Boards without a custom background will use this.
          </div>
        </div>

        {err && <div className="form-error">{err}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          {msg && <span className="muted small">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
