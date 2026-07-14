"use client";

import { ReactNode } from "react";
import { SessionProvider } from "@/components/SessionProvider";

export default function SessionRoot({ children, apiBase }: { children: ReactNode; apiBase: string }) {
  return <SessionProvider apiBase={apiBase}>{children}</SessionProvider>;
}