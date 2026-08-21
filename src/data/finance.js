/* ═══════════════════════════════════════════════════════
   FINANCE FIXTURES

   Two streams: recurring subscriptions, and one-off recipe-book sales.

   Amounts are recorded in the currency they were actually charged in.
   Nigerian customers pay in ₦; the recipe books are listed on the website
   in $ (see data/recipeGroups.js), and diaspora subscribers pay in $ too.
   Nothing here converts between them — the page scopes to one currency at
   a time instead of inventing an exchange rate.
   ═══════════════════════════════════════════════════════ */

import { CUSTOMERS } from './customers.js';
import { RECIPE_GROUP_SEED } from './recipeGroups.js';

export const PLAN_SEED = [
  {
    id: 'p-starter', name: 'Lu Starter', interval: 'monthly', currency: 'NGN',
    price: 2500, subscribers: 180, active: true,
    blurb: 'Meal plans and macros. One profile.',
  },
  {
    id: 'p-plus', name: 'Lu Plus', interval: 'monthly', currency: 'NGN',
    price: 4500, subscribers: 120, active: true,
    blurb: 'Everything in Starter, plus Lu insights and grocery lists.',
  },
  {
    id: 'p-plus-year', name: 'Lu Plus — Annual', interval: 'annual', currency: 'NGN',
    price: 45000, subscribers: 60, active: true,
    blurb: 'Lu Plus billed yearly. Two months free.',
  },
  {
    id: 'p-family', name: 'Lu Family', interval: 'monthly', currency: 'NGN',
    price: 7500, subscribers: 28, active: true,
    blurb: 'Up to five profiles under one household.',
  },
  {
    id: 'p-global', name: 'Lu Plus (Global)', interval: 'monthly', currency: 'USD',
    price: 6.99, subscribers: 74, active: true,
    blurb: 'Lu Plus for subscribers billed outside Nigeria.',
  },
  {
    id: 'p-global-year', name: 'Lu Plus (Global) — Annual', interval: 'annual', currency: 'USD',
    price: 69, subscribers: 22, active: true,
    blurb: 'Global Lu Plus billed yearly.',
  },
  {
    id: 'p-legacy', name: 'Early Bird', interval: 'monthly', currency: 'NGN',
    price: 1500, subscribers: 15, active: false,
    blurb: 'Closed to new signups. Existing subscribers keep the rate.',
  },
];

/* Deterministic, so the tables never reshuffle between renders. */
const seeded = (n) => {
  const x = Math.sin(n * 7919) * 10000;
  return x - Math.floor(x);
};

const pad = (n) => String(n).padStart(2, '0');

/** The 14 months ending with the current one. */
function months(count, end = new Date()) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return out;
}

export const MONTHS = months(14);

/* The newest month is only partly elapsed — dating a charge into the future
   would make this month's revenue look complete when it isn't.
   Days are scaled into the elapsed range rather than clamped to it, since
   clamping would pile every late-month charge onto today's date. */
const TODAY = new Date().toISOString().slice(0, 10);
const TODAY_MONTH = TODAY.slice(0, 7);
const TODAY_DAY = Number(TODAY.slice(8, 10));

const dayIn = (month, raw) => {
  const day = month === TODAY_MONTH
    ? 1 + Math.floor(((raw - 1) / 27) * (TODAY_DAY - 1))
    : raw;
  return `${month}-${pad(day)}`;
};

const METHODS = ['Paystack', 'Paystack', 'Flutterwave', 'Card', 'Bank transfer'];

/**
 * Why a charge did not go through.
 *
 * The reason decides what can be done about it, so it is recorded on the
 * transaction rather than left for someone to guess: an expired card needs
 * the customer, a processor timeout just needs retrying.
 */
const FAILURE_REASONS = [
  { code: 'insufficient_funds', label: 'Insufficient funds', retryable: true,
    detail: 'The account did not have enough balance at the time of the charge.' },
  { code: 'card_expired', label: 'Card expired', retryable: false,
    detail: 'The card on file has passed its expiry date and cannot be charged again.' },
  { code: 'card_declined', label: 'Declined by bank', retryable: true,
    detail: 'The issuing bank rejected the charge without giving a specific reason.' },
  { code: 'processor_timeout', label: 'Processor timeout', retryable: true,
    detail: 'The payment processor did not respond in time. The charge was never taken.' },
  { code: 'limit_exceeded', label: 'Transaction limit exceeded', retryable: false,
    detail: "The amount is above the card's per-transaction limit." },
];

/** Pending charges are waiting on the processor, not on us. */
const PENDING_NOTES = [
  'Awaiting confirmation from the processor.',
  'Bank transfer initiated — funds not yet settled.',
  'Under review by the payment provider.',
];

/**
 * Books carry a local naira price alongside the dollar price the website
 * lists. This is a separate price point, not a conversion — a ₦ figure
 * derived from today's rate would drift against every past sale.
 */
const NGN_BOOK_PRICE = { 4.99: 6500, 5.99: 7500, 3.99: 4500 };

const BOOKS = RECIPE_GROUP_SEED.filter((g) => g.status === 'live');

/* Nigerian customers are billed on local rails in ₦; everyone else pays
   by card in $. That decides the currency for both streams, so a
   subscriber's plan and their book purchases always agree. */
const billingCurrency = (customer) => (customer.country === 'Nigeria' ? 'NGN' : 'USD');

/** The failure or waiting note that belongs with a status. */
function detailFor(status, n) {
  if (status === 'failed') {
    const r = FAILURE_REASONS[Math.floor(seeded(n + 211) * FAILURE_REASONS.length)];
    return { failure: r.code, failureLabel: r.label, failureDetail: r.detail, retryable: r.retryable };
  }
  if (status === 'pending') {
    return { pendingNote: PENDING_NOTES[Math.floor(seeded(n + 212) * PENDING_NOTES.length)] };
  }
  return {};
}

/* Customers billed on each rail, so a subscriber's plan and their book
   purchases always agree on currency. */
const BY_CURRENCY = {
  NGN: CUSTOMERS.filter((c) => billingCurrency(c) === 'NGN'),
  USD: CUSTOMERS.filter((c) => billingCurrency(c) === 'USD'),
};

/**
 * The charge log is generated from the plan roster rather than invented
 * separately, so the last month of the revenue chart lands on the same
 * figure as the MRR card. Two independently-made-up numbers would
 * contradict each other on screen.
 *
 * Growth scales the base from 45% to 100% across the window, and a
 * subscriber slot keeps the same customer month to month — a recurring
 * charge should show the same name recurring.
 */
function buildTransactions() {
  const rows = [];
  let n = 0;

  MONTHS.forEach((month, mi) => {
    const scale = 0.45 + (0.55 * mi) / (MONTHS.length - 1);

    /* ── Subscription charges ── */
    PLAN_SEED.forEach((plan) => {
      const pool = BY_CURRENCY[plan.currency];
      /* Annual subscribers renew once a year, so only a twelfth of them
         are charged in any given month. */
      const perMonth = plan.interval === 'annual' ? plan.subscribers / 12 : plan.subscribers;
      const count = Math.round(perMonth * scale * (plan.active ? 1 : 0.6));

      for (let slot = 0; slot < count; slot++) {
        n++;
        const r = seeded(n);
        /* Slot, not n — the same seat is held by the same person. */
        const customer = pool[(slot * 7 + plan.name.length * 13) % pool.length];
        const status = r > 0.965 ? 'failed' : r > 0.945 ? 'pending' : r > 0.935 ? 'refunded' : 'paid';
        rows.push({
          id: `tx-s-${n}`,
          date: dayIn(month, 1 + Math.floor(seeded(n + 40) * 27)),
          type: 'subscription',
          item: plan.name,
          planId: plan.id,
          interval: plan.interval,
          customerId: customer.id,
          customer: customer.name,
          avatar: customer.avatar,
          initials: customer.initials,
          country: customer.country,
          amount: plan.price,
          currency: plan.currency,
          method: METHODS[Math.floor(seeded(n + 77) * METHODS.length)],
          status,
          ...detailFor(status, n),
        });
      }
    });

    /* ── Recipe book sales — one-off, and spikier than renewals ── */
    const bookCount = Math.round(22 * scale) + (mi % 4 === 0 ? 8 : 0);
    for (let i = 0; i < bookCount; i++) {
      n++;
      const r = seeded(n);
      const book = BOOKS[Math.floor(seeded(n + 310) * BOOKS.length)];
      const customer = CUSTOMERS[Math.floor(seeded(n + 620) * CUSTOMERS.length)];
      const currency = billingCurrency(customer);
      const status = r > 0.96 ? 'refunded' : r > 0.94 ? 'pending' : 'paid';
      rows.push({
        id: `tx-b-${n}`,
        date: dayIn(month, 1 + Math.floor(seeded(n + 41) * 27)),
        type: 'book',
        item: book.name,
        bookId: book.id,
        image: book.image,
        customerId: customer.id,
        customer: customer.name,
        avatar: customer.avatar,
        initials: customer.initials,
        country: customer.country,
        amount: currency === 'NGN' ? NGN_BOOK_PRICE[book.price] : book.price,
        currency,
        method: METHODS[Math.floor(seeded(n + 78) * METHODS.length)],
        status,
        ...detailFor(status, n),
      });
    }
  });

  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export const TRANSACTION_SEED = buildTransactions();
