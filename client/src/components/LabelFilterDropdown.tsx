import { useEffect, useRef, useState } from 'react';
import type { Label } from '../types.js';

interface Props {
  labels: Label[];
  active: Set<string>;
  onToggle: (labelId: string) => void;
  onClear: () => void;
}

export default function LabelFilterDropdown({ labels, active, onToggle, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = q.trim()
    ? labels.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase()))
    : labels;

  return (
    <div className="filter-labels-dropdown" ref={rootRef}>
      <button className="filter-labels-btn" onClick={() => setOpen((v) => !v)}>
        Labels
        {active.size > 0 && <span className="active-count">{active.size}</span>}
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="filter-labels-panel" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search labels…"
            autoFocus
          />
          <div className="label-list">
            {filtered.map((l) => {
              const on = active.has(l.id);
              return (
                <button key={l.id} className={on ? 'on' : ''} onClick={() => onToggle(l.id)}>
                  <span className="swatch" style={{ background: l.color }} />
                  <span className="name">{l.name}</span>
                  {on && <span className="muted small">✓</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <div className="muted small">No match.</div>}
          </div>
          {active.size > 0 && (
            <button className="ghost small" onClick={onClear}>Clear selection</button>
          )}
        </div>
      )}
    </div>
  );
}
