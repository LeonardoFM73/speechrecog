"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50 p-4">
          <div className="max-w-md w-full bg-white/90 rounded-2xl shadow-xl p-6 backdrop-blur">
            <h2 className="text-lg font-bold text-red-600 mb-2">Terjadi kesalahan</h2>
            <p className="text-sm text-slate-600 mb-4">
              {this.state.error?.message || "Error tidak dikenal"}
            </p>
            <pre className="text-[10px] text-slate-500 bg-slate-50 rounded p-2 overflow-auto max-h-48">
              {this.state.error?.stack}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
