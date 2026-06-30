/** Custom hook: microphone recording with MediaRecorder API. */

import { useState, useRef, useCallback, useEffect } from "react";
import { TranscriptionStatus } from "@/types/audio";

interface UseMicrophoneReturn {
  isRecording: boolean;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  hasPermission: boolean;
  permissionError: string | null;
}

let mediaRecorderInstance: MediaRecorder | null = null;
let chunks: Blob[] = [];
let timerInterval: ReturnType<typeof setInterval> | null = null;

export function useMicrophone(): UseMicrophoneReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

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
  }, [resetTimer]);

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

        // Stop all tracks
        mediaRecorderInstance!.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderInstance = null;
        chunks = [];
        setIsRecording(false);

        resolve(blob);
      };

      mediaRecorderInstance.onerror = () => {
        if (mediaRecorderInstance?.stream) {
          mediaRecorderInstance.stream.getTracks().forEach((track) => track.stop());
          mediaRecorderInstance = null;
          chunks = [];
          setIsRecording(false);
        }
        reject(new Error("Recording error occurred"));
      };

      mediaRecorderInstance.stop();
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      if (mediaRecorderInstance?.stream) {
        mediaRecorderInstance.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    hasPermission,
    permissionError,
  };
}
