import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTopbar, { useSearch } from '../hooks/useTopbar.js';
import Modal, { ModalActions } from '../components/Modal.jsx';
import {
  Button, Card, FilterSelect, IconButton, CountBadge, StatusPill,
  PageToolbar, Th, Td, EmptyState, ModalButton, cx,
} from '../components/ui.jsx';
import { IconDownload, IconEdit, IconTrash, IconArrowRight } from '../components/icons.jsx';
import StatPanel from '../components/StatPanel.jsx';
import { rosterOverview, latestJoin, formatAsOf, formatCount } from '../lib/platform.js';
import { useToast } from '../components/Toast.jsx';
import { useCustomers } from '../state/CustomersProvider.jsx';
import { useFinance } from '../state/FinanceProvider.jsx';
import { subscriberIds, newSubscriberIds, newSubscriberSeries } from '../lib/finance.js';
import { downloadCSV } from '../lib/csv.js';

const PER_PAGE = 12;

export default function Customers() {
  useTopbar('Customers', 'Search customers…');
  const [search] = useSearch();
  const toast = useToast();

  const navigate = useNavigate();
  const { customers, deleteCustomers } = useCustomers();
  const { transactions } = useFinance();
  const [status, setStatus] = useState('');
  const [subsOnly, setSubsOnly] = useState(false);
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState('name-asc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [pendingDelete, setPendingDelete] = useState(null);

  const asOf = useMemo(() => latestJoin(customers), [customers]);

  /* Subscription state is read off the charge log, not a flag on the
     customer — an account that stops paying drops out on its own. */
  const subs = useMemo(() => subscriberIds(transactions), [transactions]);
  const freshSubs = useMemo(() => newSubscriberIds(transactions), [transactions]);
  const subSeries = useMemo(() => newSubscriberSeries(transactions), [transactions]);
  const isSubscriber = (c) => subs.has(String(c.id));

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = customers.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false;
      if (status && c.status !== status) return false;
      if (country && c.country !== country) return false;
      if (subsOnly && !isSubscriber(c)) return false;
      return true;
    });
    const [key, dir] = sort.split('-');
    return rows.sort((a, b) => {
      const cmp = key === 'joined' ? a.joined.localeCompare(b.joined) : a.name.localeCompare(b.name);
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [customers, search, status, country, sort, subsOnly, subs]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  /* Derived from the rows actually held in state, so deleting a customer
     or flipping a status moves these figures with the table. */
  const stats = useMemo(() => rosterOverview(customers), [customers]);

  /* The panel doubles as the status filter — the four counts are exactly
     the four things you would want to filter to, so making them inert and
     putting the same choice in a dropdown asks twice for one decision. */
  const pick = (next) => {
    setStatus(next === status ? '' : next);
    setSubsOnly(false);
    setPage(1);
  };

  const pickSubscribers = () => { setSubsOnly((v) => !v); setStatus(''); setPage(1); };

  const subscriberCount = useMemo(() => customers.filter(isSubscriber).length, [customers, subs]);
  const startedThisMonth = useMemo(
    () => customers.filter((c) => freshSubs.has(String(c.id))).length,
    [customers, freshSubs],
  );

  const overviewCards = [
    {
      label: 'All customers',
      value: formatCount(stats.total),
      note: `+${formatCount(stats.joinedThisWeek)} joined this week`,
      direction: 'up',
      trend: stats.totalSeries,
      filled: true,
      onClick: () => { setStatus(''); setSubsOnly(false); setPage(1); },
      selected: status === '' && !subsOnly,
      title: 'Show every customer',
    },
    {
      label: 'Active',
      value: formatCount(stats.active),
      note: `+${formatCount(stats.activeThisMonth)} joined this month`,
      direction: 'up',
      tone: 'up',
      trend: stats.activeSeries,
      onClick: () => pick('active'),
      selected: status === 'active',
      title: 'Filter to active customers',
    },
    {
      label: 'Inactive',
      value: formatCount(stats.inactive),
      note: `${formatCount(stats.becameInactive)} went quiet this month`,
      direction: 'down',
      tone: 'down',
      trend: stats.inactiveSeries,
      onClick: () => pick('inactive'),
      selected: status === 'inactive',
      title: 'Filter to lapsed customers',
    },
    {
      label: 'Subscribers',
      value: formatCount(subscriberCount),
      note: `+${formatCount(startedThisMonth)} started this month`,
      direction: 'up',
      tone: 'up',
      trend: subSeries,
      onClick: pickSubscribers,
      selected: subsOnly,
      title: 'Filter to customers on a live subscription',
    },
  ];

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => (allOnPageSelected ? next.delete(r.id) : next.add(r.id)));
      return next;
    });

  const confirmDelete = () => {
    const ids = pendingDelete === 'bulk' ? [...selected] : [pendingDelete];
    deleteCustomers(ids);
    setSelected(new Set());
    setPendingDelete(null);
    toast(`${ids.length} customer${ids.length === 1 ? '' : 's'} deleted`);
  };

  const exportCSV = () => {
    const head = ['name', 'email', 'phone', 'country', 'status', 'joined'];
    downloadCSV('akaani-customers.csv', [head, ...filtered.map((c) => head.map((k) => c[k]))]);
    toast(`Exported ${filtered.length} customers`);
  };

  return (
    <>
      <PageToolbar
        left={
          <>
            <FilterSelect value={status} onChange={(e) => { setStatus(e.target.value); setSubsOnly(false); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </FilterSelect>
            <FilterSelect value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}>
              <option value="">All countries</option>
              {['Nigeria', 'Ghana', 'Kenya', 'South Africa'].map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
            <FilterSelect value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="joined-desc">Newest first</option>
              <option value="joined-asc">Oldest first</option>
            </FilterSelect>
            <CountBadge>{filtered.length} of {stats.total}</CountBadge>
          </>
        }
        right={
          <>
            {selected.size > 0 && (
              <Button variant="danger" onClick={() => setPendingDelete('bulk')}>
                <IconTrash /> Delete {selected.size}
              </Button>
            )}
            <Button variant="ghost" onClick={exportCSV}><IconDownload /> Export</Button>
          </>
        }
      />

      <div className="px-7 py-5 max-md:px-4">
        <StatPanel
          className="mb-5"
          title="Customer overview"
          subtitle={`As of ${formatAsOf(stats.asOf)}`}
          cards={overviewCards}
          footer={
            subsOnly
              ? 'Filtered to customers on a live subscription — select the same card again to clear it.'
              : status
                ? `Filtered to ${status} customers — select the same card again to clear it.`
                : 'Select a card to filter the table below.'
          }
        />

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse max-md:min-w-[760px]">
              <thead>
                <tr>
                  <Th className="w-10">
                    <input type="checkbox" className="size-3.5 cursor-pointer accent-forest"
                      checked={allOnPageSelected} onChange={toggleAll} />
                  </Th>
                  <Th>Customer</Th>
                  <Th>Phone</Th>
                  <Th>Country</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="group transition hover:bg-[#FAFBFD]">
                    <Td>
                      <input type="checkbox" className="size-3.5 cursor-pointer accent-forest"
                        checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-8.5 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
                          style={{ background: c.bg, color: c.fg }}>
                          {c.initials}
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => navigate(`/customers/${c.id}`)}
                            className="block max-w-full cursor-pointer truncate text-left font-medium transition hover:text-mint-deep hover:underline"
                          >
                            {c.name}
                          </button>
                          <div className="truncate text-[11.5px] text-ink-3">{c.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="tabular-nums text-ink-2">{c.phone}</Td>
                    <Td className="text-ink-2">{c.country}</Td>
                    <Td><StatusPill status={c.status} /></Td>
                    <Td className="tabular-nums text-ink-2">{c.joined}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/customers/${c.id}`)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] font-medium text-ink-2 transition hover:border-forest/30 hover:text-forest"
                        >
                          Manage <IconArrowRight />
                        </button>
                        <IconButton title={`Edit ${c.name}`} onClick={() => navigate(`/customers/edit/${c.id}`)}>
                          <IconEdit />
                        </IconButton>
                        <IconButton
                          title={`Delete ${c.name}`}
                          className="hover:border-chili hover:text-chili"
                          onClick={() => setPendingDelete(c.id)}
                        >
                          <IconTrash />
                        </IconButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!rows.length && <EmptyState icon="👤" title="No customers match those filters" sub="Try clearing the search or filters." />}

          {pageCount > 1 && (
            <div className="flex flex-wrap items-center gap-1 border-t border-line-light px-5 py-3">
              <button disabled={current === 1} onClick={() => setPage(current - 1)}
                className="grid size-7.5 place-items-center rounded-md text-xs text-ink-3 transition hover:bg-canvas hover:text-ink disabled:opacity-35">
                ‹
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pageCount || Math.abs(p - current) <= 1)
                .map((p, i, arr) => (
                  <span key={p} className="flex items-center gap-1">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-0.5 text-xs text-ink-3">…</span>}
                    <button onClick={() => setPage(p)}
                      className={cx('grid size-7.5 place-items-center rounded-md text-xs font-medium transition',
                        p === current ? 'bg-forest text-white' : 'text-ink-3 hover:bg-canvas hover:text-ink')}>
                      {p}
                    </button>
                  </span>
                ))}
              <button disabled={current === pageCount} onClick={() => setPage(current + 1)}
                className="grid size-7.5 place-items-center rounded-md text-xs text-ink-3 transition hover:bg-canvas hover:text-ink disabled:opacity-35">
                ›
              </button>
              <span className="ml-auto text-xs text-ink-3 max-sm:hidden">
                {(current - 1) * PER_PAGE + 1}–{Math.min(current * PER_PAGE, filtered.length)} of {filtered.length}
              </span>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete customer?"
        subtitle={pendingDelete === 'bulk'
          ? `${selected.size} customers will be permanently removed.`
          : 'This customer will be permanently removed.'}
      >
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</ModalButton>
          <ModalButton variant="danger" onClick={confirmDelete}>Delete</ModalButton>
        </ModalActions>
      </Modal>
    </>
  );
}
