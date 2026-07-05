import { useMemo, useState } from 'react';
import { useBoardStore } from '../store.js';
import { getSocket } from '../socket.js';
import ColumnView from './ColumnView.js';

export default function BoardView() {
  const columns = useBoardStore((s) => s.columns);
  const cards = useBoardStore((s) => s.cards);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, typeof cards>();
    for (const c of columns) map.set(c.id, []);
    for (const card of cards) {
      const list = map.get(card.columnId);
      if (list) list.push(card);
    }
    for (const [, list] of map) list.sort((a, b) => a.order - b.order);
    return map;
  }, [columns, cards]);

  const [newColTitle, setNewColTitle] = useState('');
  const [adding, setAdding] = useState(false);

  function addColumn() {
    const t = newColTitle.trim();
    if (!t) return;
    getSocket().emit('column:create', { title: t }, () => {});
    setNewColTitle('');
    setAdding(false);
  }

  return (
    <div className="board">
      {columns.map((col) => (
        <ColumnView
          key={col.id}
          column={col}
          cards={cardsByColumn.get(col.id) ?? []}
        />
      ))}
      <div className="column add-column-wrapper" onClick={() => setAdding((v) => !v)}>
        {adding ? (
          <div className="inline-form" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              autoFocus
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              placeholder="Column title"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addColumn();
                if (e.key === 'Escape') { setAdding(false); setNewColTitle(''); }
              }}
            />
            <button className="primary" onClick={addColumn}>Add</button>
          </div>
        ) : (
          <div>+ Add column</div>
        )}
      </div>
    </div>
  );
}
