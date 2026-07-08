import { useState } from 'react';
import { useBoardStore } from '../store.js';
import { useAuthStore } from '../authStore.js';
import { api } from '../api.js';

export default function BoardHeader() {
  const board = useBoardStore((s) => s.board);
  const members = useBoardStore((s) => s.members);
  const me = useAuthStore((s) => s.user);
  const [showInvite, setShowInvite] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!board) return null;
  const isOwner = board.ownerId === me?.id;

  async function generate() {
    if (!board || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { url } = await api.createInviteLink(board.id);
      setLink(url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (showInvite) {
      setShowInvite(false);
      setCopied(false);
      return;
    }
    setShowInvite(true);
    if (!link) await generate();
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErr('clipboard blocked');
    }
  }

  return (
    <div className="board-header-extra">
      <span className="muted small">
        {members.length} member{members.length > 1 ? 's' : ''}
      </span>
      {isOwner && (
        <>
          <button className="ghost small" onClick={toggle}>
            {showInvite ? 'Close' : '+ Invite link'}
          </button>
          {showInvite && (
            <div className="invite-popover">
              <div className="muted small">Anyone with this link can join the board.</div>
              {busy && !link && <div className="muted small">Generating…</div>}
              {link && (
                <>
                  <input type="text" value={link} readOnly onFocus={(e) => e.target.select()} />
                  <div className="row" style={{ display: 'flex', gap: 6 }}>
                    <button className="primary small" onClick={copy}>
                      {copied ? 'Copied ✓' : 'Copy link'}
                    </button>
                    <button className="ghost small" onClick={generate} disabled={busy}>
                      Regenerate
                    </button>
                  </div>
                </>
              )}
              {err && <div className="form-error small">{err}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
