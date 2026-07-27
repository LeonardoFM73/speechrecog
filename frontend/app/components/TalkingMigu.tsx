"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";

export type MiguEmotion =
  | "idle"
  | "listening"
  | "thinking"
  | "talking"
  | "happy"
  | "surprised"
  | "laughing"
  | "sleepy"
  | "love"
  | "sad";

export interface TalkingMiguProps {
  emotion: MiguEmotion;
  size?: number;
  audioLevelRef?: React.MutableRefObject<number>;
  speechText?: string;
  onTapHead?: () => void;
  onTapBelly?: () => void;
  onTapBeak?: () => void;
  onTapWing?: () => void;
  onTapFoot?: () => void;
}

export default function TalkingMigu({
  emotion,
  size = 320,
  audioLevelRef,
  speechText,
  onTapHead,
  onTapBelly,
  onTapBeak,
  onTapWing,
  onTapFoot,
}: TalkingMiguProps) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const addRipple = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    setRipples((prev) => [...prev, { id, x, y }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 800);
  }, []);

  // Emotion-based transforms
  const bodyAnim =
    emotion === "laughing"
      ? { rotate: [0, -3, 3, -3, 3, 0], scale: [1, 1.05, 0.98, 1.05, 0.98, 1] }
      : emotion === "surprised"
        ? { scale: [1, 1.08, 1], rotate: 0 }
        : emotion === "happy"
          ? { y: [0, -8, 0] }
          : emotion === "listening"
            ? { y: [0, -3, 0] }
            : emotion === "thinking"
              ? { rotate: [0, -4, 4, 0] }
              : emotion === "love"
                ? { scale: [1, 1.03, 1] }
                : emotion === "sleepy"
                  ? { y: [0, 2, 0], rotate: [0, 2, 0] }
                  : { y: [0, -4, 0] };

  const bodyDur =
    emotion === "idle" ? 3.5
    : emotion === "listening" ? 0.8
    : emotion === "thinking" ? 1.6
    : emotion === "laughing" ? 0.4
    : emotion === "happy" ? 0.6
    : emotion === "surprised" ? 0.3
    : emotion === "love" ? 1.2
    : 2;

  // Image-based tap handler — map coordinates to parts based on photo position
  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      // We calculate relative to the component bounding box.
      // But we don't have refs here, so use offsetX/Y from nativeEvent instead
      // The zones pass offsetX/Y, so we just pass through.
    },
    [],
  );

  // Zone-based tap: each zone div passes offsetX/Y
  const handleZoneTap = useCallback(
    (zone: string, offsetX: number, offsetY: number) => {
      addRipple(offsetX, offsetY);
      // Determine which handler to call based on which zone div triggered it.
      // Since each zone is a separate <div> with its own onClick, we use data-zone.
      switch (zone) {
        case "head":
          onTapHead?.();
          break;
        case "belly":
          onTapBelly?.();
          break;
        case "beak":
          onTapBeak?.();
          break;
        case "wing":
          onTapWing?.();
          break;
        case "feet":
          onTapFoot?.();
          break;
      }
    },
    [addRipple, onTapHead, onTapBelly, onTapBeak, onTapWing, onTapFoot],
  );

  return (
    <div
      className="relative inline-flex items-center justify-center select-none touch-none"
      style={{ width: size, height: size }}
    >
      {/* Listening pulse rings */}
      <AnimatePresence>
        {emotion === "listening" && (
          <>
            {[0, 0.6, 1.2].map((delay) => (
              <motion.span
                key={delay}
                className="absolute inset-0 rounded-full border-4 border-blue-400"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.2, 1.6] }}
                transition={{ duration: 1.8, repeat: Infinity, delay }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Tap ripples */}
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="absolute rounded-full border-2 border-amber-300/80 pointer-events-none"
            style={{ left: r.x - 20, top: r.y - 20, width: 40, height: 40 }}
            initial={{ opacity: 0.9, scale: 0.4 }}
            animate={{ opacity: 0, scale: 2.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          />
        ))}
      </AnimatePresence>

      <motion.div
        className="relative"
        style={{ width: size, height: size }}
        animate={bodyAnim}
        transition={{
          duration: bodyDur,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Maskot image with clickable zones */}
        <div className="relative" style={{ width: size, height: size }}>
          <img
            src="/maskot.png"
            alt="Migu"
            style={{ width: size, height: size, objectFit: "contain" }}
            className="select-none touch-none"
            draggable={false}
          />

          {/*
            Clickable zones — adjust percentages to match your image.
            These should roughly cover:
            - Head/Hoodie area: top 0–40%
            - Belly: middle 40–65%
            - Beak/Nose: small area in the face
            - Wings: sides middle
            - Feet: bottom 85–100%
          */}

          {/* Head — top portion (hoodie/face area) */}
          <div
            className="absolute z-10"
            style={{ top: 0, left: 0, right: 0, height: "42%" }}
            onClick={(e) =>
              handleZoneTap("head", e.nativeEvent.offsetX, e.nativeEvent.offsetY)
            }
            title="Head"
          />

          {/* Beak — small center area on face */}
          <div
            className="absolute z-10"
            style={{ top: "30%", left: "40%", width: "20%", height: "8%" }}
            onClick={(e) =>
              handleZoneTap("beak", e.nativeEvent.offsetX, e.nativeEvent.offsetY)
            }
            title="Beak"
          />

          {/* Belly — body/torso */}
          <div
            className="absolute z-10"
            style={{ top: "40%", left: 0, right: 0, bottom: "22%" }}
            onClick={(e) =>
              handleZoneTap("belly", e.nativeEvent.offsetX, e.nativeEvent.offsetY)
            }
            title="Belly"
          />

          {/* Left wing */}
          <div
            className="absolute z-10"
            style={{ top: "42%", left: 0, width: "18%", height: "28%" }}
            onClick={(e) =>
              handleZoneTap("wing", e.nativeEvent.offsetX, e.nativeEvent.offsetY)
            }
            title="Left Wing"
          />

          {/* Right wing */}
          <div
            className="absolute z-10"
            style={{ top: "42%", right: 0, width: "18%", height: "28%" }}
            onClick={(e) =>
              handleZoneTap("wing", e.nativeEvent.offsetX, e.nativeEvent.offsetY)
            }
            title="Right Wing"
          />

          {/* Feet — bottom portion */}
          <div
            className="absolute z-10"
            style={{ bottom: 0, left: 0, right: 0, height: "22%" }}
            onClick={(e) =>
              handleZoneTap("feet", e.nativeEvent.offsetX, e.nativeEvent.offsetY)
            }
            title="Feet"
          />
        </div>

        {/* Sleeping zzz overlay */}
        {emotion === "sleepy" && (
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, x: 60, y: -30 }}
              animate={{
                opacity: [0, 1, 0],
                x: [60, 100],
                y: [-30, -80],
                scale: [0.8, 1.2],
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="absolute text-lg font-bold text-slate-600"
            >
              z
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 70, y: -40 }}
              animate={{
                opacity: [0, 1, 0],
                x: [70, 120],
                y: [-40, -100],
                scale: [0.8, 1.4],
              }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 }}
              className="absolute text-xl font-bold text-slate-600"
            >
              z
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 80, y: -50 }}
              animate={{
                opacity: [0, 1, 0],
                x: [80, 140],
                y: [-50, -120],
                scale: [0.8, 1.6],
              }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 1.6 }}
              className="absolute text-2xl font-bold text-slate-600"
            >
              Z
            </motion.div>
          </div>
        )}

        {/* Love hearts overlay */}
        {(emotion === "love" || emotion === "happy") && (
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute text-2xl text-red-400"
              style={{ left: "5%", top: "10%" }}
              animate={{ y: [0, -40, 0], opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ♥
            </motion.div>
            <motion.div
              className="absolute text-2xl text-red-400"
              style={{ right: "5%", top: "15%" }}
              animate={{ y: [0, -40, 0], opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
            >
              ♥
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Speech bubble */}
      <AnimatePresence>
        {speechText && (
          <motion.div
            key={speechText}
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full max-w-[280px] rounded-2xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-lg"
          >
            {speechText}
            <div className="absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-amber-400 bg-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
