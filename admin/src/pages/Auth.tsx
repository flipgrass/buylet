import { useState, type FormEvent } from 'react';
import { api, setCsrf, type Me } from '../api.ts';

export function Auth({ onDone }: { onDone: (m: Me) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const body = Object.fromEntries(f.entries());
      const me = await api<Me>('POST', mode === 'login' ? '/api/login' : '/api/signup', body);
      setCsrf(me.csrf);
      onDone(me);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <h1>Where to Buy</h1>
      <form onSubmit={submit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create your brand account'}</h2>
        {mode === 'signup' && (
          <label>Brand name<input name="brandName" required maxLength={100} autoComplete="organization" /></label>
        )}
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" disabled={busy}>{mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
