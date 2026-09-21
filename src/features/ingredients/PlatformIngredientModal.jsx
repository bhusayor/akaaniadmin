import { useEffect, useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { Field, Input, ModalButton, Select, Spinner } from '../../components/ui.jsx';
import { IconInfo } from '../../components/icons.jsx';
import ImagePicker from '../../components/ImagePicker.jsx';
import NameSuggest from './NameSuggest.jsx';
import usePlatformLookups from './usePlatformLookups.js';
import {
  createIngredient, updateIngredient, ingredientFromApi, ingredientToApi, isForbidden,
} from '../../lib/api.js';

const BLANK = {
  name: '', description: '', unit: '', product_group: '', product_category: '', image: '', product_url: '',
};

export const NOT_ALLOWED =
  'Your account is not allowed to change platform ingredients — the backend only lets staff and admin accounts do that.';

/** A select over a lookup list that still shows the current value if the list lacks it. */
function LookupSelect({ value, current, options, placeholder, onChange, disabled }) {
  const missing = value && !options.some((o) => String(o._id) === value);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o._id} value={String(o._id)}>{o.name}</option>)}
      {missing && <option value={value}>{current?.name || value}</option>}
    </Select>
  );
}

/**
 * Create or edit an ingredient in platform-api's catalogue.
 * `onSaved(row)` receives the saved record, already mapped for the table.
 */
export default function PlatformIngredientModal({ open, editing, onClose, onSaved }) {
  const lookups = usePlatformLookups(open);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    setForm(editing ? {
      name: editing.name,
      description: editing.description,
      unit: editing.unit.id,
      product_group: editing.product_group.id,
      product_category: editing.product_category.id,
      image: editing.image,
      product_url: editing.product_url,
    } : BLANK);
  }, [open, editing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const loading = lookups.status === 'loading';

  const submit = async () => {
    // The backend requires all four on create.
    if (!form.name.trim()) return setError('Name is required');
    if (!form.unit) return setError('Unit is required');
    if (!form.product_group) return setError('Product group is required');
    if (!form.product_category) return setError('Product category is required');
    setError('');
    setSaving(true);
    try {
      const body = ingredientToApi(form);
      const saved = editing
        ? await updateIngredient(editing.id, body)
        : await createIngredient(body);
      onSaved(ingredientFromApi(saved), editing ? 'updated' : 'created');
    } catch (err) {
      setError(isForbidden(err) ? NOT_ALLOWED : err.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="md"
      title={editing ? 'Edit platform ingredient' : 'Create platform ingredient'}
      subtitle="Saved to the Akaani platform, where meals and partners use it."
    >
      {lookups.status === 'error' && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-chili-light px-3 py-2 text-[12.5px] text-chili-deep">
          Could not load units and product groups: {lookups.error.message}
          <button type="button" onClick={lookups.retry} className="cursor-pointer font-semibold underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <div className="col-span-2 max-md:col-span-1">
          <Field label="Name" required>
            <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Dried Mango" autoComplete="off" />
          </Field>
          <NameSuggest value={form.name} excludeId={editing?.id} onPick={(name) => set('name', name)} />
        </div>

        <Field label="Description" className="col-span-2 max-md:col-span-1">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="Short description (optional)" />
        </Field>

        <Field label="Unit" required hint={loading ? 'loading…' : undefined}>
          <LookupSelect value={form.unit} current={editing?.unit} options={lookups.units}
            placeholder="Select a unit…" disabled={loading} onChange={(v) => set('unit', v)} />
        </Field>

        <Field label="Product group" required>
          <LookupSelect value={form.product_group} current={editing?.product_group} options={lookups.groups}
            placeholder="Select a product group…" disabled={loading} onChange={(v) => set('product_group', v)} />
        </Field>

        <Field label="Product category" required className="col-span-2 max-md:col-span-1">
          <LookupSelect value={form.product_category} current={editing?.product_category} options={lookups.categories}
            placeholder="Select a product category…" disabled={loading} onChange={(v) => set('product_category', v)} />
        </Field>

        <div className="col-span-2 max-md:col-span-1">
          <ImagePicker
            label="Ingredient image"
            hint="optional"
            value={form.image}
            onChange={(v) => set('image', v || '')}
            emptyHeight="h-28"
            previewHeight="h-44"
          />
        </div>

        <Field label="Product URL" className="col-span-2 max-md:col-span-1">
          <Input value={form.product_url} onChange={(e) => set('product_url', e.target.value)} placeholder="https://…" />
        </Field>
      </div>

      <div className="mt-3.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
        <span className="mt-0.5 shrink-0"><IconInfo /></span>
        <span>
          Platform ingredients carry no nutrition values — per-100g figures live in the Nutrition data tab.
          A picked image is stored inline on the record, since the API has no upload route yet.
          {editing && ' Clearing an optional field here leaves its saved value unchanged.'}
        </span>
      </div>

      {error && <div role="alert" className="mt-3 text-xs font-medium text-chili">{error}</div>}

      <ModalActions>
        <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
        <ModalButton onClick={submit} disabled={saving || loading}>
          {saving ? <><Spinner /> Saving…</> : editing ? 'Save changes' : 'Create'}
        </ModalButton>
      </ModalActions>
    </Modal>
  );
}
