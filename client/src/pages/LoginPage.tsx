import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuthStore } from '../authStore.js';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      const { user, token } = await api.login({ identifier, password });
      setAuth(user, token);
      navigate(next, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark">RK</div>
          <div className="auth-brand-name">Realtime Kanban</div>
        </div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in to keep collaborating on your boards.</p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Email or username
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {err && <div className="form-error">{err}</div>}
          <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="auth-alt">
          No account? <Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create one</Link>
        </div>
      </div>
    </div>
  );
}
