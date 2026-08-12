"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JpLevel } from "@/types/audio";
import { sessionClient, SessionDoc, SessionTurn } from "@/services/api";

const STORAGE_KEY = "speechrecog.session_id";

export interface UseSession {
  sessionId: string | null;
  hydrated: SessionDoc | null;
  ready: boolean;
  dbReady: boolean;
  start: () => Promise<void>;
  end: () => Promise<void>;
  updateMeta: (patch: Partial<SessionDoc>) => Promise<void>;
  appendTurn: (turn: SessionTurn) => Promise<void>;
  settings: { ttsSpeed: number; jpLevel: JpLevel; maxTurns: number };
}

function uuidv4(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useSession(apiBase: string, token: string | null): UseSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<SessionDoc | null>(null);
  const [ready, setReady] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const apiBaseRef = useRef(apiBase);
  const tokenRef = useRef(token);
  apiBaseRef.current = apiBase;
  tokenRef.current = token;

  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setReady(true);
      return;
    }
    setSessionId(id);
    sessionClient
      .get(id, apiBaseRef.current, token)
      .then((doc) => {
        setHydrated(doc);
        setReady(true);
      })
      .catch(() => {
        setDbReady(false);
        setReady(true);
      });
  }, [token]);

  const start = useCallback(async () => {
    const id = uuidv4();
    try {
      const doc = await sessionClient.create(id, apiBaseRef.current, tokenRef.current!);
      localStorage.setItem(STORAGE_KEY, id);
      setSessionId(id);
      setHydrated(doc);
      setDbReady(true);
    } catch {
      localStorage.setItem(STORAGE_KEY, id);
      setSessionId(id);
      setHydrated({
        session_id: id,
        username: "",
        started_at: new Date().toISOString(),
        ended_at: null,
        mode: "roleplay",
        scenario_id: "sensei",
        scenario_text: null,
        speaker_id: null,
        tts_speed: 1.0,
        jp_level: "n3",
        max_turns: 10,
        messages: [],
      });
      setDbReady(false);
    }
  }, []);

  const end = useCallback(async () => {
    if (!sessionId || !tokenRef.current) return;
    try {
      await sessionClient.update(
        sessionId,
        { ended_at: new Date().toISOString() },
        apiBaseRef.current,
        tokenRef.current,
      );
    } catch {
      /* swallow */
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setSessionId(null);
      setHydrated(null);
    }
  }, [sessionId]);

  const updateMeta = useCallback(
    async (patch: Partial<SessionDoc>) => {
      if (!sessionId || !tokenRef.current) return;
      try {
        const doc = await sessionClient.update(
          sessionId,
          patch,
          apiBaseRef.current,
          tokenRef.current,
        );
        setHydrated(doc);
        setDbReady(true);
      } catch {
        setDbReady(false);
      }
    },
    [sessionId],
  );

  const appendTurn = useCallback(
    async (turn: SessionTurn) => {
      if (!sessionId || !tokenRef.current) return;
      try {
        await sessionClient.appendMessage(
          sessionId,
          turn,
          apiBaseRef.current,
          tokenRef.current,
        );
        setDbReady(true);
      } catch {
        setDbReady(false);
      }
    },
    [sessionId],
  );

  const settings = hydrated
    ? { ttsSpeed: hydrated.tts_speed, jpLevel: hydrated.jp_level as JpLevel, maxTurns: hydrated.max_turns }
    : { ttsSpeed: 1.0, jpLevel: "n3" as JpLevel, maxTurns: 10 };

  return { sessionId, hydrated, ready, dbReady, start, end, updateMeta, appendTurn, settings };
}
