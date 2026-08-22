import { useEffect, useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { ModalButton, Input } from '../../components/ui.jsx';
import { IconWarning } from '../../components/icons.jsx';

const PHRASE = 'DELETE ALL';

/* Emptying the list is one click away from the import button, and there is
   no undo — so it asks for the phrase to be typed rather than accepting a
   click that could have been a mis-aim. */
export default function ClearMealsModal({ open, count, onClose, onConfirm }) {
  const [typed, setTyped] = useState('');

  useEffect(() => { if (open) setTyped(''); }, [open]);

  const armed = typed.trim().toUpperCase() === PHRASE;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete every meal?"
      subtitle={`All ${count} meal${count === 1 ? '' : 's'} will be removed. This cannot be undone.`}
    >
      <div className="px-1 pb-1">
        <div className="mb-3.5 flex items-start gap-2.5 rounded-lg bg-chili-light px-3.5 py-3">
          <span className="mt-px shrink-0 text-chili-deep"><IconWarning /></span>
          <div className="text-[12.5px] leading-relaxed text-chili-deep">
            Recipes, ingredients and steps go with them. Export first if you
            might want any of it back.
          </div>
        </div>

        <label className="text-xs font-medium text-ink-2">
          Type <strong className="font-semibold text-ink">{PHRASE}</strong> to confirm
        </label>
        <Input
          className="mt-1.5"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && armed) onConfirm(); }}
          placeholder={PHRASE}
          autoFocus
        />
      </div>

      <ModalActions>
        <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
        <ModalButton variant="danger" onClick={onConfirm} disabled={!armed}>
          Delete {count} meal{count === 1 ? '' : 's'}
        </ModalButton>
      </ModalActions>
    </Modal>
  );
}
