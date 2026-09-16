import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import { Button, Card, EmptyState, Field, Input, Select, cx } from '../components/ui.jsx';
import { IconTrash, IconImage } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useMeals } from '../state/MealsProvider.jsx';
import { ALL_TAGS, BLANK_MEAL } from '../data/meals.js';
import { PRODUCT_GROUPS } from '../lib/taxonomy.js';
import { Section, ChipSelect, StringRows, CATEGORIES } from '../features/meals/formParts.jsx';
import IngredientRows from '../features/meals/IngredientRows.jsx';
import CookingSteps from '../features/meals/CookingSteps.jsx';
import MealNutritionCalc from '../features/meals/MealNutritionCalc.jsx';

const TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa'];

const num = (v) => {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

const textareaCls =
  'w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink ' +
  'outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8';

function toForm(m) {
  return {
    image: m.image ?? null,
    name: m.name ?? '',
    videoUrl: m.videoUrl ?? '',
    notificationMessage: m.notificationMessage ?? '',
    description: m.description ?? '',
    luTips: m.luTips ?? '',
    types: m.types ?? [m.type],
    category: m.category ?? '',
    tags: [...(m.tags ?? [])],
    countries: [...(m.countries ?? [])],
    prep: m.prep ?? '',
    servings: m.servings ?? '',
    cal: m.cal ?? '',
    calPerServing: m.servings ? Math.round(m.cal / m.servings) : '',
    healthConditions: [...(m.healthConditions ?? [])],
    nutrients: (m.nutrients ?? []).map((n) => ({ ...n })),
    fat: m.fat ?? '', carb: m.carb ?? '', prot: m.prot ?? '', fiber: m.fiber ?? '',
    productGroup: m.productGroup ?? '',
    ingredients: (m.ingredients ?? []).map((i) => ({ ...i })),
    foodItems: [...(m.foodItems ?? [])],
    instructions: (m.instructions ?? []).map((s) => ({ ...s })),
    portion: m.portion ?? '',
  };
}

export default function MealEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { getMeal, createMeal, updateMeal } = useMeals();

  /* `/meals/new` renders the same form against a blank record, so there is
     one meal form rather than two that drift apart. */
  const isNew = id === undefined;
  const meal = isNew ? null : getMeal(id);
  const source = isNew ? BLANK_MEAL : meal;

  const [form, setForm] = useState(() => (source ? toForm(source) : null));
  const [errors, setErrors] = useState([]);
  const initial = useRef(form ? JSON.stringify(form) : '');

  useTopbar(isNew ? 'New Meal' : 'Edit Meal');

  /* Total ÷ servings drives per-serving, so the two cannot drift apart. */
  useEffect(() => {
    if (!form) return;
    const total = num(form.cal);
    const servings = num(form.servings);
    const derived = total !== null && servings ? String(Math.round(total / servings)) : '';
    if (String(form.calPerServing) !== derived) {
      setForm((f) => ({ ...f, calPerServing: derived }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.cal, form?.servings]);

  const dirty = useMemo(
    () => (form ? JSON.stringify(form) !== initial.current : false),
    [form],
  );

  /* A new meal has no record to find — only a missing *existing* one is
     an error. */
  if ((!isNew && !meal) || !form) {
    return (
      <div className="px-7 py-5 max-md:px-4">
        <Card>
          <EmptyState icon="🍽️" title="Meal not found" sub="It may have been deleted." />
          <div className="flex justify-center pb-8">
            <Button onClick={() => navigate('/meals')}>Back to meals</Button>
          </div>
        </Card>
      </div>
    );
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => set('image', e.target.result);
    reader.readAsDataURL(file);
  };

  const save = () => {
    const problems = [];
    if (!form.name.trim()) problems.push('Name is required');
    if (!form.description.trim()) problems.push('Description is required');
    if (!form.types.length) problems.push('At least one Type is required');
    if (!form.tags.length) problems.push('At least one Tag is required');
    if (!form.countries.length) problems.push('At least one Country is required');
    if (num(form.prep) === null) problems.push('Cook Time is required');
    if (num(form.fat) === null) problems.push('Fat is required');
    if (num(form.carb) === null) problems.push('Carbohydrate is required');
    if (num(form.prot) === null) problems.push('Protein is required');
    setErrors(problems);
    if (problems.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    /* One payload, whichever way it is written — a create path that built
       its own object would drift from the edit path field by field. */
    const payload = {
      image: form.image,
      name: form.name.trim(),
      videoUrl: form.videoUrl.trim(),
      notificationMessage: form.notificationMessage.trim(),
      description: form.description.trim(),
      luTips: form.luTips.trim(),
      types: form.types,
      type: form.types[0],
      category: form.category,
      tags: form.tags,
      countries: form.countries,
      prep: num(form.prep),
      servings: num(form.servings),
      cal: num(form.cal),
      healthConditions: form.healthConditions.filter(Boolean),
      nutrients: form.nutrients.filter((n) => n.name?.trim()),
      fat: num(form.fat), carb: num(form.carb), prot: num(form.prot), fiber: num(form.fiber),
      productGroup: form.productGroup,
      ingredients: form.ingredients.filter((i) => i.name?.trim()),
      foodItems: form.foodItems.filter(Boolean),
      instructions: form.instructions.filter((s) => s.text?.trim()),
      portion: form.portion.trim(),
    };

    const savedId = isNew ? createMeal(payload).id : (updateMeal(meal.id, payload), meal.id);
    toast(isNew ? 'Meal created' : 'Meal saved');
    navigate(`/meals/${savedId}`);
  };

  const cancel = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    navigate(isNew ? '/meals' : `/meals/${meal.id}`);
  };

  return (
    <>
      {/* Save bar — sticky, so you never scroll a form this long to commit it. */}
      <div className="sticky top-[60px] z-15 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-7 pt-4 pb-3 max-md:static max-md:px-4">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-ink">
            {isNew ? (form.name.trim() || 'New meal') : meal.name}
          </div>
          <div className="text-[11.5px] text-ink-3">
            {isNew
              ? (dirty ? 'Not saved yet' : 'Fill in the details below')
              : (dirty ? 'Unsaved changes' : 'No changes yet')}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button onClick={save} disabled={!isNew && !dirty}>
            {isNew ? 'Create meal' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1100px] px-7 py-5 max-md:px-4">
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

        <Card className="px-6 py-2 max-md:px-4">
          {/* ── DETAILS ── */}
          <Section title="Details" defaultOpen>
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs font-medium text-ink-2">Meal image</span>
                <div className="relative mt-1.5 overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
                  {form.image ? (
                    <>
                      <img src={form.image} alt="" className="h-64 w-full object-cover" />
                      <button type="button" onClick={() => set('image', null)} title="Remove image"
                        className="absolute bottom-3 right-3 grid size-9 cursor-pointer place-items-center rounded-full bg-chili text-white shadow-mid transition hover:opacity-85">
                        <IconTrash size={14} />
                      </button>
                    </>
                  ) : (
                    <label className="grid h-40 cursor-pointer place-items-center text-[13px] text-ink-3 transition hover:text-forest">
                      <span className="flex flex-col items-center gap-1.5">
                        <IconImage size={22} />
                        Choose an image
                      </span>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => pickImage(e.target.files?.[0])} />
                    </label>
                  )}
                </div>
              </div>

              <Field label="Name" required>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
              </Field>

              <Field label="Video URL">
                <Input value={form.videoUrl} placeholder="https://…"
                  onChange={(e) => set('videoUrl', e.target.value)} />
              </Field>

              <Field label="Notification message">
                <textarea rows={3} className={textareaCls} value={form.notificationMessage}
                  onChange={(e) => set('notificationMessage', e.target.value)} />
              </Field>

              <Field label="Description" required>
                <textarea rows={4} className={textareaCls} value={form.description}
                  onChange={(e) => set('description', e.target.value)} />
              </Field>

              <Field label="Lu tips">
                <textarea rows={4} className={textareaCls} value={form.luTips} placeholder="Lu Tips"
                  onChange={(e) => set('luTips', e.target.value)} />
              </Field>

              <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                <Field label="Type" required>
                  <ChipSelect options={TYPES} value={form.types} onChange={(v) => set('types', v)} />
                </Field>
                <Field label="Category">
                  <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
                    <option value="">Select…</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Tags" required>
                  <ChipSelect options={ALL_TAGS.map((t) => t.name)} value={form.tags}
                    onChange={(v) => set('tags', v)} />
                </Field>
                <Field label="Countries" required>
                  <ChipSelect options={COUNTRIES} value={form.countries}
                    onChange={(v) => set('countries', v)} />
                </Field>
              </div>

              <Field label="Cook time" required hint="minutes">
                <Input type="number" min="0" value={form.prep} onChange={(e) => set('prep', e.target.value)} />
              </Field>

              <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
                <Field label="No. of servings">
                  <Input type="number" min="1" value={form.servings}
                    onChange={(e) => set('servings', e.target.value)} />
                </Field>
                <Field label="Total calories" hint="kcal">
                  <Input type="number" min="0" value={form.cal}
                    onChange={(e) => set('cal', e.target.value)} />
                </Field>
                <Field label="Calories per serving" hint="calculated">
                  <Input value={form.calPerServing} readOnly tabIndex={-1}
                    className="cursor-not-allowed bg-surface-2 text-ink-2" />
                </Field>
              </div>

              <Field label="Portion per serving">
                <Input value={form.portion} placeholder="e.g. 1 bowl"
                  onChange={(e) => set('portion', e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* ── HEALTH ── */}
          <Section title="Incompatible medical conditions" count={form.healthConditions.length}>
            <p className="mb-3 text-[12.5px] leading-relaxed text-ink-3">
              Clinical guidance shown to users with the matching condition. Author this with a
              nutritionist — it is advice, not copy.
            </p>
            <StringRows items={form.healthConditions} onChange={(v) => set('healthConditions', v)}
              placeholder="e.g. Adjust salt for individuals with high blood pressure"
              emptyLabel="Add the first condition" />
          </Section>

          {/* ── NUTRIENTS ── */}
          <Section title="Nutrients" count={form.nutrients.length}>
            <div className="flex flex-col gap-2">
              {form.nutrients.map((n, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_120px_auto] gap-2 max-sm:grid-cols-1">
                  <Input value={n.name} placeholder="Vitamin A"
                    onChange={(e) => set('nutrients', form.nutrients.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
                  <Input value={n.amount ?? ''} placeholder="Amount"
                    onChange={(e) => set('nutrients', form.nutrients.map((x, k) => k === i ? { ...x, amount: e.target.value } : x))} />
                  <Input value={n.unit ?? ''} placeholder="mg"
                    onChange={(e) => set('nutrients', form.nutrients.map((x, k) => k === i ? { ...x, unit: e.target.value } : x))} />
                  <button type="button" onClick={() => set('nutrients', form.nutrients.filter((_, k) => k !== i))}
                    className="grid size-9 cursor-pointer place-items-center rounded-md text-chili transition hover:bg-chili-light">
                    <IconTrash size={14} />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => set('nutrients', [...form.nutrients, { name: '', amount: '', unit: '' }])}
                className="w-full cursor-pointer rounded-xl border border-dashed border-line py-3 text-[13px] text-ink-3 transition hover:border-mint hover:text-forest">
                + Add nutrient
              </button>
            </div>
          </Section>

          {/* ── MACROS ── */}
          <Section title="Macronutrients" defaultOpen>
            <MealNutritionCalc
              rows={form.ingredients}
              servings={form.servings}
              onApply={(patch) => {
                setForm((f) => ({ ...f, ...patch }));
                toast('Nutrition applied from ingredients');
              }}
            />
            <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
              <Field label="Fat" required hint="g">
                <Input type="number" step="any" min="0" value={form.fat} onChange={(e) => set('fat', e.target.value)} />
              </Field>
              <Field label="Carbohydrate" required hint="g">
                <Input type="number" step="any" min="0" value={form.carb} onChange={(e) => set('carb', e.target.value)} />
              </Field>
              <Field label="Protein" required hint="g">
                <Input type="number" step="any" min="0" value={form.prot} onChange={(e) => set('prot', e.target.value)} />
              </Field>
              <Field label="Fibre" hint="g">
                <Input type="number" step="any" min="0" placeholder="—" value={form.fiber}
                  onChange={(e) => set('fiber', e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* ── PRODUCT GROUP ── */}
          <Section title="Product group">
            <Field label="Product group">
              <Select value={form.productGroup} onChange={(e) => set('productGroup', e.target.value)}>
                <option value="">Select product group</option>
                {PRODUCT_GROUPS.map((g) => <option key={g}>{g}</option>)}
              </Select>
            </Field>
          </Section>

          {/* ── INGREDIENTS ── */}
          <Section title="Ingredients list" count={form.ingredients.length}>
            <IngredientRows items={form.ingredients} onChange={(v) => set('ingredients', v)} />
          </Section>

          {/* ── COOKING STEPS ── */}
          <Section title="Cooking steps" count={form.instructions.length}>
            <CookingSteps
              foodItems={form.foodItems}
              instructions={form.instructions}
              onFoodItems={(v) => set('foodItems', v)}
              onInstructions={(v) => set('instructions', v)}
            />
          </Section>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button onClick={save} disabled={!isNew && !dirty}>
            {isNew ? 'Create meal' : 'Save changes'}
          </Button>
        </div>
      </div>
    </>
  );
}
