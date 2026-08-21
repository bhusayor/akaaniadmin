import { useMemo, useState } from 'react';
import useTopbar, { useSearch } from '../hooks/useTopbar.js';
import Modal, { ModalActions } from '../components/Modal.jsx';
import {
  Button, Card, FilterSelect, CountBadge, IconButton, PageToolbar,
  Th, Td, EmptyState, ModalButton, Badge, cx,
} from '../components/ui.jsx';
import { IconPlus, IconEdit, IconTrash, IconDownload, IconInfo, IconLink } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useMealTags } from '../state/MealTagsProvider.jsx';
import TagFormModal from '../features/mealTags/TagFormModal.jsx';
import AttachMealsModal from '../features/mealTags/AttachMealsModal.jsx';
import { TAG_CATEGORIES, CATEGORY_TONE } from '../lib/mealTags.js';
import { downloadCSV } from '../lib/csv.js';

export default function MealTags() {
  useTopbar('Meal Tags', 'Search by tag name…');
  const [search] = useSearch();
  const toast = useToast();
  const {
    tags, usage, orphans, meals,
    createTag, updateTag, deleteTag, deleteTags, recategorize, setTaggedMeals, adoptOrphan,
  } = useMealTags();

  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('usage-desc');
  const [selected, setSelected] = useState(() => new Set());
  const [form, setForm] = useState({ open: false, tag: null });
  const [attach, setAttach] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [bulkCategory, setBulkCategory] = useState('');

  const categories = useMemo(
    () => [...new Set([...TAG_CATEGORIES, ...tags.map((t) => t.category).filter(Boolean)])].sort(),
    [tags],
  );

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    const out = tags.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      if (category && t.category !== category) return false;
      return true;
    });
    const count = (t) => usage.get(t.name) ?? 0;
    return out.sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      if (sort === 'usage-asc') return count(a) - count(b) || a.name.localeCompare(b.name);
      if (sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      return count(b) - count(a) || a.name.localeCompare(b.name);
    });
  }, [tags, search, category, sort, usage]);

  const unused = tags.filter((t) => !(usage.get(t.name) ?? 0)).length;

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    rows.forEach((r) => (allChecked ? next.delete(r.id) : next.add(r.id)));
    return next;
  });

  const save = (data) => {
    if (form.tag) { updateTag(form.tag.id, data); toast('Tag updated'); }
    else { createTag(data); toast('Tag added'); }
    setForm({ open: false, tag: null });
  };

  const confirmDelete = () => {
    const count = usage.get(pendingDelete.name) ?? 0;
    deleteTag(pendingDelete.id);
    toast(count ? `Tag deleted and removed from ${count} meals` : 'Tag deleted');
    setPendingDelete(null);
  };

  const applyBulkCategory = () => {
    if (!bulkCategory) return;
    recategorize([...selected], bulkCategory);
    toast(`${selected.size} tags moved to ${bulkCategory}`);
    setSelected(new Set());
    setBulkCategory('');
  };

  const bulkDelete = () => {
    const n = selected.size;
    deleteTags([...selected]);
    toast(`${n} tag${n === 1 ? '' : 's'} deleted`);
    setSelected(new Set());
  };

  const exportCSV = () => {
    const head = ['name', 'category', 'description', 'meals'];
    downloadCSV('akaani-meal-tags.csv', [
      head, ...rows.map((t) => [t.name, t.category, t.description, usage.get(t.name) ?? 0]),
    ]);
    toast(`Exported ${rows.length} tags`);
  };

  return (
    <>
      <PageToolbar
        left={
          <>
            <FilterSelect value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
            <FilterSelect value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="usage-desc">Most used first</option>
              <option value="usage-asc">Least used first</option>
              <option value="name-asc">Name A–Z</option>
              <option value="category">By category</option>
            </FilterSelect>
            <CountBadge>{rows.length} of {tags.length}</CountBadge>
          </>
        }
        right={
          <>
            <Button variant="ghost" onClick={exportCSV}><IconDownload /> Export</Button>
            <Button onClick={() => setForm({ open: true, tag: null })}><IconPlus /> Add a tag</Button>
          </>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        <div className="mb-4 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          {[
            ['Tags', tags.length, 'text-ink'],
            ['Categories', categories.length, 'text-ocean'],
            /* The actionable one: a tag nothing uses is either new or dead. */
            ['Unused', unused, unused ? 'text-amber-deep' : 'text-ink-3'],
            ['Tagged meals', meals.filter((m) => m.tags.length).length, 'text-mint'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-line-light bg-surface-2 px-4 py-3">
              <div className="text-[11px] font-medium text-ink-3">{label}</div>
              <div className={cx('mt-0.5 text-xl font-bold tabular-nums', tone)}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tag strings on meals that the vocabulary does not define — they
            silently fall out of filters, so they are worth surfacing. */}
        {orphans.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber/40 bg-amber-light px-4 py-3">
            <span className="shrink-0 text-amber-deep"><IconInfo /></span>
            <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-amber-deep">
              <strong className="font-semibold">
                {orphans.length} tag{orphans.length === 1 ? '' : 's'} used by meals but not defined here
              </strong>
              {' — '}they will not appear in filters until they are added.
            </span>
            <div className="flex flex-wrap gap-1.5">
              {orphans.map((o) => (
                <button key={o.name}
                  onClick={() => { adoptOrphan(o.name, 'Context'); toast(`"${o.name}" added to Context`); }}
                  className="cursor-pointer rounded-full border border-amber-deep/30 bg-white/60 px-2.5 py-1 text-[11.5px] font-medium text-amber-deep transition hover:bg-white">
                  + {o.name} ({o.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-forest/20 bg-mint-light px-4 py-3">
            <span className="text-[13px] font-semibold text-mint-deep">{selected.size} selected</span>
            <FilterSelect value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
              <option value="">Move to category…</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
            <Button variant="ghost" onClick={applyBulkCategory} disabled={!bulkCategory}>Apply</Button>
            <Button variant="danger" onClick={bulkDelete}><IconTrash /> Delete selected</Button>
            <button onClick={() => setSelected(new Set())}
              className="ml-auto cursor-pointer text-[12.5px] font-medium text-ink-2 hover:text-forest">
              Clear
            </button>
          </div>
        )}

        <p className="mb-2.5 text-[12px] text-ink-3">
          A tag does nothing until meals carry it — use <strong className="font-medium text-ink-2">Attach meals</strong> on
          a row to choose which ones.
        </p>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse max-md:min-w-[760px]">
              <thead>
                <tr>
                  <Th className="w-10">
                    <input type="checkbox" className="size-3.5 cursor-pointer accent-forest"
                      checked={allChecked} onChange={toggleAll} />
                  </Th>
                  <Th>Name</Th>
                  <Th>Category</Th>
                  <Th>Description</Th>
                  <Th>Meals attached</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tag) => {
                  const count = usage.get(tag.name) ?? 0;
                  return (
                    <tr key={tag.id} className="group transition hover:bg-[#FAFBFD]">
                      <Td>
                        <input type="checkbox" className="size-3.5 cursor-pointer accent-forest"
                          checked={selected.has(tag.id)} onChange={() => toggle(tag.id)} />
                      </Td>
                      <Td><span className="font-medium">{tag.name}</span></Td>
                      <Td>
                        <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          CATEGORY_TONE[tag.category] ?? 'bg-line-light text-ink-3')}>
                          {tag.category || 'Uncategorised'}
                        </span>
                      </Td>
                      <Td className="max-w-[420px] text-ink-2">
                        {tag.description || <span className="italic text-ink-3">No description</span>}
                      </Td>
                      <Td>
                        {/* A bordered control with an icon and a verb. The
                            count alone read as a static badge, so nobody
                            could tell this was how meals get attached. */}
                        <button
                          onClick={() => setAttach(tag)}
                          title={count ? `Add or remove meals for "${tag.name}"` : `Attach meals to "${tag.name}"`}
                          className={cx(
                            'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5',
                            'text-[12px] font-medium transition',
                            count
                              ? 'border-mint/40 bg-mint-light text-mint-deep hover:border-forest hover:bg-mint/20'
                              : 'border-dashed border-ink-3/40 text-ink-2 hover:border-forest hover:bg-canvas hover:text-forest',
                          )}
                        >
                          {count ? (
                            <>
                              <IconLink size={12} />
                              <span className="tabular-nums">{count} meal{count === 1 ? '' : 's'}</span>
                              <span className="font-normal opacity-70">· Manage</span>
                            </>
                          ) : (
                            <><IconPlus size={12} /> Attach meals</>
                          )}
                        </button>
                      </Td>
                      <Td>
                        {/* No attach button here — the Meals attached column
                            already carries it, and two controls for one job
                            just makes people wonder how they differ. */}
                        <div className="flex justify-end gap-1">
                          <IconButton title="Edit" className="text-ink-2"
                            onClick={() => setForm({ open: true, tag })}>
                            <IconEdit />
                          </IconButton>
                          <IconButton title="Delete" className="text-ink-2 hover:border-chili hover:text-chili"
                            onClick={() => setPendingDelete(tag)}>
                            <IconTrash />
                          </IconButton>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!rows.length && (
            <EmptyState
              icon="🏷️"
              title={tags.length ? 'No tags match those filters' : 'No tags yet'}
              sub={tags.length ? 'Try clearing the search or filters.' : 'Add a tag to start grouping meals.'}
            />
          )}
        </Card>
      </div>

      <TagFormModal
        open={form.open}
        tag={form.tag}
        allTags={tags}
        onClose={() => setForm({ open: false, tag: null })}
        onSave={save}
      />

      <AttachMealsModal
        open={!!attach}
        tag={attach}
        meals={meals}
        onClose={() => setAttach(null)}
        onSave={(ids) => {
          setTaggedMeals(attach.name, ids);
          toast(`"${attach.name}" now on ${ids.length} meal${ids.length === 1 ? '' : 's'}`);
          setAttach(null);
        }}
      />

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete meal tag?"
        subtitle={pendingDelete
          ? (usage.get(pendingDelete.name)
              ? `"${pendingDelete.name}" is on ${usage.get(pendingDelete.name)} meals. Deleting it removes the tag from those meals — the meals themselves are not deleted.`
              : `"${pendingDelete.name}" is not used by any meal.`)
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
