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

export type UserRole = "user" | "admin";

export interface AuthState {
  token: string | null;
  username: string | null;
  role: UserRole | null;
  loaded: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginStudent: (customId: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  ssoLogin: (jwt: string, username: string, role: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, apiBase }: { children: ReactNode; apiBase: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USERNAME_KEY);
    const storedRole = localStorage.getItem(USERNAME_KEY + ".role");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUsername(storedUser);
      setRole((storedRole as UserRole) || "user");
      authClient
        .me(apiBase, storedToken)
        .then((data) => {
          const newRole = data.role as UserRole || "user";
          setRole(newRole);
          localStorage.setItem(USERNAME_KEY + ".role", newRole);
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USERNAME_KEY);
          localStorage.removeItem(USERNAME_KEY + ".role");
          setToken(null);
          setUsername(null);
          setRole(null);
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
      localStorage.setItem(USERNAME_KEY + ".role", res.role);
      setToken(res.access_token);
      setUsername(res.username);
      setRole(res.role as UserRole);
    },
    [apiBase],
  );

  const loginStudent = useCallback(
    async (customId: string, password: string) => {
      const res = await authClient.loginStudent(apiBase, customId, password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(USERNAME_KEY, res.username);
      localStorage.setItem(USERNAME_KEY + ".role", res.role);
      setToken(res.access_token);
      setUsername(res.username);
      setRole(res.role as UserRole);
    },
    [apiBase],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const res = await authClient.register(apiBase, username, password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(USERNAME_KEY, res.username);
      localStorage.setItem(USERNAME_KEY + ".role", res.role);
      setToken(res.access_token);
      setUsername(res.username);
      setRole(res.role as UserRole);
    },
    [apiBase],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(USERNAME_KEY + ".role");
    setToken(null);
    setUsername(null);
    setRole(null);
  }, []);

  const ssoLogin = useCallback(
    (jwt: string, username: string, role: string) => {
      localStorage.setItem(TOKEN_KEY, jwt);
      localStorage.setItem(USERNAME_KEY, username);
      localStorage.setItem(USERNAME_KEY + ".role", role);
      setToken(jwt);
      setUsername(username);
      setRole(role as UserRole);
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{ token, username, role, loaded, login, loginStudent, register, ssoLogin, logout }}
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
