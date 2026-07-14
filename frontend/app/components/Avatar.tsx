"use client";

import { ComponentType, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { avatars } from "./avatars";

export interface AvatarProps {
  size?: number;
}

export type AvatarState = "idle" | "listening" | "speaking";

export interface AvatarComponentProps {
  scenarioId: string;
  state: AvatarState;
  size?: "sm" | "md" | "lg";
  audioLevelRef?: React.MutableRefObject<number>;
  className?: string;
}

const SIZE_MAP = { sm: 80, md: 120, lg: 160 } as const;

export default function Avatar({
  scenarioId,
  state,
  size = "md",
  audioLevelRef,
  className = "",
}: AvatarComponentProps) {
  const px = SIZE_MAP[size];
  const Component: ComponentType<AvatarProps> = avatars[scenarioId] ?? avatars.custom;
  const mouthRef = useRef<HTMLDivElement | null>(null);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (state !== "speaking") return;
    let raf = 0;
    const tick = () => {
      const lvl = audioLevelRef?.current ?? 0;
      const scale = 0.3 + Math.min(1, lvl * 4) * 0.7;
      if (mouthRef.current) {
        mouthRef.current.style.transform = `scaleY(${scale.toFixed(2)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, audioLevelRef]);

  useEffect(() => {
    if (state !== "idle") return;
    const id = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 150);
    }, 3000 + Math.random() * 2000);
    return () => window.clearInterval(id);
  }, [state]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: px, height: px }}>
      <AnimatePresence>
        {state === "listening" &&
          [0, 0.5, 1].map((delay) => (
            <motion.span
              key={delay}
              className="absolute inset-0 rounded-full border-2 border-blue-500"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.6, 0], scale: [1, 1.3, 1.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay }}
            />
          ))}
      </AnimatePresence>
      <motion.div
        className="relative"
        animate={state === "idle" ? { scale: [1, 1.02, 1] } : { scale: 1 }}
        transition={state === "idle" ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      >
        <Component size={px} />
        {state === "speaking" && (
          <div
            ref={mouthRef}
            className="absolute"
            style={{
              left: "42%",
              top: "55%",
              width: "16%",
              height: "8%",
              borderRadius: "4px",
              backgroundColor: "#0f172a",
              transformOrigin: "center center",
            }}
          />
        )}
        {blink && (
          <div
            className="absolute bg-white/80"
            style={{ width: px, height: px }}
          />
        )}
      </motion.div>
    </div>
  );
}
