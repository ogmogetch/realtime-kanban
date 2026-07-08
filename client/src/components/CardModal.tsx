import { useEffect, useState } from 'react';
import { useBoardStore } from '../store.js';
import { getSocket } from '../socket.js';
import { autolink, extractUrls, prettyUrl } from '../utils/autolink.js';
import type { CardEvent } from '../types.js';

interface Props {
  cardId: string;
  onClose: () => void;
  readOnly?: boolean;
}

const NEW_LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function fmtEvent(e: CardEvent): string {
  const who = e.username ?? 'someone';
  switch (e.kind) {
    case 'card.created': return `${who} created the card`;
    case 'card.moved': return `${who} moved the card between columns`;
    case 'card.renamed': return `${who} renamed the card to “${e.meta.title as string}”`;
    case 'card.description_changed': return `${who} edited the description`;
    case 'card.label_added': return `${who} added label “${e.meta.labelName as string}”`;
    case 'card.label_removed': return `${who} removed label “${e.meta.labelName as string}”`;
    case 'card.assigned': return `${who} assigned ${e.meta.username as string}`;
    case 'card.unassigned': return `${who} unassigned ${e.meta.username as string}`;
    default: return `${who} · ${e.kind}`;
  }
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CardModal({ cardId, onClose, readOnly }: Props) {
  const card = useBoardStore((s) => s.cards.find((c) => c.id === cardId) ?? null);
  const labels = useBoardStore((s) => s.labels);
  const members = useBoardStore((s) => s.members);
  const events = useBoardStore((s) => s.cardEvents[cardId] ?? []);

  const [title, setTitle] = useState(card?.title ?? '');
  const [desc, setDesc] = useState(card?.description ?? '');
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(NEW_LABEL_COLORS[0]);
  const [copiedLink, setCopiedLink] = useState(false);
  const CARD_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    setTitle(card?.title ?? '');
    setDesc(card?.description ?? '');
  }, [card?.id]);

  useEffect(() => {
    if (readOnly) return;
    getSocket().emit('card:events:list', { cardId }, () => {});
  }, [cardId, readOnly]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!card) return null;

  function save() {
    if (!card || readOnly) return;
    const patch: { title?: string; description?: string } = {};
    if (title.trim() && title !== card.title) patch.title = title.trim();
    if (desc !== card.description) patch.description = desc;
    if (Object.keys(patch).length === 0) return;
    getSocket().emit('card:update', { cardId: card.id, ...patch }, () => {});
  }

  function toggleLabel(labelId: string) {
    getSocket().emit('card:label:toggle', { cardId: card!.id, labelId }, () => {});
  }

  function createLabel() {
    const n = newLabelName.trim();
    if (!n) return;
    getSocket().emit('label:create', { name: n, color: newLabelColor }, () => {
      setNewLabelName('');
    });
  }

  function deleteLabel(labelId: string) {
    if (!confirm('Delete this label from the board?')) return;
    getSocket().emit('label:delete', { labelId }, () => {});
  }

  function toggleAssignee(userId: string) {
    getSocket().emit('card:assignee:toggle', { cardId: card!.id, userId }, () => {});
  }

  function setColor(color: string | null) {
    getSocket().emit('card:update', { cardId: card!.id, color }, () => {});
  }

  function remove() {
    if (!confirm('Delete this card?')) return;
    getSocket().emit('card:delete', { cardId: card!.id }, () => {});
    onClose();
  }

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?c=${card!.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {}
  }

  const cardLabels = card.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => !!l);

  const assigneeSet = new Set(card.assigneeIds);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {readOnly ? (
            <div className="modal-title-input" style={{ padding: '8px 10px' }}>{card.title}</div>
          ) : (
            <input
              type="text"
              className="modal-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
              }}
            />
          )}
          <button onClick={copyLink} className="ghost small" title="Copy link to this card">
            {copiedLink ? '✓ Copied' : '🔗 Link'}
          </button>
          <button onClick={onClose} className="icon large">×</button>
        </div>

        {!readOnly && (
          <div className="modal-section">
            <div className="modal-section-title">Members</div>
            <div className="member-grid">
              {members.map((m) => {
                const active = assigneeSet.has(m.userId);
                return (
                  <button
                    key={m.userId}
                    className={`member-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleAssignee(m.userId)}
                    title={active ? `Unassign ${m.displayName || m.username}` : `Assign ${m.displayName || m.username}`}
                  >
                    <span className="avatar small" style={{ background: m.avatarColor }}>
                      {initials(m.displayName || m.username)}
                    </span>
                    <span className="member-chip-name">{m.displayName || m.username}</span>
                    {active && <span className="member-chip-check">✓</span>}
                  </button>
                );
              })}
              {members.length === 0 && <span className="muted small">No members yet.</span>}
            </div>
          </div>
        )}
        {readOnly && card.assigneeIds.length > 0 && (
          <div className="modal-section">
            <div className="modal-section-title">Assigned</div>
            <div className="labels-row">
              {card.assigneeIds.map((uid) => {
                const m = members.find((x) => x.userId === uid);
                if (!m) return null;
                return (
                  <span key={uid} className="member-chip active" style={{ cursor: 'default' }}>
                    <span className="avatar small" style={{ background: m.avatarColor }}>
                      {initials(m.displayName || m.username)}
                    </span>
                    <span className="member-chip-name">{m.displayName || m.username}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="modal-section">
            <div className="modal-section-title">Card color</div>
            <div className="color-picker">
              <button
                className={`color-swatch ${card.color === null ? 'sel' : ''}`}
                style={{ background: 'var(--surface-2)' }}
                onClick={() => setColor(null)}
                title="None"
              />
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch ${card.color === c ? 'sel' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}

        <div className="modal-section">
          <div className="modal-section-title">Labels</div>
          <div className="labels-row">
            {cardLabels.map((l) => (
              <span key={l.id} className="label-pill" style={{ background: l.color }}>
                {l.name}
              </span>
            ))}
            {!readOnly && (
              <button className="ghost small" onClick={() => setShowLabelEditor((v) => !v)}>
                {showLabelEditor ? 'Done' : 'Manage'}
              </button>
            )}
          </div>
          {showLabelEditor && !readOnly && (
            <div className="label-editor">
              {labels.map((l) => {
                const attached = card.labelIds.includes(l.id);
                return (
                  <div key={l.id} className="label-editor-row">
                    <button
                      className="label-pill toggle"
                      style={{ background: l.color, opacity: attached ? 1 : 0.4 }}
                      onClick={() => toggleLabel(l.id)}
                    >
                      {attached ? '✓ ' : ''}{l.name}
                    </button>
                    <button className="icon" onClick={() => deleteLabel(l.id)} title="Delete label">×</button>
                  </div>
                );
              })}
              <div className="label-create">
                <input
                  type="text"
                  placeholder="New label name"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createLabel(); }}
                />
                <div className="color-picker">
                  {NEW_LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`color-swatch ${newLabelColor === c ? 'sel' : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewLabelColor(c)}
                      title={c}
                    />
                  ))}
                </div>
                <button className="primary small" onClick={createLabel}>Create</button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Description</div>
          {readOnly ? (
            <div className="modal-desc rendered" style={{ padding: '10px 12px', whiteSpace: 'pre-wrap' }}>
              {card.description ? autolink(card.description) : <span className="muted">No description.</span>}
            </div>
          ) : (
            <textarea
              className="modal-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={save}
              placeholder="Paste code links, docs, tickets… URLs become clickable below."
              rows={5}
            />
          )}
          {(() => {
            const urls = extractUrls(readOnly ? card.description : desc);
            if (urls.length === 0) return null;
            return (
              <div className="link-chips">
                {urls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="link-chip" title={url}>
                    <span className="link-chip-icon">🔗</span>
                    {prettyUrl(url)}
                  </a>
                ))}
              </div>
            );
          })()}
        </div>

        {!readOnly && (
          <div className="modal-section">
            <div className="modal-section-title">Activity</div>
            {events.length === 0 ? (
              <div className="muted small">No activity yet.</div>
            ) : (
              <ul className="activity-list">
                {events.map((e) => (
                  <li key={e.id}>
                    <span className="activity-text">{fmtEvent(e)}</span>
                    <span className="activity-time">{timeAgo(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!readOnly && (
          <div className="modal-footer">
            <button className="danger" onClick={remove}>Delete card</button>
          </div>
        )}
      </div>
    </div>
  );
}
