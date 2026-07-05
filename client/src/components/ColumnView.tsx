import { useState } from 'react';
import type { Card, Column } from '../types.js';
import { getSocket } from '../socket.js';

interface Props {
  column: Column;
  cards: Card[];
}

export default function ColumnView({ column, cards }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

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
      <div className="column-body" data-column-id={column.id}>
        {cards.map((card) => (
          <div key={card.id} className="card">
            <div className="row">
              <span>{card.title}</span>
              <button className="del" onClick={() => deleteCard(card.id)} title="Delete">×</button>
            </div>
          </div>
        ))}
      </div>
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
