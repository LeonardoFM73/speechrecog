"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { authClient } from "@/services/api";

const TOKEN_KEY = "speechrecog.auth_token";
const USERNAME_KEY = "speechrecog.username";

export interface AuthState {
  token: string | null;
  username: string | null;
  loaded: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, apiBase }: { children: ReactNode; apiBase: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USERNAME_KEY);
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUsername(storedUser);
      authClient
        .me(apiBase, storedToken)
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USERNAME_KEY);
          setToken(null);
          setUsername(null);
        })
        .finally(() => setLoaded(true));
    } else {
      setLoaded(true);
    }
  }, [apiBase]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await authClient.login(apiBase, username, password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(USERNAME_KEY, res.username);
      setToken(res.access_token);
      setUsername(res.username);
    },
    [apiBase],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const res = await authClient.register(apiBase, username, password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(USERNAME_KEY, res.username);
      setToken(res.access_token);
      setUsername(res.username);
    },
    [apiBase],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, username, loaded, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
