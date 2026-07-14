"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiguEmotion } from "@/components/TalkingMigu";

/**
 * Hook that maps tap actions to transient emotions.
 * Each tap sets a temporary emotion, then fades back to idle/listening.
 */
export function useMiguReactions() {
  const [emotion, setEmotion] = useState<MiguEmotion>("idle");
  const [speechText, setSpeechText] = useState<string>("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the main emotion for a fixed window then fade back
  const trigger = useCallback((e: MiguEmotion, dur: number = 1800) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setEmotion(e);
    timeoutRef.current = setTimeout(() => setEmotion("idle"), dur);
  }, []);

  // Show a speech bubble temporarily
  const showSpeech = useCallback((text: string, dur: number = 2500) => {
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    setSpeechText(text);
    speechTimeoutRef.current = setTimeout(() => setSpeechText(""), dur);
  }, []);

  const handleTapHead = useCallback(() => {
    trigger("surprised", 1200);
    showSpeech("Pyaa?!");
  }, [trigger, showSpeech]);

  const handleTapBelly = useCallback(() => {
    trigger("laughing", 2000);
    showSpeech("Wahaha!");
  }, [trigger, showSpeech]);

  const handleTapBeak = useCallback(() => {
    trigger("thinking", 1500);
    showSpeech("Eh?");
  }, [trigger, showSpeech]);

  const handleTapWing = useCallback(() => {
    trigger("happy", 1400);
    showSpeech("Yosh!");
  }, [trigger, showSpeech]);

  const handleTapFoot = useCallback(() => {
    trigger("surprised", 1000);
    showSpeech("Kyaa~!");
  }, [trigger, showSpeech]);

  const listen = useCallback(() => {
    setEmotion("listening");
  }, []);

  const doneListening = useCallback(() => {
    setEmotion("thinking");
    setTimeout(() => setEmotion("idle"), 600);
  }, []);

  const speak = useCallback(() => {
    setEmotion("talking");
  }, []);

  const love = useCallback(() => {
    trigger("love", 2500);
  }, [trigger]);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    };
  }, []);

  return {
    emotion,
    speechText,
    showSpeech,
    handleTapHead,
    handleTapBelly,
    handleTapBeak,
    handleTapWing,
    handleTapFoot,
    listen,
    doneListening,
    speak,
    love,
    reset: () => setEmotion("idle"),
  };
}
