import { useState } from 'react';
import { IconImage, IconTrash } from './icons.jsx';
import { Spinner, cx } from './ui.jsx';

/* A picked file is held as a data URL. Left at full size a phone photo is
   several megabytes of base64, so anything larger than this is redrawn at
   MAX_EDGE before being stored. The resize is announced, not silent. */
const INLINE_LIMIT_BYTES = 300 * 1024;
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.82;

const approxBytes = (dataUrl) => Math.round(((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 3) / 4);

export const formatBytes = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(String(e.target.result));
  reader.onerror = () => reject(new Error('That file could not be read.'));
  reader.readAsDataURL(file);
});

/** Redraws a data URL at no more than MAX_EDGE on its longest side. */
const downscale = (dataUrl) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    if (scale === 1) return resolve(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    // A JPEG has no alpha; fill first so transparency does not come out black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
  };
  img.onerror = () => reject(new Error('That file is not an image this browser can read.'));
  img.src = dataUrl;
});

/**
 * Choose-an-image control, shared by the meal form and the platform
 * ingredient form so the two behave identically.
 *
 * `value` is whatever string the record holds — an https URL from the
 * platform, or a data URL from a file picked here — and `onChange` is
 * called with the new string, or null when the image is removed.
 *
 * NOTE ON STORAGE: a picked file is kept as a data URL, which is what the
 * meal form has always done. For a record that is saved to platform-api
 * that string is what lands in its `image` field, because the API has no
 * upload route: it stores the string verbatim. Swap `readFile` for a call
 * to an upload endpoint, returning its URL, when one exists.
 */
export default function ImagePicker({
  value, onChange, label = 'Image', hint, disabled,
  emptyHeight = 'h-40', previewHeight = 'h-64',
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const readFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const original = await readAsDataUrl(file);
      const stored = file.size > INLINE_LIMIT_BYTES ? await downscale(original) : original;
      const size = approxBytes(stored);
      onChange(stored);
      setNote(stored === original
        ? `${file.name} · ${formatBytes(size)}`
        : `${file.name} · resized to ${MAX_EDGE}px, ${formatBytes(size)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    onChange(null);
    setNote('');
    setError('');
  };

  return (
    <div>
      <span className="text-xs font-medium text-ink-2">
        {label}
        {hint && <span className="ml-1 text-[10px] font-normal text-ink-3">{hint}</span>}
      </span>
      <div className="relative mt-1.5 overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
        {value ? (
          <>
            <img src={value} alt="" className={cx('w-full object-cover', previewHeight)} />
            <button type="button" onClick={clear} title="Remove image" disabled={disabled}
              className="absolute bottom-3 right-3 grid size-9 cursor-pointer place-items-center rounded-full bg-chili text-white shadow-mid transition hover:opacity-85">
              <IconTrash size={14} />
            </button>
          </>
        ) : (
          <label className={cx('grid cursor-pointer place-items-center text-[13px] text-ink-3 transition hover:text-forest', emptyHeight)}>
            <span className="flex flex-col items-center gap-1.5">
              {busy ? <Spinner /> : <IconImage size={22} />}
              {busy ? 'Reading…' : 'Choose an image'}
            </span>
            <input type="file" accept="image/*" className="hidden" disabled={disabled || busy}
              onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {note && <div className="mt-1 text-[11px] text-ink-3">{note}</div>}
      {error && <div role="alert" className="mt-1 text-[11.5px] font-medium text-chili">{error}</div>}
    </div>
  );
}
