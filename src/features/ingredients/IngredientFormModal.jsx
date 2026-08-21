import { useEffect, useState } from 'react';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import { Field, Input, Select, ModalButton, cx } from '../../components/ui.jsx';
import { IconCheck, IconInfo, IconImage } from '../../components/icons.jsx';
import WafctSuggestion from './WafctSuggestion.jsx';
import { PRODUCT_GROUPS, PRODUCT_CATEGORIES, suggestTaxonomy } from '../../lib/wafctMatch.js';
import { useSettings } from '../../state/SettingsProvider.jsx';
import { WAFCT_SOURCE, MACRO_KEYS } from '../../lib/ingredients.js';

const MACRO_FIELDS = [
  ['calories', 'Calories', 'kcal'],
  ['protein_g', 'Protein', 'g'],
  ['carbs_g', 'Carbs', 'g'],
  ['fat_g', 'Fat', 'g'],
  ['fibre_g', 'Fibre', 'g'],
];

const BLANK = {
  name: '', description: '', unit: '', product_group: '', product_category: '',
  calories: '', protein_g: '', carbs_g: '', fat_g: '', fibre_g: '',
  image: null, imageUrl: '',
};

export default function IngredientFormModal({ open, onClose, onSubmit, editing }) {
  /* Unit choices follow Settings → Localization, so the two cannot disagree. */
  const { units: UNITS } = useSettings();
  const [form, setForm] = useState(BLANK);
  const [source, setSource] = useState({ source: null, source_code: null });
  const [applied, setApplied] = useState('');
  const [error, setError] = useState('');
  /* Not collected any more — carried so an edit cannot wipe a value
     that arrived from a CSV. */
  const [productUrl, setProductUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    setApplied(''); setError('');
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description || '',
        unit: editing.unit || '',
        product_group: editing.product_group || '',
        product_category: editing.product_category || '',
        ...Object.fromEntries(MACRO_KEYS.map((k) => [k, editing[k] ?? ''])),
        image: editing.image,
        imageUrl: editing.image && !editing.image.startsWith('data:') ? editing.image : '',
      });
      setSource({ source: editing.source, source_code: editing.source_code });
      setProductUrl(editing.product_url || '');
    } else {
      setForm(BLANK);
      setSource({ source: null, source_code: null });
      setProductUrl('');
    }
  }, [open, editing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setGroup = (group) =>
    setForm((f) => ({
      ...f,
      product_group: group,
      // A category from the old group would be invalid under the new one.
      product_category: (PRODUCT_CATEGORIES[group] || []).includes(f.product_category)
        ? f.product_category
        : '',
    }));

  const applyWafct = (food) => {
    const tax = suggestTaxonomy(food);
    setForm((f) => {
      const filled = [];
      const next = {
        ...f,
        // null stays blank — never coerced to 0.
        calories: food.kcal ?? '',
        protein_g: food.protein_g ?? '',
        carbs_g: food.carbs_g ?? '',
        fat_g: food.fat_g ?? '',
        fibre_g: food.fibre_g ?? '',
      };
      // Auto-pick only into empty fields; a choice already made stands.
      if (tax.group && !f.product_group) { next.product_group = tax.group; filled.push('group'); }
      if (tax.category && !f.product_category &&
          (PRODUCT_CATEGORIES[next.product_group] || []).includes(tax.category)) {
        next.product_category = tax.category;
        filled.push('category');
      }
      setApplied(
        `Filled from ${food.name} · ${WAFCT_SOURCE} (${food.food_id})` +
        (filled.length ? ` — product ${filled.join(' and ')} picked too` : '') +
        '. Every value is still editable.',
      );
      return next;
    });
    setSource({ source: WAFCT_SOURCE, source_code: food.food_id });
  };

  const applyEstimate = (res) => {
    setForm((f) => ({
      ...f,
      ...Object.fromEntries(MACRO_KEYS.map((k) => [k, res.macros[k] ?? ''])),
    }));
    setSource({ source: res.source, source_code: null });
    setApplied(
      `Filled from an AI estimate (${res.model}). This is a guess, not measured data — ` +
      'check it before relying on it. Every value is still editable.',
    );
  };

  const submit = () => {
    if (!form.name.trim()) return setError('Name is required');
    if (!form.product_group) return setError('Product Group is required');
    if (!form.product_category) return setError('Product Category is required');
    setError('');
    onSubmit({
      ...form,
      product_url: productUrl,
      image: form.imageUrl.trim() || form.image || null,
      ...source,
    });
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, image: ev.target.result, imageUrl: '' }));
    reader.readAsDataURL(file);
  };

  const preview = form.imageUrl.trim() || form.image;
  const categories = PRODUCT_CATEGORIES[form.product_group] || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="md"
      title={editing ? 'Edit Ingredient' : 'Create Ingredient'}
      subtitle={editing ? 'Update this ingredient. Nutrition stays per 100g.' : 'Add a single ingredient to the Akaani library.'}
    >
      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <div className="col-span-2 max-md:col-span-1">
          <Field label="Name" required>
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Boiled Yam, Egusi, Fresh Tomato"
              autoComplete="off"
            />
          </Field>
          <WafctSuggestion name={form.name} onApplyWafct={applyWafct} onApplyEstimate={applyEstimate} />
        </div>

        <Field label="Description" className="col-span-2 max-md:col-span-1">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="Short description (optional)" />
        </Field>

        <Field label="Unit" className="col-span-2 max-md:col-span-1">
          <Select value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            <option value="">Select a unit…</option>
            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            {/* A unit from a CSV that is not in the list must stay selectable. */}
            {form.unit && !UNITS.some((u) => u.value === form.unit) && (
              <option value={form.unit}>{form.unit} (imported)</option>
            )}
          </Select>
        </Field>

        {/* ── Nutrition ── */}
        <div className="col-span-2 rounded-xl border border-line bg-surface-2 px-4 pb-4 pt-3.5 max-md:col-span-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2.5">
            <span className="text-[12.5px] font-semibold text-ink">Nutrition (per 100g)</span>
            <span className="text-[11px] text-ink-3">All optional — can be filled in later</span>
          </div>
          <div className="mb-3 mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-2">
            <span className="mt-0.5 shrink-0 text-ink-3"><IconInfo /></span>
            <span>
              These are always <strong>per 100g</strong>, whatever the Unit above is set to — including
              ounces and pounds. Unit only describes how this ingredient is normally measured or logged;
              it never changes the basis of the values below.
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 max-md:grid-cols-2">
            {MACRO_FIELDS.map(([key, label, suffix]) => (
              <Field key={key} label={label} hint={suffix}>
                <Input
                  type="number" step="any" min="0" placeholder="—"
                  className="px-2.5 py-2 text-[12.5px]"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            ))}
          </div>
          {applied && (
            <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-mint-light px-2.5 py-2 text-[11.5px] font-medium text-mint-deep">
              <span className="mt-0.5 shrink-0"><IconCheck /></span>
              {applied}
            </div>
          )}
        </div>

        <Field label="Product Group" required>
          <Select value={form.product_group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">Select a product group…</option>
            {PRODUCT_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </Select>
        </Field>

        <Field label="Product Category" required>
          <Select value={form.product_category} onChange={(e) => set('product_category', e.target.value)}
            disabled={!form.product_group}>
            <option value="">{form.product_group ? 'Select a product category…' : 'Choose a product group first'}</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>

        {/* ── Image ── */}
        <Field label="Ingredient image" className="col-span-2 max-md:col-span-1">
          <div className="grid grid-cols-[180px_1fr] items-start gap-3 max-md:grid-cols-1">
            <label className="cursor-pointer rounded-xl border-[1.5px] border-dashed border-line bg-surface-2 px-3.5 py-4.5 text-center transition hover:border-mint hover:bg-[#F4FBF8]">
              {preview ? (
                <img src={preview} alt="" className="mx-auto max-h-[110px] rounded-xl object-cover" />
              ) : (
                <>
                  <div className="mb-1.5 flex justify-center text-ink-3"><IconImage size={22} /></div>
                  <div className="text-[13px] font-medium text-ink-2">Choose Image</div>
                  <div className="mt-0.5 text-[11.5px] text-ink-3">PNG or JPG</div>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-2">…or paste an image URL</label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value, image: null }))}
                placeholder="https://…/yam.jpg"
              />
              <div className="text-[11px] leading-relaxed text-ink-3">
                Both are optional. Whichever you set last is the one that gets saved.
              </div>
            </div>
          </div>
        </Field>
      </div>

      {error && <div className="mt-3 text-xs font-medium text-chili">{error}</div>}

      <ModalActions>
        <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
        <ModalButton onClick={submit}>{editing ? 'Save changes' : 'Submit'}</ModalButton>
      </ModalActions>
    </Modal>
  );
}
