interface Shortcut {
  keys: string;
  desc: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: '/', desc: 'Focus the card search bar' },
  { keys: 'N', desc: 'Add a card to the first column' },
  { keys: 'C', desc: 'Add a new column' },
  { keys: 'Enter', desc: 'Validate whatever add form you have open' },
  { keys: 'Esc', desc: 'Close this help, the card modal, or a popover' },
  { keys: '?', desc: 'Show / hide this help' },
];

export default function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-input" style={{ padding: '8px 10px' }}>Keyboard shortcuts</div>
          <button onClick={onClose} className="icon large">×</button>
        </div>
        <div className="modal-section">
          <ul className="shortcuts-list">
            {SHORTCUTS.map((s) => (
              <li key={s.keys}>
                <kbd>{s.keys}</kbd>
                <span>{s.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
