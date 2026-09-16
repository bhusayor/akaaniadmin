import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider.jsx';
import { Button, Field, Input } from '../components/ui.jsx';
import { IconPin } from '../components/icons.jsx';

/** Sign-in against platform-api's user login (POST /v1/auth/login). */
export default function Login() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      // The backend deliberately says the same thing for an unknown email
      // and a wrong password; pass that on rather than guessing which.
      setError(err.message || 'Login failed.');
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-forest px-4 py-10">
      <div className="w-full max-w-[380px] animate-fade-up">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-accent shadow-tall">
            <IconPin size={26} />
          </div>
          <div className="text-[24px] font-bold tracking-[-0.03em] text-white">akaani</div>
        </div>

        <form onSubmit={submit} className="rounded-modal bg-surface p-7 shadow-tall">
          <h1 className="text-base font-semibold text-ink">Sign in</h1>
          <p className="mb-5 mt-1 text-[13px] text-ink-3">Use your Akaani account.</p>

          <div className="flex flex-col gap-3.5">
            <Field label="Email">
              <Input
                type="email"
                autoFocus
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </div>

          {error && (
            <div role="alert" className="mt-3.5 rounded-lg bg-chili-light px-3 py-2 text-[12.5px] font-medium text-chili-deep">
              {error}
            </div>
          )}

          <Button type="submit" disabled={busy} className="mt-5 w-full justify-center">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
