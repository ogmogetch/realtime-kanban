import { useEffect, useRef, useState } from 'react';
import type { BoardMember } from '../types.js';

interface Props {
  members: BoardMember[];
  active: Set<string>;
  onToggle: (userId: string) => void;
  onClear: () => void;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function MemberFilterDropdown({ members, active, onToggle, onClear }: Props) {
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
    ? members.filter((m) => {
        const needle = q.trim().toLowerCase();
        return (
          m.username.toLowerCase().includes(needle) ||
          (m.displayName ?? '').toLowerCase().includes(needle)
        );
      })
    : members;

  return (
    <div className="filter-labels-dropdown" ref={rootRef}>
      <button className="filter-labels-btn" onClick={() => setOpen((v) => !v)}>
        Assignee
        {active.size > 0 && <span className="active-count">{active.size}</span>}
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="filter-labels-panel" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search members…"
            autoFocus
          />
          <div className="label-list">
            {filtered.map((m) => {
              const on = active.has(m.userId);
              const name = m.displayName || m.username;
              return (
                <button key={m.userId} className={on ? 'on' : ''} onClick={() => onToggle(m.userId)}>
                  <span className="avatar small" style={{ background: m.avatarColor, marginLeft: 0 }}>
                    {initials(name)}
                  </span>
                  <span className="name">{name}</span>
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
