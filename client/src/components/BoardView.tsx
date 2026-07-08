import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useBoardStore } from '../store.js';
import { getSocket } from '../socket.js';
import ColumnView from './ColumnView.js';
import CardView from './CardView.js';
import CardModal from './CardModal.js';
import type { Card, Column } from '../types.js';

export default function BoardView({ readOnly = false }: { readOnly?: boolean }) {
  const columns = useBoardStore((s) => s.columns);
  const cards = useBoardStore((s) => s.cards);
  const labels = useBoardStore((s) => s.labels);
  const applyOptimisticMove = useBoardStore((s) => s.applyOptimisticMove);
  const applyOptimisticColumnMove = useBoardStore((s) => s.applyOptimisticColumnMove);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [params, setParams] = useSearchParams();
  const openCardId = params.get('c');

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

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const [newColTitle, setNewColTitle] = useState('');
  const [adding, setAdding] = useState(false);

  function addColumn() {
    const t = newColTitle.trim();
    if (!t) return;
    getSocket().emit('column:create', { title: t }, () => {});
    setNewColTitle('');
    setAdding(false);
  }

  function openCard(id: string) {
    const next = new URLSearchParams(params);
    next.set('c', id);
    setParams(next, { replace: true });
  }

  function closeCard() {
    const next = new URLSearchParams(params);
    next.delete('c');
    setParams(next, { replace: true });
  }

  function isColumnId(id: string) {
    return columnIds.includes(id);
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (isColumnId(id)) {
      setActiveColumn(columns.find((c) => c.id === id) ?? null);
      return;
    }
    setActiveCard(cards.find((c) => c.id === id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    setActiveColumn(null);
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Column reorder
    if (isColumnId(activeId)) {
      if (!isColumnId(overId)) return;
      if (activeId === overId) return;
      const overIdx = columns.findIndex((c) => c.id === overId);
      if (overIdx === -1) return;
      applyOptimisticColumnMove(activeId, overIdx);
      getSocket().emit('column:move', { columnId: activeId, toIndex: overIdx }, () => {});
      return;
    }

    // Card reorder
    const card = cards.find((c) => c.id === activeId);
    if (!card) return;

    let toColumnId: string;
    let toIndex: number;

    if (isColumnId(overId)) {
      toColumnId = overId;
      const list = cardsByColumn.get(toColumnId) ?? [];
      toIndex = list.filter((c) => c.id !== activeId).length;
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard) return;
      toColumnId = overCard.columnId;
      const list = (cardsByColumn.get(toColumnId) ?? []).filter((c) => c.id !== activeId);
      const idx = list.findIndex((c) => c.id === overId);
      toIndex = idx === -1 ? list.length : idx;
    }

    if (card.columnId === toColumnId && card.order === toIndex) return;

    applyOptimisticMove(activeId, toColumnId, toIndex);

    getSocket().emit(
      'card:move',
      { cardId: activeId, toColumnId, toIndex },
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
        onDragCancel={() => { setActiveCard(null); setActiveColumn(null); }}
      >
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div className="board">
            {columns.map((col) => (
              <ColumnView
                key={col.id}
                column={col}
                cards={cardsByColumn.get(col.id) ?? []}
                labels={labels}
                onOpenCard={openCard}
                readOnly={readOnly}
              />
            ))}
            {!readOnly && (
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
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeCard ? (
            <div style={{ transform: 'rotate(3deg)' }}>
              <CardView card={activeCard} labels={labels} onOpen={() => {}} />
            </div>
          ) : activeColumn ? (
            <div className="column drag-preview" style={{ transform: 'rotate(2deg)', opacity: 0.9 }}>
              <div className="column-title">
                <span className="column-title-text">{activeColumn.title}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {openCardId && <CardModal cardId={openCardId} onClose={closeCard} readOnly={readOnly} />}
    </>
  );
}
