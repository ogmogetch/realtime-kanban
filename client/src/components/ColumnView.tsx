import { useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Column } from '../types.js';
import { getSocket } from '../socket.js';

interface Props {
  column: Column;
  cards: Card[];
}

export default function ColumnView({ column, cards }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  function addCard() {
    const t = title.trim();
    if (!t) return;
    getSocket().emit('card:create', { columnId: column.id, title: t }, () => {});
    setTitle('');
    setAdding(false);
  }

  function deleteCard(cardId: string) {
    getSocket().emit('card:delete', { cardId }, () => {});
  }

  return (
    <div className="column">
      <div className="column-title">
        <span>{column.title}</span>
        <span className="count">{cards.length}</span>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`column-body ${isOver ? 'dragging-over' : ''}`}
        >
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onDelete={deleteCard} />
          ))}
        </div>
      </SortableContext>
      {adding ? (
        <div className="inline-form">
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Card title"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCard();
              if (e.key === 'Escape') { setAdding(false); setTitle(''); }
            }}
          />
          <button className="primary" onClick={addCard}>Add</button>
        </div>
      ) : (
        <button className="add-card" onClick={() => setAdding(true)}>+ Add card</button>
      )}
    </div>
  );
}

function SortableCard({ card, onDelete }: { card: Card; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="row">
        <span>{card.title}</span>
        <button
          className="del"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}
