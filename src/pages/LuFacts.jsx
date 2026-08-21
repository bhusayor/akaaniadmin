import { useMemo, useState } from 'react';
import useTopbar, { useSearch } from '../hooks/useTopbar.js';
import Modal, { ModalActions } from '../components/Modal.jsx';
import {
  Button, Card, FilterSelect, CountBadge, IconButton, PageToolbar,
  Th, Td, EmptyState, ModalButton, cx,
} from '../components/ui.jsx';
import { IconPlus, IconEdit, IconTrash, IconDownload, IconInfo } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useLuFacts } from '../state/LuFactsProvider.jsx';
import FactFormModal from '../features/luFacts/FactFormModal.jsx';
import LuCard from '../features/luFacts/LuCard.jsx';
import {
  FACT_CATEGORIES, FACT_STATUSES, CATEGORY_TONE, BODY_COMFORTABLE,
  formatDate, bodyLoad,
} from '../lib/luFacts.js';
import { downloadCSV } from '../lib/csv.js';

export default function LuFacts() {
  useTopbar('LU Facts', 'Search facts…');
  const [search] = useSearch();
  const toast = useToast();
  const { facts, duplicates, createFact, updateFact, deleteFact } = useLuFacts();

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ open: false, fact: null });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [preview, setPreview] = useState(null);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return facts.filter((f) => {
      // Search the fact itself, not only its title — the useful phrase is
      // usually in the body.
      if (q && !f.title.toLowerCase().includes(q)
            && !f.body.toLowerCase().includes(q)
            && !f.ingredient.toLowerCase().includes(q)) return false;
      if (category && f.category !== category) return false;
      if (status && f.status !== status) return false;
      return true;
    }).sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  }, [facts, search, category, status]);

  const published = facts.filter((f) => f.status === 'published').length;
  const longOnes = facts.filter((f) => bodyLoad(f.body) > 1).length;

  const save = (data) => {
    if (form.fact) { updateFact(form.fact.id, data); toast('Fact updated'); }
    else { createFact(data); toast('Fact added'); }
    setForm({ open: false, fact: null });
  };

  const exportCSV = () => {
    const head = ['title', 'body', 'category', 'status', 'ingredient', 'created', 'updated'];
    downloadCSV('akaani-lu-facts.csv', [
      head, ...rows.map((f) => [f.title, f.body, f.category, f.status, f.ingredient, f.createdAt, f.updatedAt]),
    ]);
    toast(`Exported ${rows.length} facts`);
  };

  return (
    <>
      <PageToolbar
        left={
          <>
            <FilterSelect value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {FACT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
            <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {FACT_STATUSES.map((s) => (
                <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </FilterSelect>
            <CountBadge>{rows.length} of {facts.length}</CountBadge>
          </>
        }
        right={
          <>
            <Button variant="ghost" onClick={exportCSV}><IconDownload /> Export</Button>
            <Button onClick={() => setForm({ open: true, fact: null })}>
              <IconPlus /> Add a fun meal fact
            </Button>
          </>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        <div className="mb-4 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          {[
            ['Facts', facts.length, 'text-ink'],
            ['Published', published, 'text-mint'],
            ['Drafts', facts.length - published, 'text-amber-deep'],
            /* Facts that will look cramped in the in-app card. */
            ['Running long', longOnes, longOnes ? 'text-amber-deep' : 'text-ink-3'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-line-light bg-surface-2 px-4 py-3">
              <div className="text-[11px] font-medium text-ink-3">{label}</div>
              <div className={cx('mt-0.5 text-xl font-bold tabular-nums', tone)}>{value}</div>
            </div>
          ))}
        </div>

        {duplicates.length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber/40 bg-amber-light px-4 py-3">
            <span className="mt-0.5 shrink-0 text-amber-deep"><IconInfo /></span>
            <span className="text-[12.5px] leading-relaxed text-amber-deep">
              <strong className="font-semibold">
                {duplicates.length} subject{duplicates.length === 1 ? '' : 's'} have more than one fact
              </strong>
              {' — '}
              {duplicates.map((g) => g[0].title).join(', ')}. Lu picks one at random, so both should be true.
            </span>
          </div>
        )}

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse max-md:min-w-[820px]">
              <thead>
                <tr>
                  <Th>Subject</Th>
                  <Th>Fact</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((fact) => (
                  <tr key={fact.id} className="group transition hover:bg-[#FAFBFD]">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-mint-light text-lg">
                          {fact.image
                            ? <img src={fact.image} alt="" className="size-full object-cover" />
                            : fact.emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium">{fact.title}</div>
                          {fact.ingredient && fact.ingredient !== fact.title && (
                            <div className="truncate text-[11px] text-ink-3">{fact.ingredient}</div>
                          )}
                        </div>
                      </div>
                    </Td>
                    {/* Two lines of the actual fact, not one clipped line —
                        the point of the row is to let you read it. */}
                    <Td className="max-w-[520px]">
                      <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-2">{fact.body}</p>
                      {bodyLoad(fact.body) > 1 && (
                        <span className="mt-1 inline-block text-[11px] font-medium text-amber-deep">
                          {fact.body.length} chars — may clip on a phone
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        CATEGORY_TONE[fact.category] ?? 'bg-line-light text-ink-3')}>
                        {fact.category}
                      </span>
                    </Td>
                    <Td>
                      <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize',
                        fact.status === 'published' ? 'bg-mint-light text-mint-deep' : 'bg-amber-light text-amber-deep')}>
                        {fact.status}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-3">{formatDate(fact.updatedAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <IconButton title="Preview as Lu shows it" className="text-ink-2"
                          onClick={() => setPreview(fact)}>
                          <span className="text-[11px]">👁</span>
                        </IconButton>
                        <IconButton title="Edit" className="text-ink-2"
                          onClick={() => setForm({ open: true, fact })}>
                          <IconEdit />
                        </IconButton>
                        <IconButton title="Delete" className="text-ink-2 hover:border-chili hover:text-chili"
                          onClick={() => setPendingDelete(fact)}>
                          <IconTrash />
                        </IconButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!rows.length && (
            <EmptyState
              icon="💡"
              title={facts.length ? 'No facts match those filters' : 'No facts yet'}
              sub={facts.length ? 'Try clearing the search or filters.' : 'Add one and Lu will start using it.'}
            />
          )}
        </Card>
      </div>

      <FactFormModal
        open={form.open}
        fact={form.fact}
        allFacts={facts}
        onClose={() => setForm({ open: false, fact: null })}
        onSave={save}
      />

      <Modal open={!!preview} onClose={() => setPreview(null)}
        title="As Lu shows it" subtitle={preview ? preview.title : ''}>
        {preview && <LuCard fact={preview} />}
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setPreview(null)}>Close</ModalButton>
          <ModalButton onClick={() => { setForm({ open: true, fact: preview }); setPreview(null); }}>
            Edit this fact
          </ModalButton>
        </ModalActions>
      </Modal>

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete fact?"
        subtitle={pendingDelete
          ? `The fact about "${pendingDelete.title}" will be permanently removed.`
          : ''}
      >
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</ModalButton>
          <ModalButton variant="danger" onClick={() => {
            deleteFact(pendingDelete.id);
            toast('Fact deleted');
            setPendingDelete(null);
          }}>Delete</ModalButton>
        </ModalActions>
      </Modal>
    </>
  );
}
