import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import Avatar from '../components/Avatar.jsx';
import Modal, { ModalActions } from '../components/Modal.jsx';
import {
  Button, Card, Badge, StatusPill, EmptyState, ModalButton, Th, Td, cx,
} from '../components/ui.jsx';
import { IconEdit, IconTrash, IconArrowRight } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useCustomers } from '../state/CustomersProvider.jsx';
import { useFinance } from '../state/FinanceProvider.jsx';
import { formatAsOf, latestJoin } from '../lib/platform.js';
import { formatMoney, totalsByCurrency, formatTotals } from '../lib/money.js';
import { TX_TYPES, TX_STATUSES, isRealised } from '../lib/finance.js';

function Fact({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</div>
      <div className="mt-1 text-[13.5px] text-ink">{children}</div>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { customers, getCustomer, setStatus, deleteCustomers } = useCustomers();
  const { transactions } = useFinance();

  const customer = getCustomer(id);
  useTopbar(customer ? customer.name : 'Customer');

  const [pendingDelete, setPendingDelete] = useState(false);

  const asOf = useMemo(() => latestJoin(customers), [customers]);

  /* This customer's own payment history, so the record shows what they are
     worth rather than only who they are. */
  const history = useMemo(
    () => transactions
      .filter((t) => String(t.customerId) === String(id))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, id],
  );

  const spend = useMemo(() => totalsByCurrency(history.filter(isRealised)), [history]);
  const plan = history.find((t) => t.type === 'subscription');
  const lastPaid = history.find(isRealised);

  if (!customer) {
    return (
      <div className="px-7 py-5 max-md:px-4">
        <EmptyState icon="👤" title="Customer not found" sub="They may have been deleted." />
        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate('/customers')}>Back to customers</Button>
        </div>
      </div>
    );
  }

  const lapsed = customer.status === 'inactive';

  return (
    <>
      <div className="space-y-5 px-7 py-5 max-md:px-4">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition hover:text-ink"
        >
          ← All customers
        </Link>

        {/* ── Identity and the actions that act on it ── */}
        <Card>
          <div className="flex flex-wrap items-center gap-4 px-6 py-5">
            <Avatar src={customer.avatar} initials={customer.initials} bg={customer.bg} fg={customer.fg} size={62} />
            <div className="min-w-45 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-[-0.02em] text-ink">{customer.name}</h2>
                <StatusPill status={customer.status} />
              </div>
              <div className="mt-1 text-[13px] text-ink-2">{customer.email}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => navigate(`/customers/edit/${customer.id}`)}>
                <IconEdit /> Edit details
              </Button>
              <Button
                variant={lapsed ? 'primary' : 'ghost'}
                onClick={() => {
                  setStatus(customer.id, lapsed ? 'active' : 'inactive', asOf);
                  toast(lapsed ? `${customer.name} reactivated` : `${customer.name} marked inactive`);
                }}
              >
                {lapsed ? 'Reactivate' : 'Mark inactive'}
              </Button>
              <Button variant="danger" onClick={() => setPendingDelete(true)}>
                <IconTrash /> Delete
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-5 border-t border-line-light px-6 py-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <Fact label="Phone">{customer.phone}</Fact>
            <Fact label="Country">{customer.country}</Fact>
            <Fact label="Joined">{formatAsOf(customer.joined)}</Fact>
            {/* Not a second copy of the status — the pill above already
                says that. When the account is live the useful fact is when
                money last moved; when it lapsed, when it went quiet. */}
            <Fact label={lapsed ? 'Went quiet' : 'Last payment'}>
              {lapsed
                ? (customer.lapsedOn ? formatAsOf(customer.lapsedOn) : 'Date not recorded')
                : (lastPaid ? `${formatAsOf(lastPaid.date)} · ${formatMoney(lastPaid.amount, lastPaid.currency)}` : 'No payments yet')}
            </Fact>
          </div>
        </Card>

        {/* ── What they are worth ── */}
        <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
          <Card className="px-6 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              Lifetime spend
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {formatTotals(spend)}
            </div>
            <div className="mt-1.5 text-[12px] text-ink-3">
              {history.filter(isRealised).length} payments cleared
            </div>
          </Card>

          <Card className="px-6 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              Current plan
            </div>
            <div className="mt-2 text-[15px] font-semibold text-ink">
              {plan ? plan.item : 'No subscription'}
            </div>
            <div className="mt-1.5 text-[12px] text-ink-3">
              {plan
                ? `${formatMoney(plan.amount, plan.currency)} · last charged ${plan.date}`
                : 'This customer has never subscribed.'}
            </div>
          </Card>

          <Card className="px-6 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              Recipe books
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {history.filter((t) => t.type === 'book' && isRealised(t)).length}
            </div>
            <div className="mt-1.5 text-[12px] text-ink-3">purchased outright</div>
          </Card>
        </div>

        {/* ── Payment history ── */}
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
            <div className="min-w-45 flex-1">
              <div className="text-[14px] font-semibold text-ink">Payment history</div>
              <div className="mt-0.5 text-[12px] text-ink-3">
                Every charge on this account, newest first.
              </div>
            </div>
            <Link
              to="/finances"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-mint-deep transition hover:text-forest"
            >
              Open Finances <IconArrowRight />
            </Link>
          </div>

          {history.length === 0 ? (
            <EmptyState icon="🧾" title="No payments yet" sub="Nothing has been charged to this account." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>What they paid for</Th>
                    <Th>Method</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 15).map((t) => (
                    <tr key={t.id} className="transition hover:bg-surface-2">
                      <Td className="whitespace-nowrap tabular-nums text-ink-2">{t.date}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Badge className={TX_TYPES[t.type].tone}>{TX_TYPES[t.type].label}</Badge>
                          <span className="truncate text-ink-2">{t.item}</span>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-2">{t.method}</Td>
                      <Td className={cx(
                        'text-right font-semibold whitespace-nowrap tabular-nums',
                        t.status === 'refunded' ? 'text-chili-deep line-through' : 'text-ink',
                      )}>
                        {formatMoney(t.amount, t.currency)}
                      </Td>
                      <Td>
                        <Badge className={TX_STATUSES[t.status].tone}>{TX_STATUSES[t.status].label}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length > 15 && (
                <div className="border-t border-line-light px-5 py-3 text-center text-[12px] text-ink-3">
                  Showing the 15 most recent of {history.length} charges.
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={pendingDelete}
        onClose={() => setPendingDelete(false)}
        title="Delete customer?"
        subtitle={`${customer.name} will be permanently removed, along with their place in every report.`}
      >
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setPendingDelete(false)}>Cancel</ModalButton>
          <ModalButton
            variant="danger"
            onClick={() => {
              deleteCustomers([customer.id]);
              toast(`${customer.name} deleted`);
              navigate('/customers');
            }}
          >
            Delete
          </ModalButton>
        </ModalActions>
      </Modal>
    </>
  );
}
