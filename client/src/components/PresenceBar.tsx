import { useBoardStore } from '../store.js';

export default function PresenceBar() {
  const presence = useBoardStore((s) => s.presence);
  const me = useBoardStore((s) => s.me);

  return (
    <div className="presence">
      <span style={{ color: 'var(--muted)', fontSize: 12, marginRight: 4 }}>
        {presence.length} online
      </span>
      {presence.map((u) => (
        <span
          key={u.socketId}
          className="avatar"
          style={{ background: u.color }}
          title={u.name + (u.socketId === me?.socketId ? ' (you)' : '')}
        >
          {u.name.slice(0, 2).toUpperCase()}
        </span>
      ))}
    </div>
  );
}
