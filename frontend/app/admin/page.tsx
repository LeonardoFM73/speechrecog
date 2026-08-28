"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Shield, User, Loader, Plus, Trash2, Pencil, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserItem {
  username: string;
  role: string;
  created_at: number;
}

interface KaiwaQuestion {
  id: string;
  question: string;
  topic_hint: string;
}

interface ScenarioDoc {
  scenario_id: string;
  kind: "roleplay" | "kaiwa";
  label: string;
  emoji: string;
  description: string;
  is_preset: boolean;
  kind_config?: {
    questions: KaiwaQuestion[];
  };
  created_by?: string;
  created_at: number;
}

type Tab = "users" | "scenarios";

export default function AdminPage() {
  const { username: currentUser, role: currentRole, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  // Users state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  // Scenarios state
  const [scenarios, setScenarios] = useState<ScenarioDoc[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [scenariosError, setScenariosError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formKind, setFormKind] = useState<"roleplay" | "kaiwa">("roleplay");
  const [formLabel, setFormLabel] = useState("");
  const [formEmoji, setFormEmoji] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formQuestions, setFormQuestions] = useState<KaiwaQuestion[]>([]);
  const [formError, setFormError] = useState("");

  const token = () => localStorage.getItem("speechrecog.auth_token");

  const fetchUsers = useCallback(async () => {
    const t = token();
    if (!t) { logout(); return; }
    try {
      const r = await fetch(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) { if (r.status === 401 || r.status === 403) { logout(); return; } throw new Error(`HTTP ${r.status}`); }
      setUsers(await r.json());
    } catch (err) { setUsersError(err instanceof Error ? err.message : "Failed"); } finally { setUsersLoading(false); }
  }, [logout]);

  const fetchScenarios = useCallback(async () => {
    const t = token();
    if (!t) { logout(); return; }
    try {
      const r = await fetch(`${API_BASE}/admin/scenarios`, { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setScenarios(await r.json());
    } catch (err) { setScenariosError(err instanceof Error ? err.message : "Failed"); } finally { setScenariosLoading(false); }
  }, [logout]);

  useEffect(() => {
    if (currentRole !== "admin") { window.location.href = "/"; return; }
    fetchUsers();
    fetchScenarios();
  }, [currentRole, fetchUsers, fetchScenarios]);

  const updateRole = useCallback(async (targetUsername: string, newRole: string) => {
    if (targetUsername === currentUser) return;
    setUpdating(targetUsername);
    const t = token();
    try {
      const r = await fetch(`${API_BASE}/admin/users/${targetUsername}/role`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.detail as string) ?? `HTTP ${r.status}`); }
      setUsers((p) => p.map((u) => u.username === targetUsername ? { ...u, role: newRole } : u));
    } catch (err) { setUsersError(err instanceof Error ? err.message : "Failed"); } finally { setUpdating(null); }
  }, [currentUser]);

  const openCreate = useCallback(() => {
    setFormKind("kaiwa");
    setFormLabel("");
    setFormEmoji("");
    setFormDescription("");
    setFormQuestions([]);
    setFormError("");
    setEditingId(null);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((s: ScenarioDoc) => {
    setFormKind(s.kind);
    setFormLabel(s.label);
    setFormEmoji(s.emoji);
    setFormDescription(s.description);
    setFormQuestions(s.kind_config?.questions ?? []);
    setFormError("");
    setEditingId(s.scenario_id);
    setShowForm(true);
  }, []);

  const saveScenario = useCallback(async () => {
    if (!formLabel.trim() || !formDescription.trim()) { setFormError("Label dan deskripsi wajib diisi"); return; }
    const t = token();
    if (!t) return;
    const payload = {
      kind: formKind, label: formLabel.trim(), emoji: formEmoji.trim(),
      description: formDescription.trim(),
      kind_config: { questions: formQuestions },
    };
    try {
      let r: Response;
      if (editingId) {
        r = await fetch(`${API_BASE}/admin/scenarios/${editingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify(payload),
        });
      } else {
        r = await fetch(`${API_BASE}/admin/scenarios`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify(payload),
        });
      }
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.detail as string) ?? `HTTP ${r.status}`); }
      setShowForm(false);
      setEditingId(null);
      await fetchScenarios();
    } catch (err) { setFormError(err instanceof Error ? err.message : "Failed"); }
  }, [formKind, formLabel, formEmoji, formDescription, formQuestions, editingId, fetchScenarios]);

  const deleteScenario = useCallback(async (id: string) => {
    if (!confirm("Hapus skenario ini?")) return;
    const t = token();
    if (!t) return;
    try {
      const r = await fetch(`${API_BASE}/admin/scenarios/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${t}` },
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.detail as string) ?? `HTTP ${r.status}`); }
      setScenarios((p) => p.filter((s) => s.scenario_id !== id));
    } catch (err) { setScenariosError(err instanceof Error ? err.message : "Failed"); }
  }, []);

  const addQuestion = useCallback(() => {
    setFormQuestions((p) => [...p, { id: `q_${Date.now()}`, question: "", topic_hint: "" }]);
  }, []);

  const updateQuestion = useCallback((idx: number, field: keyof KaiwaQuestion, value: string) => {
    setFormQuestions((p) => p.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  }, []);

  const removeQuestion = useCallback((idx: number) => {
    setFormQuestions((p) => p.filter((_, i) => i !== idx));
  }, []);

  if (currentRole !== "admin") return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 transition">
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Admin Panel</h1>
            <p className="text-xs text-slate-500">Kelola pengguna & skenario</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 rounded-xl bg-white/60 p-1 w-fit">
          {(["users", "scenarios"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${
                tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "users" ? "Pengguna" : "Skenario"}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === "users" && (
          <div className="rounded-2xl bg-white/80 border border-slate-200 shadow-lg backdrop-blur overflow-hidden">
            {usersLoading ? (
              <div className="flex items-center justify-center py-16"><Loader className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : usersError ? (
              <div className="p-4 text-sm text-red-600 bg-red-50">{usersError}</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No users found</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {users.map((user) => (
                  <div key={user.username} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${user.role === "admin" ? "bg-rose-100 text-rose-600" : "bg-sky-100 text-sky-600"}`}>
                        {user.role === "admin" ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{user.username}</p>
                        <p className="text-[10px] text-slate-400">Joined {new Date(user.created_at * 1000).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${user.role === "admin" ? "bg-rose-100 text-rose-600" : "bg-sky-100 text-sky-600"}`}>{user.role}</span>
                      {user.username !== currentUser && (
                        <>
                          <select value={user.role} onChange={(e) => updateRole(user.username, e.target.value)} disabled={updating === user.username}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 disabled:opacity-50">
                            <option value="user">User</option><option value="admin">Admin</option>
                          </select>
                          <button onClick={async () => {
                            if (!confirm(`Hapus akun "${user.username}"?`)) return;
                            const t = token();
                            const r = await fetch(`${API_BASE}/admin/users/${user.username}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } });
                            if (!r.ok) { const j = await r.json().catch(() => ({})); setUsersError((j.detail as string) ?? `HTTP ${r.status}`); return; }
                            setUsers((p) => p.filter((u) => u.username !== user.username));
                          }} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition">Hapus</button>
                        </>
                      )}
                      {user.username === currentUser && <span className="text-[10px] text-slate-400 italic">You</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scenarios tab */}
        {tab === "scenarios" && (
          <div className="rounded-2xl bg-white/80 border border-slate-200 shadow-lg backdrop-blur overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Daftar Skenario</h2>
              <button type="button" onClick={openCreate}
                className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition">
                <Plus className="h-3 w-3" /> Tambah
              </button>
            </div>

            {scenariosLoading ? (
              <div className="flex items-center justify-center py-16"><Loader className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : scenariosError ? (
              <div className="p-4 text-sm text-red-600 bg-red-50">{scenariosError}</div>
            ) : scenarios.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Belum ada skenario.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {scenarios.map((s) => (
                  <div key={s.scenario_id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-2xl">{s.emoji || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">{s.label}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.kind === "kaiwa" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{s.kind}</span>
                        {s.is_preset && <span className="text-[10px] text-slate-400">preset</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{s.description}</p>
                      {s.kind === "kaiwa" && s.kind_config?.questions && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.kind_config.questions.length} pertanyaan</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!s.is_preset && (
                        <>
                          <button type="button" onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteScenario(s.scenario_id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit form modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">{editingId ? "Edit Skenario" : "Tambah Skenario"}</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFormKind("roleplay")} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${formKind === "roleplay" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"}`}>Roleplay</button>
                  <button type="button" onClick={() => setFormKind("kaiwa")} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${formKind === "kaiwa" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"}`}>Kaiwa Renshuu</button>
                </div>
                <input type="text" placeholder="Label (tampilan)" value={formLabel} onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
                <input type="text" placeholder="Emoji (opsional)" value={formEmoji} onChange={(e) => setFormEmoji(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
                <textarea placeholder="Deskripsi (Japanse prompt untuk LLM)" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
                {formKind === "kaiwa" && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">Pertanyaan (Bahasa Indonesia)</span>
                      <button type="button" onClick={addQuestion} className="text-xs text-amber-600 hover:text-amber-700 font-medium">+ Tambah</button>
                    </div>
                    {formQuestions.map((q, i) => (
                      <div key={q.id} className="flex gap-2 mb-2">
                        <input type="text" placeholder="Pertanyaan" value={q.question} onChange={(e) => updateQuestion(i, "question", e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-amber-400" />
                        <input type="text" placeholder="Topic hint (JP)" value={q.topic_hint} onChange={(e) => updateQuestion(i, "topic_hint", e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-amber-400" />
                        <button type="button" onClick={() => removeQuestion(i)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                {formError && <p className="text-xs text-red-600">{formError}</p>}
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Batal</button>
                <button type="button" onClick={saveScenario} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">{editingId ? "Simpan" : "Buat"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
