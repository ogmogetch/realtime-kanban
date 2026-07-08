import { useEffect, useState } from 'react';
import { useBoardStore } from '../store.js';
import { getSocket } from '../socket.js';

interface Props {
  cardId: string;
  onClose: () => void;
}

const NEW_LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

export default function CardModal({ cardId, onClose }: Props) {
  const card = useBoardStore((s) => s.cards.find((c) => c.id === cardId) ?? null);
  const labels = useBoardStore((s) => s.labels);

  const [title, setTitle] = useState(card?.title ?? '');
  const [desc, setDesc] = useState(card?.description ?? '');
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(NEW_LABEL_COLORS[0]);

  useEffect(() => {
    setTitle(card?.title ?? '');
    setDesc(card?.description ?? '');
  }, [card?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!card) return null;

  function save() {
    if (!card) return;
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

  function remove() {
    if (!confirm('Delete this card?')) return;
    getSocket().emit('card:delete', { cardId: card!.id }, () => {});
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
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
          <button onClick={onClose} className="icon large">×</button>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Labels</div>
          <div className="labels-row">
            {card.labelIds.map((id) => {
              const l = labels.find((x) => x.id === id);
              if (!l) return null;
              return (
                <span key={l.id} className="label-pill" style={{ background: l.color }}>
                  {l.name}
                </span>
              );
            })}
            <button className="ghost small" onClick={() => setShowLabelEditor((v) => !v)}>
              {showLabelEditor ? 'Done' : 'Manage'}
            </button>
          </div>
          {showLabelEditor && (
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
          <textarea
            className="modal-desc"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={save}
            placeholder="Add a more detailed description…"
            rows={5}
          />
        </div>

        <div className="modal-footer">
          <button className="danger" onClick={remove}>Delete card</button>
        </div>
      </div>
    </div>
  );
}
