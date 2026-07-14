/** Custom hook: microphone recording with MediaRecorder API + mic level metering. */

import { useState, useRef, useCallback, useEffect } from "react";
import { TranscriptionStatus } from "@/types/audio";

interface UseMicrophoneReturn {
  isRecording: boolean;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  hasPermission: boolean;
  permissionError: string | null;
  level: number;
  audioContext: AudioContext | null;
}

let mediaRecorderInstance: MediaRecorder | null = null;
let chunks: Blob[] = [];
let timerInterval: ReturnType<typeof setInterval> | null = null;

export function useMicrophone(): UseMicrophoneReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [level, setLevel] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    setDuration(0);
    timerInterval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    const ctx = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 4));
      levelRafRef.current = requestAnimationFrame(tick);
    };
    levelRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (levelRafRef.current !== null) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!("MediaRecorder" in window)) {
        throw new Error("MediaRecorder is not supported in this browser");
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderInstance = recorder;
      chunks = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.start();
      setIsRecording(true);
      setHasPermission(true);
      setPermissionError(null);
      resetTimer();
      startLevelMeter(stream);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        const msg = "Microphone access denied. Please allow microphone permissions.";
        setPermissionError(msg);
        throw new Error(msg);
      }
      if (err instanceof DOMException && err.name === "NotFoundError") {
        const msg = "No microphone found. Please connect a microphone.";
        setPermissionError(msg);
        throw new Error(msg);
      }
      const msg = err instanceof Error ? err.message : "Failed to access microphone";
      setPermissionError(msg);
      throw new Error(msg);
    }
  }, [resetTimer, startLevelMeter]);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      if (!mediaRecorderInstance || !mediaRecorderInstance.stream) {
        reject(new Error("No active recording"));
        return;
      }

      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      mediaRecorderInstance.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorderInstance?.mimeType ?? "audio/webm" });

        mediaRecorderInstance!.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderInstance = null;
        chunks = [];
        setIsRecording(false);
        stopLevelMeter();

        resolve(blob);
      };

      mediaRecorderInstance.onerror = () => {
        if (mediaRecorderInstance?.stream) {
          mediaRecorderInstance.stream.getTracks().forEach((track) => track.stop());
          mediaRecorderInstance = null;
          chunks = [];
          setIsRecording(false);
          stopLevelMeter();
        }
        reject(new Error("Recording error occurred"));
      };

      mediaRecorderInstance.stop();
    });
  }, [stopLevelMeter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
      if (mediaRecorderInstance?.stream) {
        mediaRecorderInstance.stream.getTracks().forEach((track) => track.stop());
      }
      stopLevelMeter();
    };
  }, [stopLevelMeter]);

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    hasPermission,
    permissionError,
    level,
    audioContext: audioContextRef.current,
  };
}