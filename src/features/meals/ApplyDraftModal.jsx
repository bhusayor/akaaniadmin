import Modal, { ModalActions } from '../../components/Modal.jsx';
import { ModalButton } from '../../components/ui.jsx';
import { IconWarning } from '../../components/icons.jsx';

/* The spec requires an explicit confirmation before generated values
   replace anything the user typed. Only fields that actually differ and
   are actually filled are listed — warning about blanks would train people
   to click straight through the warning that matters. */
export default function ApplyDraftModal({ open, conflicts, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Replace what you have typed?"
      subtitle={`${conflicts.length} field${conflicts.length === 1 ? '' : 's'} in the form differ${conflicts.length === 1 ? 's' : ''} from the draft.`}
      width="md"
    >
      <div className="px-1 pb-1">
        <div className="mb-3 flex items-start gap-2.5 rounded-lg bg-amber-light px-3.5 py-3">
          <span className="mt-px shrink-0 text-amber-deep"><IconWarning /></span>
          <div className="text-[12.5px] leading-relaxed text-amber-deep">
            Applying overwrites these with the Studio draft. Everything else is left alone,
            and nothing is saved either way.
          </div>
        </div>

        <div className="max-h-52 overflow-y-auto rounded-lg border border-line">
          {conflicts.map((c) => (
            <div key={c.key} className="border-b border-line-light px-3 py-2 text-[12.5px] text-ink last:border-0">
              {c.label}
            </div>
          ))}
        </div>
      </div>

      <ModalActions>
        <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
        <ModalButton onClick={onConfirm}>Replace {conflicts.length} field{conflicts.length === 1 ? '' : 's'}</ModalButton>
      </ModalActions>
    </Modal>
  );
}
