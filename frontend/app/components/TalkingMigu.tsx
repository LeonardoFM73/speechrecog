"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";

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

const PALETTE = {
  hoodie:      "#4da8da",
  hoodieDark:  "#3a8bc2",
  hoodieTrim:  "#2b6fb3",
  body:        "#fff9ec",
  bodyDark:    "#f0dfc0",
  beak:        "#ffb347",
  beakDark:    "#e68a00",
  cheek:       "#ffb3b3",
  eye:         "#0f172a",
  eyeWhite:    "#ffffff",
  pupil:       "#0c1e3d",
  mouth:       "#7c2d12",
  crestFront:  "#fdd835",
  crestBack:   "#ffd966",
  foot:        "#f59e0b",
  footDark:    "#d97706",
};

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
  const mouthRef = useRef<SVGGElement | null>(null);
  const [blink, setBlink] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const addRipple = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    setRipples((prev) => [...prev, { id, x, y }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 800);
  }, []);

  // Mouth animation while talking
  useEffect(() => {
    if (emotion !== "talking") return;
    let raf = 0;
    const tick = () => {
      const lvl = audioLevelRef?.current ?? 0;
      const scale = 0.3 + Math.min(1, lvl * 4) * 0.9;
      if (mouthRef.current) {
        mouthRef.current.style.transform = `scaleY(${scale.toFixed(2)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [emotion, audioLevelRef]);

  // Blink occasionally
  useEffect(() => {
    const id = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 2800 + Math.random() * 1800);
    return () => window.clearInterval(id);
  }, []);

  // Eyes follow a soft wandering target
  useEffect(() => {
    const id = window.setInterval(() => {
      setPupilOffset({
        x: (Math.random() - 0.5) * 3,
        y: (Math.random() - 0.5) * 2,
      });
    }, 1200);
    return () => window.clearInterval(id);
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
        <svg
          viewBox="0 0 320 320"
          width={size}
          height={size}
          className="overflow-visible"
        >
          {/* Shadow under Minori */}
          <ellipse cx="160" cy="300" rx="80" ry="12" fill="#000" opacity="0.15" />

          {/* Crest — feathers on head (clickable) */}
          <g
            onClick={(e) => {
              addRipple(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
              onTapHead?.();
            }}
            style={{ cursor: "pointer" }}
          >
            <path
              d="M 115 90 Q 110 55 140 45 Q 150 40 160 45 Q 170 40 180 45 Q 210 55 205 90"
              fill={PALETTE.crestBack}
              stroke={PALETTE.hoodieDark}
              strokeWidth="1.5"
            />
            <path
              d="M 125 85 Q 122 60 142 52 Q 150 47 160 52 Q 170 47 178 52 Q 198 60 195 85"
              fill={PALETTE.crestFront}
              stroke={PALETTE.hoodieDark}
              strokeWidth="1"
            />
          </g>

          {/* Hoodie — torso / body (clickable) */}
          <g
            onClick={(e) => {
              addRipple(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
              onTapBelly?.();
            }}
            style={{ cursor: "pointer" }}
          >
            {/* Main hoodie body */}
            <path
              d="M 85 190 Q 70 260 85 300 Q 110 310 160 310 Q 210 310 235 300 Q 250 260 235 190"
              fill={PALETTE.hoodie}
              stroke={PALETTE.hoodieDark}
              strokeWidth="2"
            />
            {/* Hoodie trim / collar */}
            <path
              d="M 120 190 Q 140 182 160 182 Q 180 182 200 190"
              stroke={PALETTE.hoodieTrim}
              strokeWidth="3"
              fill="none"
            />
            {/* Hoodie drawstrings */}
            <line x1="152" y1="195" x2="148" y2="215" stroke={PALETTE.hoodieTrim} strokeWidth="2" strokeLinecap="round" />
            <line x1="168" y1="195" x2="172" y2="215" stroke={PALETTE.hoodieTrim} strokeWidth="2" strokeLinecap="round" />
            {/* "M" on chest */}
            <text
              x="160"
              y="260"
              textAnchor="middle"
              fontSize="36"
              fontWeight="bold"
              fill={PALETTE.hoodieDark}
              fontFamily="system-ui, sans-serif"
              opacity="0.5"
            >
              M
            </text>
          </g>

          {/* Head — yellow bird face (clickable) */}
          <g
            onClick={(e) => {
              addRipple(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
              onTapHead?.();
            }}
            style={{ cursor: "pointer" }}
          >
            {/* Head circle */}
            <ellipse cx="160" cy="140" rx="80" ry="75" fill={PALETTE.body} stroke={PALETTE.bodyDark} strokeWidth="2" />
            {/* Face highlight */}
            <ellipse cx="160" cy="135" rx="72" ry="65" fill={PALETTE.body} />

            {/* Wings / arms (clickable) */}
            <g
              onClick={(e) => {
                addRipple(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                onTapWing?.();
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Left wing */}
              <motion.path
                d="M 80 200 Q 50 230 55 260 Q 60 275 85 270 Q 90 260 85 240"
                fill={PALETTE.hoodie}
                stroke={PALETTE.hoodieDark}
                strokeWidth="2"
                animate={emotion === "happy" || emotion === "laughing" ? { rotate: [0, -15, 0] } : { rotate: 0 }}
                style={{ transformOrigin: "80px 200px" }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
              {/* Right wing */}
              <motion.path
                d="M 240 200 Q 270 230 265 260 Q 260 275 235 270 Q 230 260 235 240"
                fill={PALETTE.hoodie}
                stroke={PALETTE.hoodieDark}
                strokeWidth="2"
                animate={emotion === "happy" || emotion === "laughing" ? { rotate: [0, 15, 0] } : { rotate: 0 }}
                style={{ transformOrigin: "240px 200px" }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              />
            </g>

            {/* Eyes */}
            <g>
              {/* Eye whites */}
              <ellipse cx="130" cy="130" rx="20" ry={blink ? 2 : 24} fill={PALETTE.eyeWhite} stroke={PALETTE.hoodieDark} strokeWidth="2" />
              <ellipse cx="190" cy="130" rx="20" ry={blink ? 2 : 24} fill={PALETTE.eyeWhite} stroke={PALETTE.hoodieDark} strokeWidth="2" />

              {/* Pupils — shift by emotion */}
              {!blink && (
                <>
                  <motion.ellipse
                    cx={130 + pupilOffset.x}
                    cy={130 + pupilOffset.y}
                    rx="9"
                    ry="12"
                    fill={PALETTE.pupil}
                    animate={
                      emotion === "surprised"
                        ? { rx: 13, ry: 15 }
                        : emotion === "happy" || emotion === "love"
                          ? { rx: 5, ry: 5 }
                          : emotion === "sleepy"
                            ? { ry: 5 }
                            : { rx: 9, ry: 12 }
                    }
                    transition={{ duration: 0.2 }}
                  />
                  <motion.ellipse
                    cx={190 + pupilOffset.x}
                    cy={130 + pupilOffset.y}
                    rx="9"
                    ry="12"
                    fill={PALETTE.pupil}
                    animate={
                      emotion === "surprised"
                        ? { rx: 13, ry: 15 }
                        : emotion === "happy" || emotion === "love"
                          ? { rx: 5, ry: 5 }
                          : emotion === "sleepy"
                            ? { ry: 5 }
                            : { rx: 9, ry: 12 }
                    }
                    transition={{ duration: 0.2 }}
                  />
                  {/* Eye highlights */}
                  <circle cx={133 + pupilOffset.x} cy={125 + pupilOffset.y} r="3" fill="white" />
                  <circle cx={193 + pupilOffset.x} cy={125 + pupilOffset.y} r="3" fill="white" />
                </>
              )}
            </g>

            {/* Cheeks (blush) */}
            <circle cx="100" cy="150" r="9" fill={PALETTE.cheek} opacity="0.5" />
            <circle cx="220" cy="150" r="9" fill={PALETTE.cheek} opacity="0.5" />

            {/* Sleeping zzz */}
            {emotion === "sleepy" && (
              <g opacity="0.8">
                <text x="220" y="70" fontSize="22" fill={PALETTE.hoodieDark} fontFamily="system-ui">z</text>
                <text x="240" y="52" fontSize="28" fill={PALETTE.hoodieDark} fontFamily="system-ui">z</text>
                <text x="262" y="36" fontSize="34" fill={PALETTE.hoodieDark} fontFamily="system-ui">Z</text>
              </g>
            )}

            {/* Beak (clickable) */}
            <g
              onClick={(e) => {
                addRipple(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                onTapBeak?.();
              }}
              style={{ cursor: "pointer" }}
            >
              <path
                d="M 148 158 Q 160 172 172 158 Q 166 168 160 170 Q 154 168 148 158 Z"
                fill={PALETTE.beak}
                stroke={PALETTE.beakDark}
                strokeWidth="1.5"
              />
            </g>

            {/* Mouth — animated when talking */}
            <g ref={mouthRef} style={{ transformOrigin: "160px 165px" }}>
              {emotion === "talking" ? (
                <ellipse cx="160" cy="165" rx="10" ry="12" fill={PALETTE.beakDark} />
              ) : emotion === "laughing" ? (
                <path
                  d="M 145 160 Q 160 182 175 160 Q 168 172 160 176 Q 152 172 145 160 Z"
                  fill={PALETTE.beak}
                  stroke={PALETTE.beakDark}
                  strokeWidth="1.5"
                />
              ) : emotion === "happy" || emotion === "love" ? (
                <path
                  d="M 148 162 Q 160 178 172 162"
                  stroke={PALETTE.beakDark}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : emotion === "surprised" ? (
                <circle cx="160" cy="167" r="10" fill={PALETTE.beak} stroke={PALETTE.beakDark} strokeWidth="1.5" />
              ) : emotion === "sad" ? (
                <path
                  d="M 148 172 Q 160 162 172 172"
                  stroke={PALETTE.beakDark}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M 150 163 Q 160 170 170 163"
                  stroke={PALETTE.beakDark}
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              )}
            </g>

            {/* Love hearts */}
            {(emotion === "love" || emotion === "happy") && (
              <g>
                <motion.text
                  x="40" y="90" fontSize="28" fill="#e74c3c"
                  animate={{ y: [90, 60, 90], opacity: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >♥
                </motion.text>
                <motion.text
                  x="250" y="100" fontSize="22" fill="#e74c3c"
                  animate={{ y: [100, 70, 100], opacity: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                >♥
                </motion.text>
              </g>
            )}
          </g>

          {/* Feet (clickable) */}
          <g
            onClick={(e) => {
              addRipple(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
              onTapFoot?.();
            }}
            style={{ cursor: "pointer" }}
          >
            {/* Left foot */}
            <motion.ellipse
              cx="120" cy="308" rx="20" ry="8"
              fill={PALETTE.foot}
              stroke={PALETTE.footDark}
              strokeWidth="2"
              animate={emotion === "happy" || emotion === "laughing" ? { rotate: [0, -20, 20, 0] } : { rotate: 0 }}
              style={{ transformOrigin: "120px 308px" }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            {/* Right foot */}
            <motion.ellipse
              cx="200" cy="308" rx="20" ry="8"
              fill={PALETTE.foot}
              stroke={PALETTE.footDark}
              strokeWidth="2"
              animate={emotion === "happy" || emotion === "laughing" ? { rotate: [0, 20, -20, 0] } : { rotate: 0 }}
              style={{ transformOrigin: "200px 308px" }}
              transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
            />
          </g>
        </svg>
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
