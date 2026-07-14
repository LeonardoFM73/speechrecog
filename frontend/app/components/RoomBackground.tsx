"use client";

export default function RoomBackground() {
  return (
    <div
      className="absolute inset-0 z-0"
      aria-hidden
    >
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-100 to-amber-50" />

      {/* Floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-b from-amber-200 to-amber-300" />
      <div className="absolute bottom-[28%] left-0 right-0 h-3 bg-amber-400 opacity-40" />

      {/* Window */}
      <div className="absolute left-[10%] top-[12%] h-28 w-36 rounded-lg border-4 border-amber-600 bg-gradient-to-b from-sky-400/50 to-sky-300/30 shadow-inner" />
      <div className="absolute left-[10%] top-[12%] h-16 w-36 border-b-2 border-t-2 border-amber-600" />
      <div className="absolute left-[10%] top-[12%] h-28 w-14 border-r-2 border-amber-600" style={{ left: "calc(10% + 50%)" }} />
      {/* Clouds in window */}
      <div className="absolute left-[calc(10%+8px)] top-[calc(12%+10px)] h-6 w-14 rounded-full bg-white/60 blur-sm" />
      <div className="absolute left-[calc(10%+40px)] top-[calc(12%+14px)] h-5 w-10 rounded-full bg-white/50 blur-[3px]" />

      {/* Picture frame */}
      <div className="absolute right-[10%] top-[18%] h-20 w-24 rounded border-4 border-amber-700 bg-amber-100 shadow-md" />
      <div className="absolute right-[calc(10%+4px)] top-[calc(18%+4px)] h-12 w-16 rounded bg-gradient-to-b from-sky-300/30 to-emerald-300/30" />

      {/* Plant pot bottom-right */}
      <div className="absolute right-[5%] bottom-[24%] h-12 w-10 rounded-b-lg border-2 border-orange-700/40 bg-orange-300" />
      <div className="absolute right-[calc(5%-2px)] bottom-[calc(24%+28px)] h-14 w-14 -rotate-12 rounded-full bg-gradient-to-br from-green-300 to-green-500 opacity-60 blur-[1px]" />
      <div className="absolute right-[calc(5%+8px)] bottom-[calc(24%+24px)] h-16 w-12 -rotate-45 rounded-full bg-gradient-to-br from-green-200 to-green-400 opacity-50" />

      {/* Small rug */}
      <ellipse cx="50%" cy="calc(72% + 10px)" rx="32%" ry="10%" fill="#94a3b8" opacity="0.2" />
      <ellipse cx="50%" cy="calc(72% + 10px)" rx="28%" ry="8%" fill="#cbd5e1" opacity="0.15" />
    </div>
  );
}
