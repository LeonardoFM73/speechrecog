"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface SSOLoginClientProps {
  jwt?: string;
  username?: string;
  role?: string;
}

export default function SSOLoginClient({ jwt, username, role }: SSOLoginClientProps) {
  const router = useRouter();
  const { ssoLogin } = useAuth();

  useEffect(() => {
    if (!jwt || !username || !role) {
      router.replace("/");
      return;
    }

    try {
      ssoLogin(jwt, username, role);
      router.replace("/");
    } catch {
      router.replace("/");
    }
  }, [jwt, username, role, router, ssoLogin]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
      <p className="text-slate-600">Memverifikasi akses...</p>
    </div>
  );
}
