import { useCallback, useEffect, useState } from 'react';
import { useSearch } from '../../hooks/useTopbar.js';
import Modal, { ModalActions } from '../../components/Modal.jsx';
import {
  Button, Card, CountBadge, EmptyState, IconButton, ModalButton, PageToolbar, Spinner, Th, Td,
} from '../../components/ui.jsx';
import { IconEdit, IconPlus, IconRefresh, IconTrash } from '../../components/icons.jsx';
import { useToast } from '../../components/Toast.jsx';
import PlatformIngredientModal, { NOT_ALLOWED } from './PlatformIngredientModal.jsx';
import { deleteIngredient, ingredientFromApi, isForbidden, listIngredients } from '../../lib/api.js';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const fmtDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
};

/** platform-api's ingredient catalogue: server-side search and paging. */
export default function PlatformCatalogue({ tabs }) {
  const [search] = useSearch();
  const toast = useToast();

  const [query, setQuery] = useState(search.trim());
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ status: 'loading', rows: [], total: 0, error: null });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  /* The backend runs the search, so wait for typing to pause. */
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    listIngredients({ search: query, page, limit: PAGE_SIZE }, { signal: controller.signal }).then(
      (data) => setState({
        status: 'ready',
        rows: (data?.ingredients ?? []).map(ingredientFromApi),
        total: Number(data?.docs) || 0,
        error: null,
      }),
      (error) => {
        if (error.name !== 'AbortError') setState((s) => ({ ...s, status: 'error', error }));
      },
    );
    return () => controller.abort();
  }, [query, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const onSaved = (row, verb) => {
    setFormOpen(false);
    setEditing(null);
    toast(`Ingredient ${verb}`);
    if (verb === 'created') {
      // Newest first on the backend, so page 1 is where it will be.
      if (page === 1) reload(); else setPage(1);
    } else {
      setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === row.id ? row : r)) }));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteIngredient(pendingDelete.id);
      setPendingDelete(null);
      toast('Ingredient deleted');
      // Stepping back keeps us off an empty trailing page.
      if (state.rows.length === 1 && page > 1) setPage(page - 1); else reload();
    } catch (err) {
      setDeleteError(isForbidden(err) ? NOT_ALLOWED : err.message);
    } finally {
      setDeleting(false);
    }
  };

  const { status, rows, total, error } = state;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PageToolbar
        left={
          <>
            {tabs}
            <CountBadge>
              {status === 'loading' && !rows.length ? '…' : `${total} ingredient${total === 1 ? '' : 's'}`}
            </CountBadge>
            {status === 'loading' && rows.length > 0 && <Spinner />}
          </>
        }
        right={
          <>
            <Button variant="ghost" onClick={reload} disabled={status === 'loading'}>
              <IconRefresh /> Refresh
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <IconPlus /> Create Ingredient
            </Button>
          </>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        {status === 'error' && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-chili/30 bg-chili-light px-4 py-3 text-[13px] text-chili-deep">
            <span className="min-w-0 flex-1">Could not load platform ingredients: {error.message}</span>
            <Button variant="ghost" onClick={reload}>Try again</Button>
          </div>
        )}

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse max-md:min-w-[720px]">
              <thead>
                <tr>
                  <Th>Ingredient</Th>
                  <Th>Product group</Th>
                  <Th>Category</Th>
                  <Th>Unit</Th>
                  <Th>Updated</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className={status === 'loading' ? 'opacity-60' : undefined}>
                {rows.map((r) => (
                  <tr key={r.id} className="group transition hover:bg-[#FAFBFD]">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-8.5 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-mint-light text-[15px]">
                          {r.image ? <img src={r.image} alt="" className="size-full object-cover" /> : '🥬'}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.name}</div>
                          {r.description && <div className="truncate text-[11.5px] text-ink-3">{r.description}</div>}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[12.5px]">{r.product_group.name || <span className="italic text-ink-3">—</span>}</Td>
                    <Td className="text-[12.5px]">{r.product_category.name || <span className="italic text-ink-3">—</span>}</Td>
                    <Td className="text-ink-2">{r.unit.name || '—'}</Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-ink-3">{fmtDate(r.updated_at)}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <IconButton title="Edit" onClick={() => { setEditing(r); setFormOpen(true); }}>
                          <IconEdit />
                        </IconButton>
                        <IconButton title="Delete" className="hover:border-chili hover:text-chili"
                          onClick={() => { setDeleteError(''); setPendingDelete(r); }}>
                          <IconTrash />
                        </IconButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {status === 'loading' && !rows.length && (
            <div className="grid place-items-center py-16"><Spinner className="size-6" /></div>
          )}
          {status === 'ready' && !rows.length && (
            <EmptyState
              title={query ? `No platform ingredients match “${query}”` : 'No platform ingredients yet'}
              sub={query ? 'Try a different search.' : 'Create the first one.'}
            />
          )}

          {total > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
              <span className="tabular-nums">{first}–{last} of {total}</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" disabled={page <= 1 || status === 'loading'} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="tabular-nums">Page {page} of {pages}</span>
                <Button variant="ghost" disabled={page >= pages || status === 'loading'} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <PlatformIngredientModal
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={onSaved}
      />

      <Modal
        open={!!pendingDelete}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Delete platform ingredient?"
        subtitle={pendingDelete ? `"${pendingDelete.name}" will be removed from the platform. Meals that use it may be affected.` : ''}
      >
        {deleteError && <div role="alert" className="text-xs font-medium text-chili">{deleteError}</div>}
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>Cancel</ModalButton>
          <ModalButton variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </ModalButton>
        </ModalActions>
      </Modal>
    </>
  );
}
