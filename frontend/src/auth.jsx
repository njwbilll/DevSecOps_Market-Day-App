import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const refresh = useCallback(async () => {
    const me = await api.get('/me');
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    refresh()
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('md:logout', onLogout);
    return () => window.removeEventListener('md:logout', onLogout);
  }, []);

  const login = async (username, password) => {
    const { token } = await api.post('/auth/login', { username, password });
    tokenStore.set(token);
    return refresh();
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
