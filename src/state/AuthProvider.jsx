import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import * as api from '../lib/api.js';

/* The platform-api session. The token itself lives in lib/api.js, which
   sends it on every request and drops it when the backend reports it
   expired; this provider only mirrors it into React. */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(api.getSession);
  /* True after an explicit logout, so the guard does not send the next
     person who signs in back to the page the last one was on. An expired
     session leaves it false: that user wants to pick up where they were. */
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => api.onSessionChange(setSession), []);

  const login = useCallback(async (email, password) => {
    const next = await api.login({ email, password });
    setSignedOut(false);
    api.setSession(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    setSignedOut(true);
    api.clearSession();
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, signedOut, login, logout }),
    [session, signedOut, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Sends anyone without a session to /login, remembering where they were going. */
export function RequireAuth({ children }) {
  const { session, signedOut } = useAuth();
  const location = useLocation();
  if (!session) {
    return (
      <Navigate to="/login" replace
        state={signedOut ? undefined : { from: location.pathname + location.search }} />
    );
  }
  return children;
}

/** "Ada Obi" → "AO"; falls back to the email's first letter. */
export function initialsOf(user) {
  const parts = [user?.first_name, user?.last_name].filter(Boolean);
  if (parts.length) return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (user?.email?.[0] || '?').toUpperCase();
}

export function displayName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  return name || user?.email || 'Signed in';
}
