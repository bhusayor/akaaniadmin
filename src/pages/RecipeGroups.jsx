import { useEffect, useMemo, useState } from 'react';
import useTopbar, { useSearch } from '../hooks/useTopbar.js';
import Modal, { ModalActions } from '../components/Modal.jsx';
import {
  Button, Card, FilterSelect, CountBadge, IconButton, PageToolbar,
  EmptyState, ModalButton, cx,
} from '../components/ui.jsx';
import { IconPlus, IconEdit, IconTrash, IconGrid, IconList } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useRecipeGroups } from '../state/RecipeGroupsProvider.jsx';
import RecipeGroupDrawer from '../features/recipeGroups/RecipeGroupDrawer.jsx';
import { PLANS, GROUP_STATUSES, formatPrice } from '../lib/recipeGroups.js';

const STATUS_TONE = {
  live: 'bg-mint-light text-mint-deep',
  draft: 'bg-amber-light text-amber-deep',
  retired: 'bg-line-light text-ink-3',
};

const TYPE_TONE = {
  breakfast: 'bg-amber-light text-amber-deep',
  lunch: 'bg-mint-light text-mint-deep',
  dinner: 'bg-grape-light text-grape',
  snack: 'bg-ocean-light text-ocean-deep',
};

function Meta({ label, children }) {
  return (
    <span className="whitespace-nowrap text-[13px] text-ink-3">
      {label}: <strong className="font-semibold text-ink">{children}</strong>
    </span>
  );
}

const VIEW_KEY = 'akaani.recipeGroups.view';

/** List / grid switch. Icon-only — the two layouts explain themselves. */
function ViewToggle({ value, onChange }) {
  const opts = [
    { v: 'list', Icon: IconList, label: 'List view' },
    { v: 'grid', Icon: IconGrid, label: 'Grid view' },
  ];
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {opts.map(({ v, Icon, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          title={label}
          aria-label={label}
          aria-pressed={value === v}
          className={cx(
            'grid size-7.5 cursor-pointer place-items-center rounded-[6px] transition',
            value === v ? 'bg-surface text-ink shadow-soft' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

function Cover({ group, className }) {
  return (
    <div className={cx('relative overflow-hidden bg-mint-light', className)}>
      {group.image
        ? <img src={group.image} alt="" loading="lazy" className="size-full object-cover" />
        : <div className="grid size-full place-items-center text-3xl opacity-40">🍲</div>}
      <span className={cx(
        'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10.5px] font-semibold capitalize shadow-soft',
        STATUS_TONE[group.status])}>
        {group.status}
      </span>
    </div>
  );
}

function Actions({ onEdit, onDelete, size = 'size-9' }) {
  return (
    <div className="flex shrink-0 gap-1.5">
      <IconButton title="Edit" className={size} onClick={onEdit}><IconEdit size={14} /></IconButton>
      <IconButton title="Delete" className={cx(size, 'hover:border-chili hover:text-chili')} onClick={onDelete}>
        <IconTrash size={14} />
      </IconButton>
    </div>
  );
}

function TypeChips({ types }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((t) => (
        <span key={t} className={cx('rounded-full px-2.5 py-1 text-[11.5px] font-medium capitalize',
          TYPE_TONE[t] ?? TYPE_TONE.lunch)}>
          {t}
        </span>
      ))}
    </div>
  );
}

/** The wide row — room for the description and every figure side by side. */
function ListCard({ group, onEdit, onDelete }) {
  return (
    <Card className="group">
      <div className="flex gap-5 max-md:flex-col">
        <Cover group={group} className="w-[220px] shrink-0 self-stretch max-md:h-40 max-md:w-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-5 pr-5 max-md:px-4 max-md:pb-4 max-md:pt-0">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{group.name}</h3>
            <Actions onEdit={onEdit} onDelete={onDelete} />
          </div>
          <p className="max-w-[80ch] text-[13.5px] leading-relaxed text-ink-2">{group.description}</p>
          <TypeChips types={group.mealTypes} />
          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-light pt-3">
            <Meta label="Plan">{group.plan || '—'}</Meta>
            <Meta label="Servings">{group.servings ?? '—'}</Meta>
            {/* Derived from the list, so it cannot disagree with it. */}
            <Meta label="Recipes">{group.recipeCount}</Meta>
            <Meta label="Price">{formatPrice(group.price, group.currency)}</Meta>
            {group.pricePerRecipe !== null && (
              <span className="whitespace-nowrap text-[12px] text-ink-3">
                ({formatPrice(group.pricePerRecipe, group.currency)} per recipe)
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * The tile — cover-led, for judging the bundles as a shelf.
 *
 * The description is clamped rather than dropped: without a line or two
 * the tiles all look alike, but a full paragraph makes them different
 * heights and the grid stops being scannable.
 */
function GridCard({ group, onEdit, onDelete }) {
  return (
    <Card className="group flex flex-col">
      <Cover group={group} className="h-44 w-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink">{group.name}</h3>
          <Actions onEdit={onEdit} onDelete={onDelete} size="size-8" />
        </div>
        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-2">{group.description}</p>
        <TypeChips types={group.mealTypes} />
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-2 border-t border-line-light pt-3">
          <span className="text-[17px] font-bold tabular-nums text-ink">
            {formatPrice(group.price, group.currency)}
          </span>
          <span className="text-[12px] text-ink-3">
            {group.recipeCount} recipes · {group.servings ?? '—'} servings
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function RecipeGroups() {
  useTopbar('Recipe Groups', 'Search recipe group…');
  const [search] = useSearch();
  const toast = useToast();
  const { groups, recipeOptions, createGroup, updateGroup, deleteGroup } = useRecipeGroups();

  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  /* Grid for scanning covers, list for comparing prices and recipe counts.
     The choice sticks, because it is a preference rather than a one-off. */
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'list');
  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);

  const [drawer, setDrawer] = useState({ open: false, group: null });
  const [pendingDelete, setPendingDelete] = useState(null);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return groups.filter((g) => {
      if (q && !g.name.toLowerCase().includes(q) && !g.description.toLowerCase().includes(q)) return false;
      if (status && g.status !== status) return false;
      if (plan && g.plan !== plan) return false;
      return true;
    });
  }, [groups, search, status, plan]);

  const liveCount = groups.filter((g) => g.status === 'live').length;

  const save = (data) => {
    if (drawer.group) {
      updateGroup(drawer.group.id, data);
      toast('Recipe group updated');
    } else {
      createGroup(data);
      toast('Recipe group created');
    }
    setDrawer({ open: false, group: null });
  };

  const confirmDelete = () => {
    deleteGroup(pendingDelete.id);
    toast(`"${pendingDelete.name}" deleted`);
    setPendingDelete(null);
  };

  return (
    <>
      <PageToolbar
        left={
          <>
            <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {GROUP_STATUSES.map((s) => (
                <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">All plans</option>
              {PLANS.map((p) => <option key={p}>{p}</option>)}
            </FilterSelect>
            <CountBadge>{liveCount} live of {groups.length}</CountBadge>
          </>
        }
        right={
          <>
            <ViewToggle value={view} onChange={setView} />
            <Button onClick={() => setDrawer({ open: true, group: null })}>
              <IconPlus /> Add new
            </Button>
          </>
        }
      />

      <div className={cx('px-7 py-5 max-md:px-4', view === 'grid'
        ? 'grid grid-cols-3 gap-5 max-xl:grid-cols-2 max-md:grid-cols-1'
        : 'flex flex-col gap-3.5')}>
        {rows.length ? rows.map((group) => (
          view === 'grid'
            ? <GridCard key={group.id} group={group} onEdit={() => setDrawer({ open: true, group })}
                onDelete={() => setPendingDelete(group)} />
            : <ListCard key={group.id} group={group} onEdit={() => setDrawer({ open: true, group })}
                onDelete={() => setPendingDelete(group)} />
        )) : (
          <Card className={view === 'grid' ? 'col-span-3 max-xl:col-span-2 max-md:col-span-1' : ''}>
            <EmptyState
              icon="🧺"
              title={groups.length ? 'No groups match those filters' : 'No recipe groups yet'}
              sub={groups.length ? 'Try clearing the search or filters.' : 'Bundle a few recipes to sell on the site.'}
            />
          </Card>
        )}
      </div>

      <RecipeGroupDrawer
        open={drawer.open}
        group={drawer.group}
        recipeOptions={recipeOptions}
        onClose={() => setDrawer({ open: false, group: null })}
        onSave={save}
      />

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete recipe group?"
        subtitle={pendingDelete
          ? `"${pendingDelete.name}" will be permanently removed. The ${pendingDelete.recipeCount} recipes in it are not deleted.`
          : ''}
      >
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</ModalButton>
          <ModalButton variant="danger" onClick={confirmDelete}>Delete</ModalButton>
        </ModalActions>
      </Modal>
    </>
  );
}
