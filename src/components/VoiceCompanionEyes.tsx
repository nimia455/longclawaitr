import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EyeShape, VoiceMood, VoicePhase } from '../lib/voiceCommandEngine';
import { LIQUID_EASE } from '../lib/motion';

interface VoiceCompanionEyesProps {
  shape: EyeShape;
  mood: VoiceMood;
  phase: VoicePhase;
  inputLevel: number; // 0..1 live microphone amplitude
  outputLevel: number; // 0..1 live TTS speaking amplitude
  gazeOffset?: { x: number; y: number }; // -1..1 subtle pointer gaze
}

const EYE_SPRING = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 26,
  mass: 0.85,
};

const GAZE_SPRING = {
  type: 'spring' as const,
  stiffness: 210,
  damping: 26,
  mass: 0.9,
};

const LID_SPRING = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 32,
  mass: 0.78,
};

const SHAPE_DIMENSIONS: Record<
  EyeShape,
  { width: number; height: number; borderRadius: number }
> = {
  round: { width: 140, height: 140, borderRadius: 70 },
  oval: { width: 92, height: 164, borderRadius: 46 },
  square: { width: 132, height: 132, borderRadius: 22 },
};

const PLAYFUL_SHAPES: EyeShape[] = ['round', 'oval', 'square'];

/**
 * Pure Minimalist Pupil-Less Companion Eyes
 * Expressive Round / Oval / Square geometric silhouettes driven entirely by
 * whole-eye gaze parallax, sculpted eyelids, subtle head-turn depth, and live voice reactivity.
 */
export function VoiceCompanionEyes({
  shape,
  mood,
  phase,
  inputLevel,
  outputLevel,
  gazeOffset = { x: 0, y: 0 },
}: VoiceCompanionEyesProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isBlinking, setIsBlinking] = useState(false);
  const [wanderGaze, setWanderGaze] = useState({ x: 0, y: 0 });
  const [playfulStep, setPlayfulStep] = useState(0);
  const [scanTick, setScanTick] = useState(0);

  // Natural organic blinking (with occasional double-blink)
  useEffect(() => {
    if (prefersReducedMotion) return;
    let cancelled = false;
    let timer: number | null = null;

    const scheduleBlink = () => {
      const waitMs =
        mood === 'sleepy'
          ? 2300 + Math.random() * 1700
          : phase === 'thinking'
            ? 3700 + Math.random() * 2100
            : 2700 + Math.random() * 2500;

      timer = window.setTimeout(() => {
        if (cancelled) return;
        setIsBlinking(true);
        window.setTimeout(() => {
          if (cancelled) return;
          setIsBlinking(false);
          // Occasional natural quick double-blink
          if (Math.random() < 0.22 && mood !== 'sleepy') {
            window.setTimeout(() => {
              if (cancelled) return;
              setIsBlinking(true);
              window.setTimeout(() => {
                if (!cancelled) setIsBlinking(false);
              }, 110);
            }, 125);
          }
          scheduleBlink();
        }, mood === 'sleepy' ? 220 : 120);
      }, waitMs);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [mood, phase, prefersReducedMotion]);

  // Subtle autonomous gaze drift of the eye pair when idle, thinking, or coding
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (phase === 'thinking' || mood === 'coding') {
      const id = window.setInterval(() => {
        setScanTick((t) => (t + 1) % 4);
      }, mood === 'coding' ? 480 : 640);
      return () => window.clearInterval(id);
    }

    if (phase === 'idle') {
      const id = window.setInterval(() => {
        const targets = [
          { x: 0, y: 0 },
          { x: 0.55, y: -0.2 },
          { x: -0.5, y: 0.14 },
          { x: 0.22, y: -0.35 },
          { x: 0, y: 0 },
        ];
        const next = targets[Math.floor(Math.random() * targets.length)];
        setWanderGaze(next);
      }, 2500);
      return () => window.clearInterval(id);
    }

    setWanderGaze({ x: 0, y: 0 });
  }, [phase, mood, prefersReducedMotion]);

  // Playful mode smoothly cycles Round -> Oval -> Square in rhythm
  useEffect(() => {
    if (prefersReducedMotion || mood !== 'playful') {
      setPlayfulStep(0);
      return;
    }
    const id = window.setInterval(() => {
      setPlayfulStep((s) => (s + 1) % PLAYFUL_SHAPES.length);
    }, 880);
    return () => window.clearInterval(id);
  }, [mood, prefersReducedMotion]);

  const effectiveShape: EyeShape =
    mood === 'playful' && phase !== 'listening'
      ? PLAYFUL_SHAPES[playfulStep]
      : shape;

  const baseDims = SHAPE_DIMENSIONS[effectiveShape];

  const liveBoost =
    phase === 'listening'
      ? Math.min(0.14, inputLevel * 0.16)
      : phase === 'speaking'
        ? Math.min(0.14, outputLevel * 0.19)
        : 0;

  // Whole-eye gaze vector (-1..1 normalized) — drives head-turn illusion with zero pupils
  let normGazeX = 0;
  let normGazeY = 0;
  if (!prefersReducedMotion) {
    if (phase === 'thinking') {
      const seq = [-0.75, 0.75, 0.45, -0.45];
      normGazeX = seq[scanTick];
      normGazeY = -0.6;
    } else if (mood === 'coding') {
      const seq = [-0.8, -0.25, 0.3, 0.8];
      normGazeX = seq[scanTick];
      normGazeY = 0.08;
    } else if (mood === 'sleepy') {
      normGazeX = 0;
      normGazeY = 0.45;
    } else if (phase === 'listening') {
      normGazeX = gazeOffset.x * 0.45;
      normGazeY = -0.18 + gazeOffset.y * 0.32;
    } else {
      normGazeX = Math.max(-1, Math.min(1, gazeOffset.x * 0.6 + wanderGaze.x * 0.55));
      normGazeY = Math.max(-1, Math.min(1, gazeOffset.y * 0.55 + wanderGaze.y * 0.55));
    }
  }

  const pairShiftX = normGazeX * 18;
  const pairShiftY = normGazeY * 12;

  // Whole-face expressive posture (head tilt, gentle bounce, playful sway)
  const rigAnimate = prefersReducedMotion
    ? { x: 0, y: 0, rotate: 0, scale: 1 }
    : mood === 'playful'
      ? {
          x: [0, -14, 0, 14, 0],
          y: [0, -10, 0, -10, 0],
          rotate: [0, -5, 0, 5, 0],
          scale: 1 + liveBoost * 0.45,
        }
      : mood === 'curious'
        ? {
            x: pairShiftX,
            y: -4 + pairShiftY,
            rotate: -6.5,
            scale: 1 + liveBoost * 0.45,
          }
        : mood === 'sleepy'
          ? {
              x: pairShiftX * 0.4,
              y: [pairShiftY, pairShiftY + 7, pairShiftY],
              rotate: [-2.4, 2.4, -2.4],
              scale: 0.96,
            }
          : mood === 'surprised'
            ? {
                x: pairShiftX * 0.5,
                y: -11 + pairShiftY * 0.5,
                rotate: 0,
                scale: 1.08 + liveBoost * 0.4,
              }
            : mood === 'happy'
              ? {
                  x: pairShiftX * 0.7,
                  y: (phase === 'speaking' ? -5 - outputLevel * 10 : -6) + pairShiftY * 0.5,
                  rotate: 0,
                  scale: 1.02 + liveBoost * 0.48,
                }
              : mood === 'love'
                ? {
                    x: pairShiftX * 0.6,
                    y: -3 + pairShiftY * 0.5,
                    rotate: 3.5,
                    scale: 1.03 + liveBoost * 0.45,
                  }
                : mood === 'serious'
                  ? {
                      x: pairShiftX * 0.5,
                      y: 2 + pairShiftY * 0.4,
                      rotate: 0,
                      scale: 1 + liveBoost * 0.25,
                    }
                  : {
                      x: pairShiftX,
                      y: (phase === 'speaking' ? -outputLevel * 9 : 0) + pairShiftY,
                      rotate: normGazeX * 2.2,
                      scale: 1 + liveBoost * 0.48,
                    };

  const rigTransition =
    mood === 'playful'
      ? { duration: 1.35, repeat: Infinity, ease: 'easeInOut' as const }
      : mood === 'sleepy'
        ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' as const }
        : GAZE_SPRING;

  // Eye surface fill adapts tastefully to theme + emotional accent
  const useAccentEyeColor =
    mood === 'love' || mood === 'surprised' || (mood === 'playful' && playfulStep === 2);

  // Per-eye pure geometric sculpting & eyelid shaping (completely pupil-free)
  const getEyeConfig = (side: 'left' | 'right') => {
    const isLeft = side === 'left';
    const width = baseDims.width;
    const height = baseDims.height;
    let borderRadius = baseDims.borderRadius;

    // Subtle 3D head-turn perspective: eye on the side we look toward narrows slightly,
    // far eye stays full — gives instant life and gaze direction with zero pupils
    const gazePerspectiveX = isLeft
      ? 1 + normGazeX * 0.045
      : 1 - normGazeX * 0.045;
    const gazePerspectiveY = isLeft
      ? 1 + normGazeX * 0.025
      : 1 - normGazeX * 0.025;

    let eyeScaleX = gazePerspectiveX;
    let eyeScaleY = gazePerspectiveY;
    let eyeRotate = 0;
    let eyeOffsetY = 0;
    let upperLidPct = 0; // 0 = open, 100 = fully closed
    let upperLidRotate = 0;
    let lowerCheekPct = 0; // 0 = hidden, 58 = joyful crescent arc

    if (phase === 'listening') {
      eyeScaleX *= 1 + inputLevel * 0.09;
      eyeScaleY *= 1 + inputLevel * 0.12;
    } else if (phase === 'speaking') {
      // Slight organic conversational asymmetry while speaking
      const speakBias = isLeft ? 1 : 0.94;
      eyeScaleX *= 1 + outputLevel * 0.055;
      eyeScaleY *= 1 + outputLevel * 0.11 * speakBias;
    }

    if (mood === 'happy') {
      lowerCheekPct = 52;
      eyeScaleX *= 1.05;
      eyeScaleY *= 0.94;
    } else if (mood === 'love') {
      lowerCheekPct = 42;
      eyeRotate = isLeft ? -6 : 6;
      eyeScaleY *= 0.98;
    } else if (mood === 'coding') {
      upperLidPct = 20;
      if (effectiveShape === 'square') {
        borderRadius = 18;
      }
    } else if (mood === 'serious') {
      upperLidPct = 34;
      upperLidRotate = isLeft ? 15 : -15;
      eyeScaleY *= 0.88;
    } else if (mood === 'sleepy') {
      upperLidPct = 56;
      upperLidRotate = isLeft ? -8 : 8;
      eyeScaleY *= 0.9;
    } else if (mood === 'curious') {
      if (isLeft) {
        eyeScaleX *= 1.1;
        eyeScaleY *= 1.1;
        eyeOffsetY = -4;
      } else {
        eyeScaleX *= 0.88;
        eyeScaleY *= 0.82;
        upperLidPct = 20;
        eyeOffsetY = 4;
      }
    } else if (mood === 'surprised') {
      eyeScaleX *= 1.1;
      eyeScaleY *= 1.14;
      if (effectiveShape === 'round') {
        borderRadius = 999;
      }
    } else if (mood === 'playful') {
      eyeOffsetY = isLeft
        ? playfulStep % 2 === 0
          ? -6
          : 4
        : playfulStep % 2 === 0
          ? 4
          : -6;
    }

    if (isBlinking) {
      eyeScaleY = 0.055;
      eyeScaleX *= 1.08;
    }

    return {
      width,
      height,
      borderRadius,
      eyeScaleX,
      eyeScaleY,
      eyeRotate,
      eyeOffsetY,
      upperLidPct,
      upperLidRotate,
      lowerCheekPct,
    };
  };

  const leftEye = getEyeConfig('left');
  const rightEye = getEyeConfig('right');

  return (
    <div
      className="relative flex items-center justify-center w-full h-[230px] sm:h-[290px] select-none"
      aria-hidden="true"
    >
      {/* Crisp Audio-Reactive Listening Rings (Zero Blur) */}
      <AnimatePresence>
        {phase === 'listening' && !prefersReducedMotion && (
          <motion.div
            key="listen-rings"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25, ease: LIQUID_EASE }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <motion.div
              animate={{
                scale: 1 + inputLevel * 0.22,
                opacity: 0.16 + inputLevel * 0.28,
              }}
              transition={{ duration: 0.1, ease: 'linear' }}
              className="w-[300px] sm:w-[400px] h-[200px] sm:h-[245px] rounded-full border border-[var(--ac)]"
            />
            <motion.div
              animate={{
                scale: 1.08 + inputLevel * 0.34,
                opacity: 0.08 + inputLevel * 0.18,
              }}
              transition={{ duration: 0.14, ease: 'linear' }}
              className="absolute w-[335px] sm:w-[445px] h-[225px] sm:h-[275px] rounded-full border border-dashed border-[var(--tx)]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crisp Thinking Orbital Arc (Zero Blur) */}
      <AnimatePresence>
        {(phase === 'thinking' || phase === 'transcribing') && !prefersReducedMotion && (
          <motion.svg
            key="thinking-orbit"
            viewBox="0 0 420 240"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 0.35, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: LIQUID_EASE }}
            className="pointer-events-none absolute w-[320px] sm:w-[430px] h-auto"
          >
            <motion.ellipse
              cx="210"
              cy="120"
              rx="192"
              ry="104"
              fill="none"
              stroke="var(--ac)"
              strokeWidth="1.4"
              strokeDasharray="18 14"
              animate={{ strokeDashoffset: [0, -128] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Speaking Side Waveform Hairlines */}
      <AnimatePresence>
        {phase === 'speaking' && !prefersReducedMotion && (
          <motion.div
            key="speaking-waves"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-between max-w-[440px] sm:max-w-[520px] mx-auto px-3 sm:px-4"
          >
            {[0, 1].map((sideIdx) => (
              <div key={sideIdx} className="flex items-center gap-1.5 h-16">
                {[0.55, 1, 0.7].map((mult, barIdx) => (
                  <motion.span
                    key={barIdx}
                    animate={{
                      scaleY: Math.max(0.22, Math.min(1, 0.24 + outputLevel * mult * 1.1)),
                    }}
                    transition={{ duration: 0.08, ease: 'linear' }}
                    className="w-[3px] h-14 rounded-full bg-[var(--ac)]/55 origin-center"
                  />
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Pure Sculptural Eye Pair (No Pupils, No Dots) */}
      <motion.div
        animate={rigAnimate}
        transition={rigTransition}
        className="relative z-10 flex items-center justify-center gap-10 sm:gap-14 scale-[0.74] sm:scale-100 will-change-transform"
      >
        {(
          [
            { side: 'left' as const, cfg: leftEye },
            { side: 'right' as const, cfg: rightEye },
          ]
        ).map(({ side, cfg }) => (
          <div key={side} className="relative flex items-center justify-center">
            {/* Technical Square Corner Reticle Brackets in Coding Mood */}
            <AnimatePresence>
              {mood === 'coding' && effectiveShape === 'square' && (
                <motion.svg
                  key={`brackets-${side}`}
                  viewBox="0 0 164 164"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 0.55, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.28, ease: LIQUID_EASE }}
                  className="pointer-events-none absolute w-[168px] h-[168px]"
                >
                  <path
                    d="M 22 6 H 6 V 22 M 142 6 H 158 V 22 M 6 142 V 158 H 22 M 158 142 V 158 H 142"
                    fill="none"
                    stroke="var(--ac)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              )}
            </AnimatePresence>

            {/* Subtle External Emphasis Ticks in Surprised Mood */}
            <AnimatePresence>
              {mood === 'surprised' && (
                <motion.svg
                  key={`surprise-ticks-${side}`}
                  viewBox="0 0 180 180"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 0.5, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.24, ease: LIQUID_EASE }}
                  className="pointer-events-none absolute w-[184px] h-[184px]"
                >
                  <path
                    d="M90 6V18 M90 162V174 M6 90H18 M162 90H174"
                    stroke="var(--ac)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </motion.svg>
              )}
            </AnimatePresence>

            {/* The Big Pure Pupil-Less Geometric Eye (Round / Oval / Square) */}
            <motion.div
              animate={{
                width: cfg.width,
                height: cfg.height,
                borderRadius: cfg.borderRadius,
                scaleX: cfg.eyeScaleX,
                scaleY: cfg.eyeScaleY,
                rotate: cfg.eyeRotate,
                y: cfg.eyeOffsetY,
                backgroundColor: useAccentEyeColor ? 'var(--ac)' : 'var(--tx)',
              }}
              transition={EYE_SPRING}
              className="relative overflow-hidden ring-1 ring-inset ring-[var(--bg)]/12 shadow-[0_24px_50px_-24px_rgba(24,23,21,0.34)] dark:shadow-[0_26px_58px_-20px_rgba(0,0,0,0.78)] will-change-transform"
            >
              {/* Subtle Architectural Depth Sheen (No pupil, no dots — pure sculpted surface) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.11] via-transparent to-black/[0.14] dark:from-white/[0.14] dark:to-black/[0.2]"
              />

              {/* Upper Eyelid Mask (Sleepy / Coding / Serious / Curious) */}
              <motion.div
                initial={false}
                animate={{
                  y: `${cfg.upperLidPct - 102}%`,
                  rotate: cfg.upperLidRotate,
                }}
                transition={LID_SPRING}
                className="pointer-events-none absolute -left-8 -right-8 top-0 h-full bg-[var(--bg)] origin-bottom"
              />

              {/* Lower Curved Cheek Mask (Pure Crescent Smile Eyes in Happy / Love) */}
              <motion.div
                initial={false}
                animate={{
                  y: `${104 - cfg.lowerCheekPct}%`,
                }}
                transition={LID_SPRING}
                className="pointer-events-none absolute -left-4 -right-4 bottom-0 h-[80%] rounded-t-[100%] bg-[var(--bg)]"
              />
            </motion.div>

            {/* Soft Rosy Cheek Accent beneath Eyes in Love Mood */}
            <AnimatePresence>
              {mood === 'love' && (
                <motion.span
                  key={`blush-${side}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 0.34, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.3, ease: LIQUID_EASE }}
                  className={`pointer-events-none absolute -bottom-7 w-9 h-2.5 rounded-full bg-[var(--ac)] ${
                    side === 'left' ? '-left-2' : '-right-2'
                  }`}
                />
              )}
            </AnimatePresence>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
