import { useBoardStore } from '../store.js';
import { extractUrls } from '../utils/autolink.js';
import type { Card, Label } from '../types.js';

interface Props {
  card: Card;
  labels: Label[];
  onOpen: (cardId: string) => void;
  isDragging?: boolean;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function CardView({ card, labels, onOpen, isDragging }: Props) {
  const members = useBoardStore((s) => s.members);
  const cardLabels = card.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => !!l);

  const assignees = card.assigneeIds
    .map((id) => members.find((m) => m.userId === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  const descPreview = card.description.trim();
  const linkCount = extractUrls(card.description).length;

  const style: React.CSSProperties = card.color
    ? { background: card.color, borderLeft: `4px solid ${card.color}`, backgroundImage: `linear-gradient(180deg, ${card.color}22, transparent 40%)` }
    : {};

  return (
    <div
      className={`card ${isDragging ? 'dragging' : ''}`}
      onClick={() => onOpen(card.id)}
      style={style}
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
      <div className="card-meta-row">
        {linkCount > 0 && (
          <span className="card-badge" title={`${linkCount} link${linkCount > 1 ? 's' : ''}`}>
            🔗 {linkCount}
          </span>
        )}
      </div>
      {assignees.length > 0 && (
        <div className="card-assignees">
          {assignees.slice(0, 4).map((a) => (
            <span
              key={a.userId}
              className="avatar small"
              style={{ background: a.avatarColor }}
              title={a.displayName || a.username}
            >
              {initials(a.displayName || a.username)}
            </span>
          ))}
          {assignees.length > 4 && (
            <span className="avatar small more" title={`${assignees.length - 4} more`}>
              +{assignees.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
