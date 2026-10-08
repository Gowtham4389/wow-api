import Modal from '../common/Modal.jsx';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
const MOD = IS_MAC ? '⌘' : 'Ctrl';

const SHORTCUTS = [
  { keys: `${MOD} + Enter`, label: 'Send the request' },
  { keys: `${MOD} + S`, label: 'Save the request' },
  { keys: `${MOD} + G`, label: 'Generate request code' },
  { keys: `${MOD} + K`, label: 'Focus the URL field' },
  { keys: `${MOD} + I`, label: 'Import a cURL command' },
  { keys: `${MOD} + B`, label: 'Toggle the sidebar' },
  { keys: `${MOD} + J`, label: 'Toggle light and dark mode' },
  { keys: 'Escape', label: 'Close the open dialog, or cancel a running request' },
  { keys: 'Enter / Shift + Enter', label: 'Next or previous search match (in the response search field)' },
];

export function ShortcutsModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" width={520}>
      <div className="shortcuts">
        {SHORTCUTS.map((shortcut) => (
          <div className="shortcuts__row" key={shortcut.keys}>
            <span>{shortcut.label}</span>
            <kbd>{shortcut.keys}</kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default ShortcutsModal;
