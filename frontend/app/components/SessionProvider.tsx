"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession, UseSession } from "@/hooks/useSession";
import { useAuth } from "@/context/AuthContext";

const SessionContext = createContext<UseSession | null>(null);

export function SessionProvider({ children, apiBase }: { children: ReactNode; apiBase: string }) {
  const { token } = useAuth();
  const value = useSession(apiBase, token);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): UseSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used inside SessionProvider");
  return ctx;
}
