"use client";

import { useRef, useState, useEffect } from "react";

interface AudioPlayerProps {
  /** Blob URL or http(s) URL of the WAV to play. */
  src: string;
  /** Whether to autoplay on mount. Defaults to true. */
  autoPlay?: boolean;
  /** Called when playback ends. */
  onEnded?: () => void;
  /** Called when playback starts (or resumes). */
  onPlay?: () => void;
  /** Called when playback pauses. */
  onPause?: () => void;
}

/**
 * Tiny inline audio player used inside a chat bubble.
 * The <audio> element is hidden; a single button toggles play/pause.
 * Auto-play may be blocked by some browsers if the user has not yet
 * interacted with the page — the catch() in handleToggle ignores that.
 */
export default function AudioPlayer({
  src,
  autoPlay = true,
  onEnded,
  onPlay,
  onPause,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Try to autoplay when the source changes. autoplay attribute on <audio>
  // also handles this, but it lets us react to the play event.
  useEffect(() => {
    if (!autoPlay || !audioRef.current) return;
    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay was blocked — user can still click play manually.
      setIsPlaying(false);
    });
  }, [src, autoPlay]);

  const handleToggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch {
        // Ignore — e.g. user gesture requirements.
      }
    }
  };

  return (
    <div className="mt-2 inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isPlaying ? "Pause audio" : "Play audio"}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-purple)]/30 text-[var(--accent-purple)] ring-1 ring-[var(--accent-purple)]/40 transition-colors hover:bg-[var(--accent-purple)]/40"
      >
        {isPlaying ? (
          // pause icon
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          // play icon
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]/60">
        {isPlaying ? "Playing" : "Listen"}
      </span>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => {
          setIsPlaying(true);
          onPlay?.();
        }}
        onPause={() => {
          setIsPlaying(false);
          onPause?.();
        }}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        preload="auto"
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}
