import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import { Button, Card, EmptyState, Field, Input, Select, Spinner, cx } from '../components/ui.jsx';
import { IconTrash } from '../components/icons.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import { useToast } from '../components/Toast.jsx';
import { useMeals } from '../state/MealsProvider.jsx';
import { BLANK_MEAL } from '../data/meals.js';
import { isForbidden } from '../lib/api.js';
import { unresolvedNames } from '../lib/meals.js';
import { PRODUCT_GROUPS } from '../lib/taxonomy.js';
import { Section, ChipSelect, StringRows, CATEGORIES } from '../features/meals/formParts.jsx';
import IngredientRows from '../features/meals/IngredientRows.jsx';
import CookingSteps from '../features/meals/CookingSteps.jsx';
import MealNutritionTotal from '../features/meals/MealNutritionTotal.jsx';
import MealServings from '../features/meals/MealServings.jsx';
import MealStudioPanel from '../features/meals/MealStudioPanel.jsx';
import { FIELD_LABELS } from '../lib/mealStudio.js';
import { mealNutritionFields, readNutrient, suggestServings } from '../lib/mealNutrition.js';

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
    healthConditions: [...(m.healthConditions ?? [])],
    nutrients: (m.nutrients ?? []).map((n) => ({ ...n })),
    /* Not edited any more — carried so a meal saved before any ingredient
       was linked keeps its figures instead of being blanked. */
    cal: m.cal ?? '', fat: m.fat ?? '', carb: m.carb ?? '', prot: m.prot ?? '', fiber: m.fiber ?? '',
    totalCal: m.totalCal ?? '', totalFat: m.totalFat ?? '', totalCarb: m.totalCarb ?? '',
    totalProt: m.totalProt ?? '', totalFiber: m.totalFiber ?? '',
    productGroup: m.productGroup ?? '',
    ingredients: (m.ingredients ?? []).map((i) => ({ ...i })),
    foodItems: [...(m.foodItems ?? [])],
    instructions: (m.instructions ?? []).map((s) => ({ ...s })),
    portion: m.portion ?? '',
  };
}

/** A labelled run of fields inside the Details section. */
function DetailGroup({ title, children }) {
  return (
    <div>
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</div>
      {children}
    </div>
  );
}

export default function MealEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    getMeal, fetchMeal, createMeal, updateMeal, lookups, status: mealsStatus,
  } = useMeals();

  /* `/meals/new` renders the same form against a blank record, so there is
     one meal form rather than two that drift apart. */
  const isNew = id === undefined;
  const meal = isNew ? null : getMeal(id);
  const source = isNew ? BLANK_MEAL : meal;

  const [form, setForm] = useState(() => (source ? toForm(source) : null));
  /* A meal opened by link before the list has it is fetched on its own. */
  const [lookup, setLookup] = useState({ status: 'idle', error: null });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  /* The platform's tags: a meal stores tag ids, so only these can be saved. */
  const [tagState, setTagState] = useState({ status: 'loading', names: [], error: null });
  /* The calculated nutrition for this meal, straight from
     POST /v1/nutrition/calculate. Null while nothing is linked, in which
     case the meal keeps whatever was saved on it rather than being
     blanked by an empty calculation. */
  const [totals, setTotals] = useState(null);
  /* Whether the admin has chosen the servings. Until then the number
     follows the suggestion as ingredients are added; after, it is theirs.
     A saved meal's servings count as chosen. */
  const [servingsTouched, setServingsTouched] = useState(() => String(source?.servings ?? '').trim() !== '');
  /* Bumped whenever a draft fills the form, so the sections it wrote into
     open themselves rather than leaving someone to find the change. */
  const [filledAt, setFilledAt] = useState(0);
  const [errors, setErrors] = useState([]);
  const initial = useRef(form ? JSON.stringify(form) : '');

  useTopbar(isNew ? 'New Meal' : 'Edit Meal');

  useEffect(() => {
    if (isNew || meal || mealsStatus === 'loading' || lookup.status !== 'idle') return;
    setLookup({ status: 'loading', error: null });
    fetchMeal(id).then(
      () => setLookup({ status: 'done', error: null }),
      (error) => setLookup({ status: 'error', error }),
    );
  }, [isNew, meal, id, mealsStatus, lookup.status, fetchMeal]);

  /* The form is built once the meal is in hand, and only once: a later
     refresh of the list must not overwrite what is being edited. */
  useEffect(() => {
    if (form || !source) return;
    const next = toForm(source);
    initial.current = JSON.stringify(next);
    setForm(next);
    setServingsTouched(String(next.servings ?? '').trim() !== '');
  }, [form, source]);

  /* The suggested number of servings, applied while the admin has not
     picked one. */
  useEffect(() => {
    if (servingsTouched || !form) return;
    const kcal = readNutrient(totals, 'calories');
    const suggested = kcal.available ? suggestServings(kcal.value) : null;
    if (suggested && String(suggested) !== String(form.servings)) {
      setForm((f) => ({ ...f, servings: String(suggested) }));
    }
  }, [totals, servingsTouched, form]);

  useEffect(() => {
    let live = true;
    lookups().then(
      ({ tags }) => live && setTagState({
        status: 'ready',
        names: [...new Set(tags.map((t) => t.name))].sort((a, b) => a.localeCompare(b)),
        error: null,
      }),
      (error) => live && setTagState({ status: 'error', names: [], error }),
    );
    return () => { live = false; };
  }, [lookups]);

  const dirty = useMemo(
    () => (form ? JSON.stringify(form) !== initial.current : false),
    [form],
  );

  if (!isNew && !meal && lookup.status !== 'error' && (mealsStatus === 'loading' || lookup.status !== 'done')) {
    return (
      <div className="grid flex-1 place-items-center py-20"><Spinner className="size-6" /></div>
    );
  }

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

  const save = async () => {
    const problems = [];
    if (!form.name.trim()) problems.push('Name is required');
    if (!form.description.trim()) problems.push('Description is required');
    if (!form.types.length) problems.push('At least one Type is required');
    if (!form.tags.length) problems.push('At least one Tag is required');
    if (!form.countries.length) problems.push('At least one Country is required');
    if (num(form.prep) === null) problems.push('Cook Time is required');
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
      // Not editable on this form any more; carried so editing a meal that
      // already has one does not drop it.
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
      healthConditions: form.healthConditions.filter(Boolean),
      nutrients: form.nutrients.filter((n) => n.name?.trim()),
      /* Calculated, never typed: the whole meal from its ingredients, and
         per serving by dividing by the servings. A nutrient the sources did
         not publish is saved as null — unavailable — rather than as a
         measured 0. With nothing linked there is nothing to calculate, so
         the meal keeps the figures it already had. */
      ...(totals
        ? mealNutritionFields(totals, form.servings)
        : {
          cal: num(form.cal), fat: num(form.fat), carb: num(form.carb), prot: num(form.prot), fiber: num(form.fiber),
          totalCal: num(form.totalCal), totalFat: num(form.totalFat), totalCarb: num(form.totalCarb),
          totalProt: num(form.totalProt), totalFiber: num(form.totalFiber),
        }),
      productGroup: form.productGroup,
      ingredients: form.ingredients.filter((i) => i.name?.trim()),
      foodItems: form.foodItems.filter(Boolean),
      instructions: form.instructions.filter((s) => s.text?.trim()),
      portion: form.portion.trim(),
    };

    setSaving(true);
    setSaveError(null);
    try {
      /* Saved to the platform; the page it lands on reads the copy the
         platform sent back, not what the form held. */
      const saved = isNew ? await createMeal(payload) : await updateMeal(meal.id, payload);
      const { tags: lostTags } = unresolvedNames(payload, await lookups());
      toast(lostTags.length
        ? `${isNew ? 'Meal created' : 'Meal saved'} — not on the platform, so not saved: ${lostTags.join(', ')}`
        : (isNew ? 'Meal created' : 'Meal saved'));
      initial.current = JSON.stringify(form);
      navigate(`/meals/${saved.id}`);
    } catch (err) {
      setSaving(false);
      setSaveError(isForbidden(err)
        ? 'Your account is not allowed to save meals — the platform only lets staff and admin accounts do that.'
        : `${err.status ? `HTTP ${err.status}: ` : ''}${err.message}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
          <Button onClick={save} disabled={saving || (!isNew && !dirty)}>
            {saving ? 'Saving…' : isNew ? 'Create meal' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1500px] px-7 py-5 max-md:px-4">
        {saveError && (
          <div role="alert" className="mb-4 rounded-xl border border-chili/30 bg-chili-light px-4 py-3 text-[13px] text-chili-deep">
            <b className="font-semibold">Not saved.</b> {saveError}
          </div>
        )}
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

        {/* Form on the left, Meal Studio on the right: a new meal usually
            starts from a search, and the draft it produces has to be read
            against the fields it fills. */}
        <div className="flex items-start gap-5 max-lg:flex-col">
        <Card className="min-w-0 flex-1 px-6 py-2 max-lg:w-full max-md:px-4">
          {/* ── DETAILS ──
              Read in the order a meal is written: what it is, how it is
              classified, how it is cooked and served, then what Lu says
              about it. */}
          <Section title="Details" defaultOpen openSignal={filledAt}>
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-[240px_1fr] gap-5 max-md:grid-cols-1">
                <ImagePicker label="Meal image" value={form.image} onChange={(v) => set('image', v)}
                  emptyHeight="h-[212px]" previewHeight="h-[212px]" />
                <div className="flex min-w-0 flex-col gap-4">
                  <Field label="Name" required>
                    <Input value={form.name} placeholder="e.g. Jollof rice with fried plantain"
                      onChange={(e) => set('name', e.target.value)} />
                  </Field>
                  <Field label="Description" required>
                    <textarea rows={5} className={textareaCls} value={form.description}
                      onChange={(e) => set('description', e.target.value)} />
                  </Field>
                </div>
              </div>

              <DetailGroup title="Classification">
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
                  <Field label="Tags" required
                    hint={tagState.status === 'loading' ? 'loading platform tags…'
                      : tagState.status === 'error' ? `could not load platform tags: ${tagState.error.message}` : undefined}>
                    <ChipSelect options={[...new Set([...tagState.names, ...form.tags])]} value={form.tags}
                      onChange={(v) => set('tags', v)} />
                  </Field>
                  <Field label="Countries" required>
                    <ChipSelect options={COUNTRIES} value={form.countries}
                      onChange={(v) => set('countries', v)} />
                  </Field>
                </div>
              </DetailGroup>

              <DetailGroup title="Cooking & serving">
                {/* Servings live with the macronutrients, which they divide. */}
                <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <Field label="Cook time" required hint="minutes">
                    <Input type="number" min="0" value={form.prep} onChange={(e) => set('prep', e.target.value)} />
                  </Field>
                  <Field label="Portion per serving">
                    <Input value={form.portion} placeholder="e.g. 1 bowl"
                      onChange={(e) => set('portion', e.target.value)} />
                  </Field>
                </div>
              </DetailGroup>

              <DetailGroup title="Lu & notifications">
                <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <Field label="Lu tips">
                    <textarea rows={4} className={textareaCls} value={form.luTips} placeholder="Lu Tips"
                      onChange={(e) => set('luTips', e.target.value)} />
                  </Field>
                  <Field label="Notification message">
                    <textarea rows={4} className={textareaCls} value={form.notificationMessage}
                      onChange={(e) => set('notificationMessage', e.target.value)} />
                  </Field>
                </div>
              </DetailGroup>
            </div>
          </Section>

          {/* ── INGREDIENTS ──
              Straight after the details: the macros below are calculated
              from these rows. */}
          <Section title="Ingredients list" count={form.ingredients.length} defaultOpen openSignal={filledAt}>
            <IngredientRows items={form.ingredients} onChange={(v) => set('ingredients', v)} />
          </Section>

          {/* ── MACRONUTRIENTS ──
              Calculated, never typed. The ingredients are the whole meal;
              the servings divide it, and per serving is what the app shows. */}
          <Section title="Macronutrients & servings" defaultOpen>
            <MealNutritionTotal
              rows={form.ingredients}
              onTotals={setTotals}
              savedFallback={!isNew && num(form.cal) !== null}
            />
            <MealServings
              totals={totals}
              form={form}
              servings={form.servings}
              touched={servingsTouched}
              onServings={(v) => { setServingsTouched(true); set('servings', v); }}
            />
          </Section>

          {/* ── COOKING STEPS ── */}
          <Section title="Cooking steps" count={form.instructions.length} openSignal={filledAt}>
            <CookingSteps
              foodItems={form.foodItems}
              instructions={form.instructions}
              onFoodItems={(v) => set('foodItems', v)}
              onInstructions={(v) => set('instructions', v)}
            />
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

          {/* ── PRODUCT GROUP ── */}
          <Section title="Product group">
            <Field label="Product group">
              <Select value={form.productGroup} onChange={(e) => set('productGroup', e.target.value)}>
                <option value="">Select product group</option>
                {PRODUCT_GROUPS.map((g) => <option key={g}>{g}</option>)}
              </Select>
            </Field>
          </Section>
        </Card>

        <aside className="w-[380px] shrink-0 max-lg:order-first max-lg:w-full">
          <div className="sticky top-[132px] max-lg:static">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[15px] font-semibold text-ink">Meal Studio</span>
            </div>
            <MealStudioPanel
              form={form}
              autoApply={isNew}
              onApply={(patch, changed) => {
                // A drafted number of servings is a choice, not something to re-suggest over.
                if (String(patch.servings ?? '').trim()) setServingsTouched(true);
                setForm((f) => ({ ...f, ...patch }));
                setFilledAt((n) => n + 1);
                toast(changed.length === 1
                  ? `${FIELD_LABELS[changed[0]] || changed[0]} updated`
                  : `${changed.length} fields updated`);
              }}
            />
          </div>
        </aside>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button onClick={save} disabled={saving || (!isNew && !dirty)}>
            {saving ? 'Saving…' : isNew ? 'Create meal' : 'Save changes'}
          </Button>
        </div>
      </div>
    </>
  );
}
