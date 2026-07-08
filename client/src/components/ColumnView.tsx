import { useEffect, useRef, useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Column, Label } from '../types.js';
import { getSocket } from '../socket.js';
import CardView from './CardView.js';

interface Props {
  column: Column;
  cards: Card[];
  labels: Label[];
  onOpenCard: (cardId: string) => void;
  readOnly?: boolean;
}

export default function ColumnView({ column, cards, labels, onOpenCard, readOnly }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, disabled: readOnly });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: column.id });

  useEffect(() => {
    if (editingTitle) {
      setTitleDraft(column.title);
      requestAnimationFrame(() => titleInputRef.current?.select());
    }
  }, [editingTitle, column.title]);

  function addCard() {
    const t = title.trim();
    if (!t) return;
    getSocket().emit('card:create', { columnId: column.id, title: t }, () => {});
    setTitle('');
    setAdding(false);
  }

  function removeColumn() {
    if (!confirm(`Delete column "${column.title}" and all its cards?`)) return;
    getSocket().emit('column:delete', { columnId: column.id }, () => {});
  }

  function commitTitle() {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next || next === column.title) return;
    getSocket().emit('column:update', { columnId: column.id, title: next }, () => {});
  }

  const columnStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setSortableRef} style={columnStyle} className="column">
      <div className="column-title">
        {editingTitle && !readOnly ? (
          <input
            ref={titleInputRef}
            className="column-title-edit"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') { setTitleDraft(column.title); setEditingTitle(false); }
            }}
            maxLength={80}
          />
        ) : (
          <>
            <span
              className="column-drag-handle"
              {...attributes}
              {...listeners}
              title="Drag column"
              aria-label="Drag column"
            >⋮⋮</span>
            <span
              className="column-title-text"
              onClick={() => !readOnly && setEditingTitle(true)}
              title={readOnly ? column.title : 'Click to rename'}
            >
              {column.title}
            </span>
          </>
        )}
        <div className="column-title-actions">
          <span className="count">{cards.length}</span>
          {!readOnly && <button className="icon" onClick={removeColumn} title="Delete column">×</button>}
        </div>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setDroppableRef}
          className={`column-body ${isOver ? 'dragging-over' : ''}`}
        >
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} labels={labels} onOpen={onOpenCard} readOnly={readOnly} />
          ))}
        </div>
      </SortableContext>
      {!readOnly && (
        adding ? (
          <div className="inline-form vertical">
            <textarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(); }
                if (e.key === 'Escape') { setAdding(false); setTitle(''); }
              }}
            />
            <div className="row">
              <button className="primary small" onClick={addCard}>Add card</button>
              <button className="ghost small" onClick={() => { setAdding(false); setTitle(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="add-card" onClick={() => setAdding(true)}>+ Add a card</button>
        )
      )}
    </div>
  );
}

function SortableCard({ card, labels, onOpen, readOnly }: { card: Card; labels: Label[]; onOpen: (id: string) => void; readOnly?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: readOnly,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(readOnly ? {} : listeners)}>
      <CardView card={card} labels={labels} onOpen={onOpen} isDragging={isDragging} />
    </div>
  );
}
