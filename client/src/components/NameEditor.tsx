import { useEffect, useState } from 'react';
import { useBoardStore } from '../store.js';
import { getSocket } from '../socket.js';
import { useParams } from 'react-router-dom';

export default function NameEditor() {
  const me = useBoardStore((s) => s.me);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(me?.name ?? '');
  const { boardId } = useParams<{ boardId: string }>();

  useEffect(() => {
    setValue(me?.name ?? '');
  }, [me?.name]);

  function save() {
    const trimmed = value.trim().slice(0, 24);
    if (!trimmed) {
      setEditing(false);
      return;
    }
    localStorage.setItem('rk_name', trimmed);
    if (boardId) {
      getSocket().emit('board:join', { boardId, name: trimmed }, () => {});
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="inline-form" style={{ maxWidth: 200 }}>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') { setEditing(false); setValue(me?.name ?? ''); }
          }}
        />
        <button className="primary" onClick={save}>OK</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Change display name"
      style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 12 }}
    >
      {me?.name ?? '…'} ✎
    </button>
  );
}
