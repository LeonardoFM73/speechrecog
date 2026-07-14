"use client";

import { FileText, Clock, Languages } from "lucide-react";

interface Props {
  text: string;
  duration: number;
  language: string;
  isError: boolean;
}

export default function ResultCard({ text, duration, language, isError }: Props) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${isError ? "border-red-200" : "border-slate-200"}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FileText className="h-4 w-4" />
        <span>{isError ? "Error" : "Transcription"}</span>
        {!isError && language && (
          <span className="ml-auto text-xs font-normal text-slate-400">{language.toUpperCase()}</span>
        )}
      </div>
      <div className={`whitespace-pre-wrap text-base ${isError ? "text-red-700" : "text-slate-900"}`}>{text}</div>
      {!isError && duration > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
            <Clock className="h-3 w-3" />
            {duration.toFixed(1)}s
          </span>
          {language && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <Languages className="h-3 w-3" />
              {language}
            </span>
          )}
        </div>
      )}
    </div>
  );
}