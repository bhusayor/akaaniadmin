import { useMemo, useState } from 'react';
import { useIngredients } from '../state/IngredientsProvider.jsx';
import useTopbar, { useSearch } from '../hooks/useTopbar.js';
import Modal, { ModalActions } from '../components/Modal.jsx';
import {
  Badge, Button, Card, FilterSelect, IconButton, CountBadge,
  PageToolbar, Th, Td, EmptyState, ModalButton,
} from '../components/ui.jsx';
import { IconDownload, IconUpload, IconPlus, IconEdit, IconTrash } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import IngredientFormModal from '../features/ingredients/IngredientFormModal.jsx';
import CsvImportModal from '../features/ingredients/CsvImportModal.jsx';
import { PRODUCT_GROUPS } from '../lib/wafctMatch.js';
import { USDA_SOURCE_PREFIX } from '../lib/foodDatabase.js';
import {
  hasNutrition, isAiSource, fmtMacro, WAFCT_SOURCE,
} from '../lib/ingredients.js';
import { downloadCSV } from '../lib/csvImport.js';


function SourceBadge({ record }) {
  if (record.source === WAFCT_SOURCE) {
    return <Badge tone="mint" title={record.source_code || ''}>WAFCT</Badge>;
  }
  if (String(record.source || '').startsWith(USDA_SOURCE_PREFIX)) {
    return <Badge tone="ocean" title={record.source_code || ''}>USDA</Badge>;
  }
  if (isAiSource(record.source)) {
    return <Badge tone="amber" title={`${record.source} — estimated, not measured`}>AI est.</Badge>;
  }
  if (!hasNutrition(record)) return <Badge>No data</Badge>;
  if (record.source === 'csv') return <Badge tone="ocean">CSV</Badge>;
  return <Badge tone="grape">Manual</Badge>;
}

export default function Ingredients() {
  useTopbar('Ingredients', 'Search ingredients…');
  const [search] = useSearch();
  const toast = useToast();

  const { ingredients, createIngredient, createIngredients, updateIngredient, deleteIngredient } = useIngredients();
  const [group, setGroup] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ingredients.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.description || '').toLowerCase().includes(q)) return false;
      if (group && r.product_group !== group) return false;
      if (sourceFilter === 'wafct' && r.source !== WAFCT_SOURCE) return false;
      if (sourceFilter === 'ai' && !isAiSource(r.source)) return false;
      if (sourceFilter === 'manual' && (r.source === WAFCT_SOURCE || isAiSource(r.source) || !hasNutrition(r))) return false;
      if (sourceFilter === 'none' && hasNutrition(r)) return false;
      return true;
    });
  }, [ingredients, search, group, sourceFilter]);

  /* One write path for the form and the importer alike. */
  const submitForm = (data) => {
    if (editing) {
      updateIngredient(editing.id, data);
      toast('Ingredient updated');
    } else {
      createIngredient(data);
      toast('Ingredient created');
    }
    setFormOpen(false);
    setEditing(null);
  };

  const importRecords = (created) => {
    createIngredients(created);
    if (created.length) toast(`${created.length} imported`);
  };

  const confirmDelete = () => {
    deleteIngredient(pendingDelete.id);
    setPendingDelete(null);
    toast('Ingredient deleted');
  };

  const exportCSV = () => {
    const head = ['name', 'description', 'unit', 'product_group', 'product_category', 'product_url',
      'calories', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'allergens', 'source', 'source_code'];
    downloadCSV('akaani-ingredients.csv', [
      head,
      /* Arrays would stringify with commas and split the cell in two. */
      ...ingredients.map((r) => head.map((k) => (
        Array.isArray(r[k]) ? r[k].join(' | ') : r[k] ?? ''
      ))),
    ]);
    toast(`Exported ${ingredients.length} ingredients`);
  };

  return (
    <>
      <PageToolbar
        left={
          <>
            <FilterSelect value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">All product groups</option>
              {PRODUCT_GROUPS.map((g) => <option key={g}>{g}</option>)}
            </FilterSelect>
            <FilterSelect value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="">All sources</option>
              <option value="wafct">WAFCT (measured)</option>
              <option value="ai">AI estimate</option>
              <option value="manual">Manual</option>
              <option value="none">No nutrition data</option>
            </FilterSelect>
            <CountBadge>
              {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'}
            </CountBadge>
          </>
        }
        right={
          <>
            <Button variant="ghost" onClick={exportCSV}><IconDownload /> Export</Button>
            <Button variant="ghost" onClick={() => setCsvOpen(true)}><IconUpload /> Import CSV</Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <IconPlus /> Create Ingredient
            </Button>
          </>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse max-md:min-w-[760px]">
              <thead>
                <tr>
                  <Th>Ingredient</Th>
                  <Th>Product group</Th>
                  <Th>Unit</Th>
                  <Th>Nutrition (per 100g)</Th>
                  <Th>Allergens</Th>
                  <Th>Source</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
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
                    <Td>
                      <div className="text-[12.5px]">{r.product_group || <span className="italic text-ink-3">—</span>}</div>
                      {r.product_category && <div className="text-[11.5px] text-ink-3">{r.product_category}</div>}
                    </Td>
                    <Td className="text-ink-2">{r.unit || '—'}</Td>
                    <Td>
                      {hasNutrition(r) ? (
                        <div className="whitespace-nowrap tabular-nums">
                          <span className="font-semibold">{r.calories === null ? '—' : `${r.calories} kcal`}</span>
                          <div className="text-[11px] text-ink-3">
                            P {fmtMacro(r.protein_g, 'g')} · C {fmtMacro(r.carbs_g, 'g')} ·
                            {' '}F {fmtMacro(r.fat_g, 'g')} · Fb {fmtMacro(r.fibre_g, 'g')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs italic text-ink-3">Not set</span>
                      )}
                    </Td>
                    <Td>
                      {/* An empty list means "no allergens recorded", which
                          is not a claim that the food has none — the dash
                          has to read as absence of data, not absence of
                          allergens. */}
                      {r.allergens?.length ? (
                        <div className="flex max-w-40 flex-wrap gap-1">
                          {r.allergens.map((a) => (
                            <span key={a} className="rounded bg-amber-light px-1.5 py-px text-[10px] font-semibold whitespace-nowrap text-amber-deep">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11.5px] italic text-ink-3">None recorded</span>
                      )}
                    </Td>
                    <Td><SourceBadge record={r} /></Td>
                    <Td>
                      <div className="flex gap-1">
                        <IconButton title="Edit" onClick={() => { setEditing(r); setFormOpen(true); }}>
                          <IconEdit />
                        </IconButton>
                        <IconButton title="Delete" className="hover:border-chili hover:text-chili"
                          onClick={() => setPendingDelete(r)}>
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
              title={ingredients.length ? 'No ingredients match those filters' : 'No ingredients yet'}
              sub={ingredients.length ? 'Try clearing the search or filters.' : 'Create one, or import a CSV to add them in bulk.'}
            />
          )}
        </Card>
      </div>

      <IngredientFormModal
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={submitForm}
      />

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} onImport={importRecords} />

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete ingredient?"
        subtitle={pendingDelete ? `"${pendingDelete.name}" will be permanently removed.` : ''}
      >
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</ModalButton>
          <ModalButton variant="danger" onClick={confirmDelete}>Delete</ModalButton>
        </ModalActions>
      </Modal>
    </>
  );
}
