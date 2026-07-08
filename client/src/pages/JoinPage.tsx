import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuthStore } from '../authStore.js';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.ready);
  const authToken = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const location = useLocation();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!authToken || !user) return;
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { boardId } = await api.acceptInvite(token);
        if (!cancelled) navigate(`/b/${boardId}`, { replace: true });
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, authToken, user, token, navigate]);

  if (!authReady) return <div className="container">Loading…</div>;
  if (!authToken || !user) {
    const next = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark">RK</div>
          <div className="auth-brand-name">Realtime Kanban</div>
        </div>
        <h1>Joining board…</h1>
        {err ? (
          <>
            <p className="auth-sub">Could not accept this invite.</p>
            <div className="form-error">{err}</div>
          </>
        ) : (
          <p className="auth-sub">One moment while we add you as a member.</p>
        )}
      </div>
    </div>
  );
}
