"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Shield, User, Loader } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserItem {
  username: string;
  role: string;
  created_at: number;
}

export default function AdminPage() {
  const { username: currentUser, role: currentRole, logout } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const token = localStorage.getItem("speechrecog.auth_token");
    if (!token) {
      logout();
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          logout();
          return;
        }
        throw new Error(`HTTP ${r.status}`);
      }
      const data = await r.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (currentRole !== "admin") {
      window.location.href = "/";
      return;
    }
    fetchUsers();
  }, [currentRole, fetchUsers]);

  const updateRole = useCallback(
    async (targetUsername: string, newRole: string) => {
      if (targetUsername === currentUser) return;
      setUpdating(targetUsername);
      const token = localStorage.getItem("speechrecog.auth_token");
      try {
        const r = await fetch(`${API_BASE}/admin/users/${targetUsername}/role`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: newRole }),
        });
        if (!r.ok) {
          const json = await r.json().catch(() => ({}));
          throw new Error((json.detail as string) ?? `HTTP ${r.status}`);
        }
        setUsers((prev) =>
          prev.map((u) => (u.username === targetUsername ? { ...u, role: newRole } : u)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update role");
      } finally {
        setUpdating(null);
      }
    },
    [currentUser],
  );

  if (currentRole !== "admin") return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 transition">
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Admin Panel</h1>
            <p className="text-xs text-slate-500">Manage user roles</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 border border-slate-200 shadow-lg backdrop-blur overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600 bg-red-50">{error}</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No users found</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map((user) => (
                <div key={user.username} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        user.role === "admin" ? "bg-rose-100 text-rose-600" : "bg-sky-100 text-sky-600"
                      }`}
                    >
                      {user.role === "admin" ? (
                        <Shield className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{user.username}</p>
                      <p className="text-[10px] text-slate-400">
                        Joined {new Date(user.created_at * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        user.role === "admin"
                          ? "bg-rose-100 text-rose-600"
                          : "bg-sky-100 text-sky-600"
                      }`}
                    >
                      {user.role}
                    </span>

                    {user.username !== currentUser && (
                      <select
                        value={user.role}
                        onChange={(e) => updateRole(user.username, e.target.value)}
                        disabled={updating === user.username}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 disabled:opacity-50"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}

                    {user.username === currentUser && (
                      <span className="text-[10px] text-slate-400 italic">You</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
