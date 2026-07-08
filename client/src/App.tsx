import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import BoardListPage from './pages/BoardListPage.js';
import BoardPage from './pages/BoardPage.js';
import LoginPage from './pages/LoginPage.js';
import RegisterPage from './pages/RegisterPage.js';
import JoinPage from './pages/JoinPage.js';
import SettingsPage from './pages/SettingsPage.js';
import ViewPage from './pages/ViewPage.js';
import { useAuthStore } from './authStore.js';
import { api } from './api.js';
import { disconnectSocket } from './socket.js';

function useBootstrapAuth() {
  const token = useAuthStore((s) => s.token);
  const ready = useAuthStore((s) => s.ready);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);
  const setReady = useAuthStore((s) => s.setReady);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        const { user } = await api.me();
        if (!cancelled) setAuth(user, token);
      } catch {
        if (!cancelled) {
          clear();
          disconnectSocket();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setAuth, clear, setReady]);

  return ready;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const ready = useAuthStore((s) => s.ready);
  if (!ready) return <div className="container">Loading…</div>;
  if (!token || !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useBootstrapAuth();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/view/:token" element={<ViewPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <BoardListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/b/:boardId"
        element={
          <RequireAuth>
            <BoardPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
