import { useEffect } from 'react';
import { useBoardStore } from '../store.js';
import { getSocket } from '../socket.js';

export default function RemoteCursors() {
  const cursors = useBoardStore((s) => s.cursors);
  const presence = useBoardStore((s) => s.presence);
  const me = useBoardStore((s) => s.me);

  useEffect(() => {
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    let dirty = false;

    function onMove(e: MouseEvent) {
      lastX = e.clientX;
      lastY = e.clientY;
      dirty = true;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          if (dirty) {
            getSocket().emit('cursor:move', { x: lastX, y: lastY });
            dirty = false;
          }
          raf = 0;
        });
      }
    }

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {Object.values(cursors).map((c) => {
        if (c.socketId === me?.socketId) return null;
        const user = presence.find((u) => u.socketId === c.socketId);
        if (!user) return null;
        return (
          <div
            key={c.socketId}
            className="remote-cursor"
            style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
          >
            <svg viewBox="0 0 24 24" fill={user.color}>
              <path d="M4 2l6 18 3-7 7-3z" />
            </svg>
            <span className="label" style={{ background: user.color }}>{user.name}</span>
          </div>
        );
      })}
    </>
  );
}
