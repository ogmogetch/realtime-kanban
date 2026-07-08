import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useBoardStore } from '../store.js';
import { getSocket } from '../socket.js';
import ColumnView from './ColumnView.js';
import CardView from './CardView.js';
import CardModal from './CardModal.js';
import type { Card } from '../types.js';

export default function BoardView() {
  const columns = useBoardStore((s) => s.columns);
  const cards = useBoardStore((s) => s.cards);
  const labels = useBoardStore((s) => s.labels);
  const applyOptimisticMove = useBoardStore((s) => s.applyOptimisticMove);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, Card[]>();
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

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const card = cards.find((c) => c.id === id) ?? null;
    setActiveCard(card);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;

    const cardId = String(active.id);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const overId = String(over.id);
    const overIsColumn = columns.some((col) => col.id === overId);

    let toColumnId: string;
    let toIndex: number;

    if (overIsColumn) {
      toColumnId = overId;
      const list = cardsByColumn.get(toColumnId) ?? [];
      toIndex = list.filter((c) => c.id !== cardId).length;
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard) return;
      toColumnId = overCard.columnId;
      const list = (cardsByColumn.get(toColumnId) ?? []).filter((c) => c.id !== cardId);
      const idx = list.findIndex((c) => c.id === overId);
      toIndex = idx === -1 ? list.length : idx;
    }

    if (card.columnId === toColumnId && card.order === toIndex) return;

    applyOptimisticMove(cardId, toColumnId, toIndex);

    getSocket().emit(
      'card:move',
      { cardId, toColumnId, toIndex },
      (res: { ok?: boolean; error?: string }) => {
        if (res?.error) console.warn('move error', res.error);
      }
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveCard(null)}
      >
        <div className="board">
          {columns.map((col) => (
            <ColumnView
              key={col.id}
              column={col}
              cards={cardsByColumn.get(col.id) ?? []}
              labels={labels}
              onOpenCard={setOpenCardId}
            />
          ))}
          <div className="column add-column-wrapper" onClick={() => setAdding((v) => !v)}>
            {adding ? (
              <div className="inline-form vertical" onClick={(e) => e.stopPropagation()}>
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
                <div className="row">
                  <button className="primary" onClick={addColumn}>Add</button>
                  <button className="ghost" onClick={(e) => { e.stopPropagation(); setAdding(false); setNewColTitle(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>+ Add another list</div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <div style={{ transform: 'rotate(3deg)' }}>
              <CardView card={activeCard} labels={labels} onOpen={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {openCardId && <CardModal cardId={openCardId} onClose={() => setOpenCardId(null)} />}
    </>
  );
}
