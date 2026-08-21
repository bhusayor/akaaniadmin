import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import Modal, { ModalActions } from '../components/Modal.jsx';
import { Button, Card, EmptyState, ModalButton, cx } from '../components/ui.jsx';
import { IconEdit, IconTrash, IconInfo, IconClock } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useMeals } from '../state/MealsProvider.jsx';
import { ALL_TAGS } from '../data/meals.js';

const TABS = [
  ['ingredients', 'Ingredients'],
  ['instructions', 'Instructions'],
  ['health', 'Incompatible Health Conditions'],
];

function TagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}

/** Nutrition tile — a null reads as an em dash, never as 0. */
function Stat({ label, value, unit, strong }) {
  return (
    <div className={cx('rounded-xl border px-3.5 py-3', strong ? 'border-transparent bg-forest' : 'border-line-light bg-surface-2')}>
      <div className={cx('text-[11px] font-medium', strong ? 'text-white/55' : 'text-ink-3')}>{label}</div>
      <div className={cx('mt-0.5 text-lg font-bold tabular-nums', strong ? 'text-white' : 'text-ink')}>
        {value === null || value === undefined ? '—' : value}
        {value !== null && value !== undefined && unit && (
          <span className={cx('ml-0.5 text-[11px] font-medium', strong ? 'text-white/55' : 'text-ink-3')}>{unit}</span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

export default function MealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { getMeal, deleteMeal } = useMeals();
  const meal = getMeal(id);

  const [tab, setTab] = useState('ingredients');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useTopbar(meal ? meal.name : 'Meal Details');

  if (!meal) {
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

  const types = meal.types ?? [meal.type];
  const perServing = meal.servings ? Math.round(meal.cal / meal.servings) : null;

  const remove = () => {
    const name = meal.name;
    deleteMeal(meal.id);
    setConfirmDelete(false);
    navigate('/meals');
    toast(`"${name}" deleted`);
  };

  const tabContent = {
    ingredients: meal.ingredients,
    instructions: meal.instructions,
    health: meal.healthConditions,
  }[tab];

  return (
    <>
      {/* Action bar */}
      <div className="sticky top-[60px] z-15 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-7 pt-4 pb-3 max-md:static max-md:px-4">
        <Link
          to="/meals"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-2 transition hover:bg-canvas hover:text-forest"
        >
          ← Meals
        </Link>
        <span className="text-ink-3">/</span>
        <span className="truncate text-[13px] text-ink">{meal.name}</span>

        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => navigate(`/meals/edit/${meal.id}`)}>
            <IconEdit /> Edit
          </Button>
          <Button
            variant="ghost"
            className="hover:border-chili hover:text-chili"
            onClick={() => setConfirmDelete(true)}
          >
            <IconTrash /> Delete
          </Button>
        </div>
      </div>

      <div className="px-7 py-5 max-md:px-4">
        <div className="grid grid-cols-[380px_1fr] gap-5 max-[1100px]:grid-cols-1">
          {/* ── Photo + at-a-glance ── */}
          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden p-0">
              <div className="aspect-4/5 bg-gradient-to-br from-mint-light to-[#F3FAF7] max-[1100px]:aspect-16/9">
                {meal.image ? (
                  <img src={meal.image} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center">
                    <span className="grid size-28 place-items-center rounded-full bg-white/60 text-6xl shadow-soft">
                      {meal.emoji}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Calories / serving" value={perServing} unit="kcal" strong />
                <Stat label="Total calories" value={meal.cal} unit="kcal" />
                <Stat label="Protein" value={meal.prot} unit="g" />
                <Stat label="Carbs" value={meal.carb} unit="g" />
                <Stat label="Fat" value={meal.fat} unit="g" />
                <Stat label="Fibre" value={meal.fiber} unit="g" />
                <Stat label="Servings" value={meal.servings} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line-light pt-3 text-[12.5px] text-ink-2">
                <span className="inline-flex items-center gap-1.5"><IconClock size={12} /> {meal.prep} min prep</span>
                {meal.portion && <span>Portion: <strong className="font-semibold text-ink">{meal.portion}</strong></span>}
              </div>
            </Card>
          </div>

          {/* ── Details ── */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="p-6 max-md:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{meal.name}</h1>
                  <p className="mt-1 text-[13px] text-ink-3">{meal.countries.join(', ')}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {types.map((t) => (
                    <span key={t} className="rounded-full bg-amber-light px-3 py-1.5 text-[12px] font-medium capitalize text-amber-deep">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {meal.description && (
                <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{meal.description}</p>
              )}

              <div className="mt-5 flex flex-col gap-4 border-t border-line-light pt-5">
                {meal.notificationMessage && (
                  <Section title="Notification message">{meal.notificationMessage}</Section>
                )}

                {meal.luTips && (
                  /* Lu is the product's assistant — same mint treatment as the
                     dashboard banner, so its voice is recognisable. */
                  <div className="flex items-start gap-3 rounded-xl border border-mint/20 bg-mint-light px-4 py-3.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-white text-base">🌿</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-mint-deep">Lu tips</div>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">{meal.luTips}</p>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-[13px] font-semibold text-ink">Tags</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {meal.tags.length ? meal.tags.map((t) => {
                      const meta = ALL_TAGS.find((x) => x.name === t);
                      return (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
                          style={{ background: meta?.pillBg ?? '#EEEDFE', color: meta?.pillColor ?? '#534AB7' }}
                        >
                          <TagIcon />{t}
                        </span>
                      );
                    }) : <span className="text-[13px] italic text-ink-3">No tags assigned</span>}
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Tabs ── */}
            <Card className="p-0">
              <div className="flex gap-1 border-b border-line-light p-1.5 max-sm:flex-col">
                {TABS.map(([key, label]) => {
                  const count = { ingredients: meal.ingredients, instructions: meal.instructions, health: meal.healthConditions }[key]?.length ?? 0;
                  return (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={cx(
                        'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] transition cursor-pointer',
                        tab === key
                          ? 'bg-surface font-semibold text-ink shadow-soft'
                          : 'font-medium text-ink-3 hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      {label}
                      <span className={cx('rounded-full px-1.5 text-[11px] tabular-nums',
                        tab === key ? 'bg-mint-light text-mint-deep' : 'bg-line-light text-ink-3')}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-5 max-md:p-4">
                {!tabContent?.length ? (
                  <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-4 py-3.5 text-[13px] text-ink-2">
                    <span className="mt-0.5 shrink-0 text-ink-3"><IconInfo /></span>
                    {tab === 'health'
                      ? 'No incompatible health conditions recorded. This is clinical guidance — it should be authored by a nutritionist rather than generated.'
                      : `No ${tab} recorded for this meal yet. Use Edit to add them.`}
                  </div>
                ) : tab === 'instructions' ? (
                  /* Ordered, because the sequence is the information. */
                  <ol className="flex flex-col gap-2.5">
                    {tabContent.map((step, i) => (
                      <li key={i} className="flex gap-3 rounded-xl border border-line-light bg-surface-2 px-4 py-3">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-forest text-[11px] font-semibold text-white">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[13.5px] leading-relaxed text-ink-2">{step.text}</span>
                          {step.timeEstimate ? (
                            <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11.5px] text-ink-3">
                              <IconClock size={11} />{step.timeEstimate} min
                            </span>
                          ) : null}
                          {step.image && (
                            <img src={step.image} alt="" className="mt-2 h-28 rounded-lg object-cover" />
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  /* One row per item. The real page splits on commas, which
                     tears "1 medium-sized onion, sliced" into two entries. */
                  <ul className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
                    {tabContent.map((item, i) => {
                      /* Health conditions are plain strings; ingredients are
                         structured, so quantity and prep note stay distinct. */
                      const isIngredient = typeof item === 'object';
                      const qty = isIngredient
                        ? [item.quantity, item.unit].filter(Boolean).join(' ')
                        : '';
                      return (
                        <li key={i} className="flex items-start gap-2.5 rounded-xl border border-line-light bg-surface-2 px-4 py-2.5">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-mint" />
                          <span className="text-[13.5px] leading-relaxed text-ink-2">
                            {qty && <span className="font-semibold tabular-nums text-ink">{qty} </span>}
                            {isIngredient ? item.name : item}
                            {isIngredient && item.description && (
                              <span className="text-ink-3">, {item.description}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete meal?"
        subtitle={`"${meal.name}" will be permanently removed.`}
      >
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</ModalButton>
          <ModalButton variant="danger" onClick={remove}>Delete</ModalButton>
        </ModalActions>
      </Modal>
    </>
  );
}
