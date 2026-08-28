"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";

type LoginMode = "regular" | "student";

export default function LoginPage() {
  const { login, loginStudent, register } = useAuth();
  const [mode, setMode] = useState<LoginMode>("regular");
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        if (mode === "student") {
          await loginStudent(username, password);
        } else if (isLogin) {
          await login(username, password);
        } else {
          await register(username, password);
        }
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Terjadi kesalahan";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [mode, isLogin, username, password, login, loginStudent, register],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-slate-800">Migu — Japanese STT</h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "student"
              ? "Masuk sebagai siswa"
              : isLogin
                ? "Masuk ke akun kamu"
                : "Buat akun baru"}
          </p>
        </div>

        <div className="mb-4 flex rounded-xl bg-white/60 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => { setMode("regular"); setError(""); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "regular"
                ? "bg-white text-slate-800 shadow"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Akun Biasa
          </button>
          <button
            type="button"
            onClick={() => { setMode("student"); setError(""); setIsLogin(true); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "student"
                ? "bg-white text-slate-800 shadow"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Siswa (ID Pemagang)
          </button>
        </div>

        <div className="rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
                {mode === "student" ? "ID Pemagang" : "Username"}
              </label>
              <input
                id="username"
                type="text"
                autoComplete={mode === "student" ? "off" : "username"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                required
                minLength={mode === "student" ? 1 : 3}
                maxLength={32}
                placeholder={mode === "student" ? "Masukkan ID Pemagang" : "Masukkan username"}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                required
                minLength={6}
                maxLength={128}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-semibold text-white shadow transition hover:from-amber-500 hover:to-amber-700 disabled:opacity-50"
            >
              {loading ? "Memproses..." : mode === "student" ? "Masuk" : isLogin ? "Masuk" : "Daftar"}
            </button>
          </form>

          {mode === "regular" && (
            <p className="mt-4 text-center text-sm text-slate-600">
              {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin((v) => !v);
                  setError("");
                }}
                className="font-semibold text-amber-600 underline-offset-2 hover:underline"
              >
                {isLogin ? "Daftar" : "Masuk"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
