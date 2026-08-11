"use client";

import { ReactNode, useEffect, useState } from "react";
import { SessionProvider } from "@/components/SessionProvider";
import { AuthProvider } from "@/context/AuthContext";
import LoginPage from "@/components/LoginPage";
import { authClient } from "@/services/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "speechrecog.auth_token";
const USERNAME_KEY = "speechrecog.username";

export default function SessionRoot({ children, apiBase }: { children: ReactNode; apiBase: string }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USERNAME_KEY);
    if (!storedToken || !storedUser) {
      setLoggedIn(false);
      return;
    }
    authClient
      .me(apiBase, storedToken)
      .then(() => {
        setToken(storedToken);
        setLoggedIn(true);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USERNAME_KEY);
        setLoggedIn(false);
      });
  }, [apiBase]);

  if (loggedIn === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
        <p className="text-sm text-slate-500">Memuat...</p>
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginPage />;
  }

  return (
    <AuthProvider apiBase={apiBase}>
      <SessionProvider apiBase={apiBase}>{children}</SessionProvider>
    </AuthProvider>
  );
}
