"use client";

import { ReactNode, useEffect, useState } from "react";
import { SessionProvider } from "@/components/SessionProvider";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/components/LoginPage";
import { authClient } from "@/services/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "speechrecog.auth_token";
const USERNAME_KEY = "speechrecog.username";

export default function SessionRoot({ children, apiBase }: { children: ReactNode; apiBase: string }) {
  return (
    <AuthProvider apiBase={apiBase}>
      <AuthGate apiBase={apiBase}>{children}</AuthGate>
    </AuthProvider>
  );
}

function AuthGate({ children, apiBase }: { children: ReactNode; apiBase: string }) {
  const { token, loaded } = useAuth();
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    if (!token || !loaded) {
      setValidated(false);
      return;
    }
    authClient
      .me(apiBase, token)
      .then(() => setValidated(true))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USERNAME_KEY);
        window.location.reload();
      });
  }, [apiBase, token, loaded]);

  if (!token || !validated) {
    return <LoginPage />;
  }

  return <SessionProvider apiBase={apiBase}>{children}</SessionProvider>;
}
