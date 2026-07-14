"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
}

function uuidv4(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useSession(apiBase: string): UseSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<SessionDoc | null>(null);
  const [ready, setReady] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const apiBaseRef = useRef(apiBase);
  apiBaseRef.current = apiBase;

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setReady(true);
      return;
    }
    setSessionId(id);
    sessionClient
      .get(id, apiBaseRef.current)
      .then((doc) => {
        setHydrated(doc);
        setReady(true);
      })
      .catch(() => {
        setDbReady(false);
        setReady(true);
      });
  }, []);

  const start = useCallback(async () => {
    const id = uuidv4();
    try {
      const doc = await sessionClient.create(id, apiBaseRef.current);
      localStorage.setItem(STORAGE_KEY, id);
      setSessionId(id);
      setHydrated(doc);
      setDbReady(true);
    } catch {
      localStorage.setItem(STORAGE_KEY, id);
      setSessionId(id);
      setHydrated({
        session_id: id,
        started_at: new Date().toISOString(),
        ended_at: null,
        mode: "roleplay",
        scenario_id: "sensei",
        scenario_text: null,
        speaker_id: null,
        messages: [],
      });
      setDbReady(false);
    }
  }, []);

  const end = useCallback(async () => {
    if (!sessionId) return;
    try {
      await sessionClient.update(sessionId, { ended_at: new Date().toISOString() }, apiBaseRef.current);
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
      if (!sessionId) return;
      try {
        const doc = await sessionClient.update(sessionId, patch, apiBaseRef.current);
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
      if (!sessionId) return;
      try {
        await sessionClient.appendMessage(sessionId, turn, apiBaseRef.current);
        setDbReady(true);
      } catch {
        setDbReady(false);
      }
    },
    [sessionId],
  );

  return { sessionId, hydrated, ready, dbReady, start, end, updateMeta, appendTurn };
}
