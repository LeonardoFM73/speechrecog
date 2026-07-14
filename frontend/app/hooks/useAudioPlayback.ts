"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioPlayback {
  isPlaying: boolean;
  play: () => Promise<void>;
  stop: () => void;
  analyser: AnalyserNode | null;
}

export function useAudioPlayback(blobUrl: string | null): AudioPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* noop */ }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(async () => {
    if (!blobUrl) return;
    stop();
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = ctxRef.current;
    const buf = await fetch(blobUrl).then((r) => r.arrayBuffer());
    const audio = await ctx.decodeAudioData(buf);
    const source = ctx.createBufferSource();
    source.buffer = audio;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
      source.disconnect();
      if (sourceRef.current === source) sourceRef.current = null;
    };
    source.start();
    sourceRef.current = source;
    analyserRef.current = analyser;
    setIsPlaying(true);
  }, [blobUrl, stop]);

  useEffect(() => {
    return () => {
      stop();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => undefined);
        ctxRef.current = null;
      }
    };
  }, [stop]);

  return { isPlaying, play, stop, analyser: analyserRef.current };
}
