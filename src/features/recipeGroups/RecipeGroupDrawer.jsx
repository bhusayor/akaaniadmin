import { useEffect, useState } from 'react';
import Drawer from '../../components/Drawer.jsx';
import { Button, Field, Input, Select, cx } from '../../components/ui.jsx';
import { IconTrash, IconPlus, IconImage, IconCheck } from '../../components/icons.jsx';
import { ChipSelect } from '../meals/formParts.jsx';
import { useSettings } from '../../state/SettingsProvider.jsx';
import {
  CURRENCIES, PLANS, MEAL_TYPES, GROUP_STATUSES,
  formatPrice, validateGroup, toNum,
} from '../../lib/recipeGroups.js';

const blank = (currency = 'USD') => ({
  name: '', description: '', image: null, currency, price: '', servings: '',
  plan: '', mealTypes: [], recipes: [], benefits: [''], status: 'draft',
});

export default function RecipeGroupDrawer({ open, group, recipeOptions, onClose, onSave }) {
  const { settings } = useSettings();
  const [form, setForm] = useState(() => blank(settings.localization.currency));
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!open) return;
    setErrors([]);
    setForm(group
      ? {
          ...group,
          price: group.price ?? '',
          servings: group.servings ?? '',
          benefits: group.benefits.length ? [...group.benefits] : [''],
        }
      // A new bundle starts in the currency chosen in Settings → Localization.
      : blank(settings.localization.currency));
  }, [open, group, settings.localization.currency]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setBenefit = (i, v) => set('benefits', form.benefits.map((b, n) => (n === i ? v : b)));
  const addBenefit = () => set('benefits', [...form.benefits, '']);
  const removeBenefit = (i) => set('benefits', form.benefits.filter((_, n) => n !== i));

  const pickImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => set('image', e.target.result);
    reader.readAsDataURL(file);
  };

  const save = () => {
    const problems = validateGroup(form);
    setErrors(problems);
    if (problems.length) return;
    onSave({ ...form, benefits: form.benefits.filter((b) => b.trim()) });
  };

  const price = toNum(form.price);
  const perRecipe = price !== null && form.recipes.length ? price / form.recipes.length : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={group ? 'Edit recipe group' : 'New recipe group'}
      subtitle={group ? 'Update the details of this bundle' : 'Bundle recipes to sell on the site'}
      footer={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-[12px] text-ink-3">
            {form.recipes.length
              ? <>{form.recipes.length} recipes · {formatPrice(perRecipe, form.currency)} per recipe</>
              : 'No recipes added yet'}
          </div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}><IconCheck size={13} stroke={2.5} /> {group ? 'Save changes' : 'Create group'}</Button>
        </div>
      }
    >
      {errors.length > 0 && (
        <div className="mb-4 rounded-xl border border-chili/30 bg-chili-light px-4 py-3">
          <div className="text-[13px] font-semibold text-chili-deep">
            {errors.length} field{errors.length === 1 ? '' : 's'} need attention
          </div>
          <ul className="mt-1 list-inside list-disc text-[12.5px] text-chili-deep">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <span className="text-xs font-medium text-ink-2">Cover image</span>
          <div className="relative mt-1.5 overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
            {form.image ? (
              <>
                <img src={form.image} alt="" className="h-44 w-full object-cover" />
                <button type="button" onClick={() => set('image', null)} title="Remove image"
                  className="absolute bottom-3 right-3 grid size-9 cursor-pointer place-items-center rounded-full bg-chili text-white shadow-mid transition hover:opacity-85">
                  <IconTrash size={14} />
                </button>
              </>
            ) : (
              <label className="grid h-32 cursor-pointer place-items-center text-[13px] text-ink-3 transition hover:text-forest">
                <span className="flex flex-col items-center gap-1.5"><IconImage size={22} /> Choose an image</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => pickImage(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>

        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Mama Put Macros" />
        </Field>

        <Field label="Description">
          <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="What the bundle is and who it is for"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Currency" required>
            <Select value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Price" required hint={price !== null ? formatPrice(price, form.currency) : ''}>
            <Input type="number" step="0.01" min="0" value={form.price}
              onChange={(e) => set('price', e.target.value)} placeholder="4.99" />
          </Field>
          <Field label="Servings" required>
            <Input type="number" min="1" value={form.servings}
              onChange={(e) => set('servings', e.target.value)} placeholder="5" />
          </Field>
          <Field label="Plan" required>
            <Select value={form.plan} onChange={(e) => set('plan', e.target.value)}>
              <option value="">Select a plan…</option>
              {PLANS.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Meal types" required>
          <ChipSelect options={MEAL_TYPES} value={form.mealTypes}
            onChange={(v) => set('mealTypes', v)} placeholder="Select meal types…" />
        </Field>

        <Field label="Recipes" required hint={`${form.recipes.length} in this bundle`}>
          <ChipSelect options={recipeOptions} value={form.recipes} capitalize={false}
            onChange={(v) => set('recipes', v)} placeholder="Add recipes to the bundle…" />
        </Field>

        <div>
          <span className="text-xs font-medium text-ink-2">Benefits <span className="text-chili">*</span></span>
          <div className="mt-1.5 flex flex-col gap-2">
            {form.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={b} onChange={(e) => setBenefit(i, e.target.value)}
                  placeholder="e.g. High protein per serving" />
                <button type="button" onClick={() => removeBenefit(i)} title="Remove"
                  disabled={form.benefits.length === 1}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-chili transition hover:bg-chili-light disabled:cursor-not-allowed disabled:opacity-30">
                  <IconTrash size={13} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addBenefit}
              className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg px-1 py-1 text-[12.5px] font-medium text-mint transition hover:text-forest">
              <IconPlus /> Add benefit
            </button>
          </div>
        </div>

        <Field label="Status" hint="only live bundles appear on the site">
          <div className="flex gap-0.5 rounded-lg bg-canvas p-0.5">
            {GROUP_STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => set('status', s)}
                className={cx('flex-1 cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] capitalize transition',
                  form.status === s ? 'bg-surface font-semibold text-ink shadow-soft' : 'font-medium text-ink-3 hover:text-ink')}>
                {s}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Drawer>
  );
}
