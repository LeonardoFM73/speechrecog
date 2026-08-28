"use client";

import { useCallback } from "react";
import { LogOut, Settings, Shield, User, PanelLeftClose, PanelLeftOpen, BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface SidebarProps {
  onOpenSettings?: () => void;
  isAdmin?: boolean;
  open?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ onOpenSettings, isAdmin = false, open = true, onToggle }: SidebarProps) {
  const { username, role, logout } = useAuth();

  const handleLogout = useCallback(() => {
    logout();
    window.location.reload();
  }, [logout]);

  return (
    <>
      {!open && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 flex h-10 w-7 items-center justify-center rounded-r-xl bg-white/80 border-y border-r border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition shadow-sm backdrop-blur"
          title="Show sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}
      <aside className={`fixed left-0 top-0 z-50 h-full flex-col items-center bg-white/80 border-r border-slate-200 shadow-sm backdrop-blur transition-all duration-300 ${open ? "w-[52px] flex" : "w-0 overflow-hidden"}`}>
        <div className="flex h-[52px] w-full items-center justify-center border-b border-slate-100">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-full w-full items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title={open ? "Hide sidebar" : "Show sidebar"}
            >
              {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          )}
          {!onToggle && (
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center text-white font-bold text-xs">
              M
            </div>
          )}
        </div>

      <nav className="flex flex-col gap-2 flex-1 pt-4 px-2">
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}

        <a
          href="/kaiwa"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-amber-500 hover:bg-amber-50 transition"
          title="Kaiwa Renshuu"
        >
          <BookOpen className="h-5 w-5" />
        </a>
        {isAdmin && (
          <a
            href="/admin"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 transition"
            title="Admin Panel"
          >
            <Shield className="h-5 w-5" />
          </a>
        )}
      </nav>

      <div className="flex flex-col items-center gap-2 pb-4 px-2 w-full border-t border-slate-100 pt-3">
        <div className="flex flex-col items-center gap-1">
          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
            <User className="h-4 w-4 text-slate-500" />
          </div>
          <span className="text-[10px] font-medium text-slate-600 truncate max-w-full px-1 text-center">
            {username}
          </span>
          <span
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
              role === "admin"
                ? "bg-rose-100 text-rose-600"
                : "bg-sky-100 text-sky-600"
            }`}
          >
            {role === "admin" ? "Admin" : "User"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  </>
  );
}
