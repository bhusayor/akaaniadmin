import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useTopbar from '../hooks/useTopbar.js';
import Avatar from '../components/Avatar.jsx';
import {
  Button, Card, EmptyState, Field, Input, Select, cx,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useCustomers } from '../state/CustomersProvider.jsx';
import { latestJoin } from '../lib/platform.js';

const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa'];

/** Enough to catch a typo, not so strict it rejects a real address. */
const emailLooksValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function CustomerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { customers, getCustomer, updateCustomer, setStatus } = useCustomers();

  const customer = getCustomer(id);
  useTopbar(customer ? `Edit ${customer.name}` : 'Edit customer');

  const asOf = useMemo(() => latestJoin(customers), [customers]);

  const [form, setForm] = useState(() => ({
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    country: customer?.country ?? COUNTRIES[0],
    status: customer?.status ?? 'active',
  }));
  const [touched, setTouched] = useState(false);

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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const errors = {
    name: form.name.trim() ? null : 'A customer needs a name.',
    email: !form.email.trim()
      ? 'A customer needs an email.'
      : emailLooksValid(form.email)
        ? null
        : 'That does not look like an email address.',
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = () => {
    setTouched(true);
    if (invalid) {
      toast('Fix the highlighted fields first');
      return;
    }
    const { status, ...fields } = form;
    updateCustomer(customer.id, {
      ...fields,
      name: fields.name.trim(),
      email: fields.email.trim(),
    });
    /* Status goes through its own path so the lapse date stays in step. */
    if (status !== customer.status) setStatus(customer.id, status, asOf);
    toast(`${fields.name.trim()} updated`);
    navigate(`/customers/${customer.id}`);
  };

  return (
    <div className="space-y-5 px-7 py-5 max-md:px-4">
      <Link
        to={`/customers/${customer.id}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition hover:text-ink"
      >
        ← Back to {customer.name}
      </Link>

      <Card>
        <div className="flex items-center gap-3.5 border-b border-line px-6 py-5">
          <Avatar src={customer.avatar} initials={customer.initials} bg={customer.bg} fg={customer.fg} size={44} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink">Edit customer</div>
            <div className="mt-0.5 text-[12px] text-ink-3">
              Joined {customer.joined} · member #{customer.id}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 px-6 py-6 max-sm:grid-cols-1">
          <Field label="Full name" required error={touched ? errors.name : null}>
            <Input
              value={form.name}
              onChange={set('name')}
              className={cx(touched && errors.name && 'border-chili')}
            />
          </Field>

          <Field label="Email" required error={touched ? errors.email : null}>
            <Input
              type="email"
              value={form.email}
              onChange={set('email')}
              className={cx(touched && errors.email && 'border-chili')}
            />
          </Field>

          <Field label="Phone">
            <Input value={form.phone} onChange={set('phone')} />
          </Field>

          <Field label="Country">
            <Select value={form.country} onChange={set('country')}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>

          <Field
            label="Status"
            hint={
              form.status === 'inactive' && customer.status === 'active'
                ? 'Marking this account inactive records today as the date it went quiet.'
                : form.status === 'active' && customer.status === 'inactive'
                  ? 'Reactivating clears the date this account went quiet.'
                  : null
            }
          >
            <Select value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line-light px-6 py-4">
          <Button variant="ghost" onClick={() => navigate(`/customers/${customer.id}`)}>Cancel</Button>
          <Button onClick={save}>Save changes</Button>
        </div>
      </Card>
    </div>
  );
}
