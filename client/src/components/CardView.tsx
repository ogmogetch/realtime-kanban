import type { Card, Label } from '../types.js';

interface Props {
  card: Card;
  labels: Label[];
  onOpen: (cardId: string) => void;
  isDragging?: boolean;
}

export default function CardView({ card, labels, onOpen, isDragging }: Props) {
  const cardLabels = card.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => !!l);

  const descPreview = card.description.trim();

  return (
    <div
      className={`card ${isDragging ? 'dragging' : ''}`}
      onClick={() => onOpen(card.id)}
    >
      {cardLabels.length > 0 && (
        <div className="card-labels">
          {cardLabels.map((l) => (
            <span
              key={l.id}
              className="label-pill"
              style={{ background: l.color }}
              title={l.name}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className="card-title">{card.title}</div>
      {descPreview && (
        <div className="card-desc-icon" title="Has description">
          <span>≡</span>
          <span>{descPreview.slice(0, 40)}{descPreview.length > 40 ? '…' : ''}</span>
        </div>
      )}
    </div>
  );
}
