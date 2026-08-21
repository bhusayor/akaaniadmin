import Drawer from '../../components/Drawer.jsx';
import Avatar from '../../components/Avatar.jsx';
import { Button, Badge, cx } from '../../components/ui.jsx';
import { IconRetry, IconWarning, IconClock, IconArrowRight } from '../../components/icons.jsx';
import { TX_TYPES, TX_STATUSES } from '../../lib/finance.js';
import { formatMoney } from '../../lib/money.js';

/* ═══════════════════════════════════════════════════════
   TRANSACTION DRAWER

   What happened to one charge, and what can be done about it.

   The available action follows the failure reason rather than the status
   alone: an expired card cannot be retried into working, so offering
   Retry there would waste the operator's time and the processor's.
   ═══════════════════════════════════════════════════════ */

function Row({ label, children }) {
  return (
    <div className="flex gap-4 border-b border-line-light py-2.5 last:border-0">
      <div className="w-32 shrink-0 text-[12px] text-ink-3">{label}</div>
      <div className="min-w-0 flex-1 text-[13px] text-ink">{children}</div>
    </div>
  );
}

export default function TransactionDrawer({ tx, onClose, onRetry, onRefund, onOpenCustomer }) {
  if (!tx) return null;

  const failed = tx.status === 'failed';
  const canRetry = failed && tx.retryable !== false;

  return (
    <Drawer open={!!tx} onClose={onClose} title="Transaction" width="w-[460px]">
      <div className="space-y-5 px-5 py-4">
        {/* ── Headline ── */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={TX_TYPES[tx.type].tone}>{TX_TYPES[tx.type].label}</Badge>
            <Badge className={TX_STATUSES[tx.status].tone}>{TX_STATUSES[tx.status].label}</Badge>
          </div>
          <div className={cx(
            'mt-2.5 text-[28px] font-bold leading-none tabular-nums',
            tx.status === 'refunded' ? 'text-chili-deep line-through' : 'text-ink',
          )}>
            {formatMoney(tx.amount, tx.currency)}
          </div>
          <div className="mt-1.5 text-[13px] text-ink-2">{tx.item}</div>
        </div>

        {/* ── What went wrong, when something did ── */}
        {failed && (
          <div className="rounded-card border border-chili/25 bg-chili-light px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <span className="mt-px grid size-6 shrink-0 place-items-center rounded-md bg-chili/12 text-chili-deep">
                <IconWarning />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-chili-deep">{tx.failureLabel}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-chili-deep/80">{tx.failureDetail}</div>
                <div className="mt-2 text-[12px] font-medium text-chili-deep/70">
                  {canRetry
                    ? 'This can be retried — the charge was never taken.'
                    : 'Retrying will fail the same way. The customer has to update their payment method.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {tx.status === 'pending' && tx.pendingNote && (
          <div className="flex items-start gap-2.5 rounded-card border border-amber/30 bg-amber-light px-4 py-3.5">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-amber/15 text-amber-deep">
              <IconClock size={13} />
            </span>
            <div className="text-[12.5px] leading-relaxed text-amber-deep">{tx.pendingNote}</div>
          </div>
        )}

        {/* ── The record ── */}
        <div>
          <Row label="Customer">
            <button
              onClick={() => onOpenCustomer(tx.customerId)}
              className="inline-flex cursor-pointer items-center gap-2 text-left transition hover:text-mint-deep"
            >
              <Avatar src={tx.avatar} initials={tx.initials} bg="#E1F5EE" fg="#0F6E56" size={24} />
              <span className="font-medium underline-offset-2 hover:underline">{tx.customer}</span>
              <IconArrowRight />
            </button>
          </Row>
          <Row label="Country">{tx.country}</Row>
          <Row label="Date">{tx.date}</Row>
          <Row label="Method">{tx.method}</Row>
          <Row label="Reference"><span className="font-mono text-[12px] text-ink-2">{tx.id}</span></Row>
          {tx.type === 'subscription' && (
            <Row label="Billing">{tx.interval === 'annual' ? 'Annual' : 'Monthly'}</Row>
          )}
        </div>

        {/* ── What can be done ── */}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {canRetry && (
            <Button onClick={() => onRetry(tx.id)}><IconRetry /> Retry charge</Button>
          )}
          {failed && !canRetry && (
            <Button variant="ghost" onClick={() => onOpenCustomer(tx.customerId)}>
              Ask customer to update card
            </Button>
          )}
          {tx.status === 'paid' && (
            <Button variant="danger" onClick={() => onRefund(tx.id)}>Refund this charge</Button>
          )}
          {(tx.status === 'pending' || tx.status === 'refunded') && (
            <span className="text-[12.5px] text-ink-3">
              {tx.status === 'pending'
                ? 'Nothing to do until the processor settles.'
                : 'This charge has already been reversed.'}
            </span>
          )}
        </div>
      </div>
    </Drawer>
  );
}
