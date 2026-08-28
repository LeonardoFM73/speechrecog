"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function SSOLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ssoLogin } = useAuth();

  useEffect(() => {
    const jwt = searchParams.get("jwt");
    const username = searchParams.get("username");
    const role = searchParams.get("role");

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
  }, [searchParams, router, ssoLogin]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
      <p className="text-slate-600">Memverifikasi akses...</p>
    </div>
  );
}
