import { useEffect, useMemo, useState } from 'react';
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
import ShortcutsOverlay from './ShortcutsOverlay.js';
import LabelFilterDropdown from './LabelFilterDropdown.js';
import type { Card, Column } from '../types.js';

export default function BoardView({ readOnly = false }: { readOnly?: boolean }) {
  const columns = useBoardStore((s) => s.columns);
  const cards = useBoardStore((s) => s.cards);
  const labels = useBoardStore((s) => s.labels);
  const members = useBoardStore((s) => s.members);
  const applyOptimisticMove = useBoardStore((s) => s.applyOptimisticMove);
  const applyOptimisticColumnMove = useBoardStore((s) => s.applyOptimisticColumnMove);

  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<Set<string>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());

  function toggleSet<T>(prev: Set<T>, v: T): Set<T> {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  }
  const filterActive = search.trim() !== '' || labelFilter.size > 0 || assigneeFilter.size > 0;
  const filteredCards = useMemo(() => {
    if (!filterActive) return cards;
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
      if (labelFilter.size > 0 && !c.labelIds.some((id) => labelFilter.has(id))) return false;
      if (assigneeFilter.size > 0 && !c.assigneeIds.some((id) => assigneeFilter.has(id))) return false;
      return true;
    });
  }, [cards, search, labelFilter, assigneeFilter, filterActive]);

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
    for (const card of filteredCards) {
      const list = map.get(card.columnId);
      if (list) list.push(card);
    }
    for (const [, list] of map) list.sort((a, b) => a.order - b.order);
    return map;
  }, [columns, filteredCards]);

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const [newColTitle, setNewColTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (readOnly) return;
    function isTyping(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === '/') {
        e.preventDefault();
        (document.querySelector('.filter-bar input') as HTMLInputElement | null)?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const btn = document.querySelector('.board .column:not(.add-column-wrapper) .add-card') as HTMLButtonElement | null;
        btn?.click();
        btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setAdding(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly, showHelp]);

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
      <div className="filter-bar">
        <div className="search-bar" style={{ minWidth: 200 }}>
          <span className="icon-search">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards…"
          />
        </div>
        {labels.length > 0 && (
          <>
            <span className="muted small">Labels:</span>
            {labels.length > 10 ? (
              <LabelFilterDropdown
                labels={labels}
                active={labelFilter}
                onToggle={(id) => setLabelFilter((p) => toggleSet(p, id))}
                onClear={() => setLabelFilter(new Set())}
              />
            ) : (
              labels.map((l) => (
                <span
                  key={l.id}
                  className={`label-pill ${labelFilter.has(l.id) ? 'active' : ''}`}
                  style={{ background: l.color }}
                  onClick={() => setLabelFilter((p) => toggleSet(p, l.id))}
                >
                  {l.name}
                </span>
              ))
            )}
          </>
        )}
        {members.length > 0 && (
          <>
            <span className="muted small" style={{ marginLeft: 8 }}>Assignee:</span>
            <div className="filter-avatars">
              {members.map((m) => (
                <span
                  key={m.userId}
                  className={`avatar small ${assigneeFilter.has(m.userId) ? 'active' : ''}`}
                  style={{ background: m.avatarColor }}
                  title={m.displayName || m.username}
                  onClick={() => setAssigneeFilter((p) => toggleSet(p, m.userId))}
                >
                  {(m.displayName || m.username).slice(0, 2).toUpperCase()}
                </span>
              ))}
            </div>
          </>
        )}
        {filterActive && (
          <button className="ghost small" onClick={() => { setSearch(''); setLabelFilter(new Set()); setAssigneeFilter(new Set()); }}>
            Clear
          </button>
        )}
      </div>
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
      {showHelp && <ShortcutsOverlay onClose={() => setShowHelp(false)} />}
      {!readOnly && (
        <button
          className="ghost small shortcuts-hint"
          onClick={() => setShowHelp(true)}
          title="Keyboard shortcuts (?)"
        >
          <kbd>?</kbd> shortcuts
        </button>
      )}
    </>
  );
}
