import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { FastDepthIcon, BalancedDepthIcon, DeepDepthIcon } from './Icons';
import { Language } from '../lib/i18n';
import { LIQUID_EASE, LIQUID_MORPH, LIQUID_TAP } from '../lib/motion';

export interface DepthAnswerItem {
  title: string;
  desc: string;
  width: string;
  text: string;
}

interface DepthsShowcaseProps {
  prompt: string;
  answers: DepthAnswerItem[];
  lang: Language;
}

interface ParsedStep {
  num: string;
  heading: string | null;
  body: string;
}

function parseDeepSteps(text: string): ParsedStep[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const stripped = line.replace(/^\d+\.\s*/, '');
      const colonIdx = stripped.indexOf(':');
      if (colonIdx > 0 && colonIdx < 40) {
        return {
          num: `0${idx + 1}`,
          heading: stripped.slice(0, colonIdx).trim(),
          body: stripped.slice(colonIdx + 1).trim(),
        };
      }
      return {
        num: `0${idx + 1}`,
        heading: null,
        body: stripped,
      };
    });
}

export function DepthsShowcase({ prompt, answers, lang }: DepthsShowcaseProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.25 });

  const [activeIdx, setActiveIdx] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [phase, setPhase] = useState<number>(prefersReducedMotion ? 4 : 0);
  const [isPaused, setIsPaused] = useState(false);

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isInViewRef = useRef(isInView);
  isInViewRef.current = isInView;

  const safeCount = Math.max(1, answers.length);
  const currentIdx = activeIdx % safeCount;
  const currentAnswer = answers[currentIdx] || { title: '', desc: '', width: '33%', text: '' };

  const copy = useMemo(
    () =>
      lang === 'tr'
        ? {
            promptLabel: 'Soru',
            answerLabel: 'Yanıt',
            replayLabel: 'Animasyonu tekrar oynat',
            fastPass: 'Doğrudan geçiş',
            balancedTop: 'Değer analizi',
            balancedBottom: 'Paket dengesi',
            deepLabels: ['Değer ölçütü', 'Paket yapısı', 'Erken test'] as const,
            phaseSteps: [
              ['Doğrudan yanıt'],
              ['Değer', 'Paketler', 'Dengeli özet'],
              ['Ölçüt', 'Yapı', 'Test', 'Tam plan'],
            ] as const,
          }
        : {
            promptLabel: 'Prompt',
            answerLabel: 'Answer',
            replayLabel: 'Replay animation',
            fastPass: 'Direct pass',
            balancedTop: 'Value framing',
            balancedBottom: 'Tier balance',
            deepLabels: ['Value metric', 'Tier structure', 'Early test'] as const,
            phaseSteps: [
              ['Direct answer'],
              ['Value', 'Tiers', 'Summary'],
              ['Metric', 'Tiers', 'Test', 'Full plan'],
            ] as const,
          },
    [lang]
  );

  // Choreographed phase progression per depth mode + auto-cycle while in view
  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(4);
      return;
    }

    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const runSequence = async () => {
      setPhase(0);
      await sleep(70);
      if (cancelled) return;

      if (currentIdx === 0) {
        // Fast: direct, snappy trace -> immediate arrival
        setPhase(1);
        await sleep(320);
        if (cancelled) return;
        setPhase(4);
      } else if (currentIdx === 1) {
        // Balanced: upper branch -> lower branch + bridge -> convergence
        setPhase(1);
        await sleep(320);
        if (cancelled) return;
        setPhase(2);
        await sleep(360);
        if (cancelled) return;
        setPhase(4);
      } else {
        // Deep: 3 sequential analytical layers + cross-verification -> final synthesis
        setPhase(1);
        await sleep(300);
        if (cancelled) return;
        setPhase(2);
        await sleep(320);
        if (cancelled) return;
        setPhase(3);
        await sleep(380);
        if (cancelled) return;
        setPhase(4);
      }

      // Calm read dwell before smoothly advancing to the next depth
      const targetDwell = currentIdx === 0 ? 4400 : currentIdx === 1 ? 5400 : 6600;
      let waited = 0;
      while (waited < targetDwell) {
        await sleep(200);
        if (cancelled) return;
        if (!isPausedRef.current && isInViewRef.current) {
          waited += 200;
        }
      }

      if (!cancelled) {
        setActiveIdx((prev) => (prev + 1) % safeCount);
      }
    };

    void runSequence();

    return () => {
      cancelled = true;
    };
  }, [currentIdx, replayNonce, prefersReducedMotion, safeCount]);

  const handleSelectDepth = (index: number) => {
    if (index === currentIdx) {
      setReplayNonce((n) => n + 1);
    } else {
      setActiveIdx(index);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveIdx((prev) => (prev + 1) % safeCount);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveIdx((prev) => (prev - 1 + safeCount) % safeCount);
    }
  };

  const balancedParagraphs = useMemo(
    () =>
      currentIdx === 1
        ? currentAnswer.text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
    [currentIdx, currentAnswer.text]
  );

  const deepSteps = useMemo(
    () => (currentIdx === 2 ? parseDeepSteps(currentAnswer.text) : []),
    [currentIdx, currentAnswer.text]
  );

  const depthIcons = [FastDepthIcon, BalancedDepthIcon, DeepDepthIcon] as const;
  const activeStepLabels = copy.phaseSteps[currentIdx] ?? copy.phaseSteps[0];
  const arrived = prefersReducedMotion || phase >= 4;
  const animKey = `${currentIdx}-${replayNonce}`;
  const dwellSeconds = currentIdx === 0 ? 4.4 : currentIdx === 1 ? 5.4 : 6.6;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="rounded-[28px] bg-[var(--card)] border border-[var(--bd)] overflow-hidden shadow-[0_12px_36px_-24px_rgba(23,22,20,0.12)] dark:shadow-[0_18px_48px_-28px_rgba(0,0,0,0.48)]"
    >
      {/* Interactive Depth Selector Bar */}
      <div
        role="tablist"
        aria-label={lang === 'tr' ? 'Düşünme derinliği' : 'Reasoning depth'}
        onKeyDown={handleKeyDown}
        className="grid grid-cols-1 sm:grid-cols-3 border-b border-[var(--bd)]/80 bg-[var(--surf)]/45 p-2 gap-1.5"
      >
        {answers.map((d, i) => {
          const active = currentIdx === i;
          const Icon = depthIcons[i % depthIcons.length];
          const bars = i + 1;
          return (
            <motion.button
              key={d.title}
              type="button"
              role="tab"
              aria-selected={active}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
              transition={LIQUID_TAP}
              onClick={() => handleSelectDepth(i)}
              className={`relative px-4 py-3.5 rounded-[18px] text-left transition-colors cursor-pointer ${
                active ? 'text-[var(--tx)]' : 'text-[var(--mut)] hover:text-[var(--tx)]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="depths-active-tab-surface"
                  transition={LIQUID_MORPH}
                  className="absolute inset-0 rounded-[18px] bg-[var(--card)] border border-[var(--bd)] shadow-[0_4px_14px_-8px_rgba(23,22,20,0.12)] dark:shadow-[0_6px_18px_-10px_rgba(0,0,0,0.45)]"
                  aria-hidden="true"
                />
              )}

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? 'text-[var(--editorial-accent)]' : 'text-[var(--mut)]'
                      }`}
                    />
                    <span className="font-soft text-[15px] font-semibold tracking-tight whitespace-nowrap">
                      {d.title}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--mut)] leading-relaxed">{d.desc}</p>
                </div>

                {/* Stepped depth signal bars (1 / 2 / 3) */}
                <div className="flex items-end gap-[3px] h-4 pt-0.5 shrink-0" aria-hidden="true">
                  {[0, 1, 2].map((b) => {
                    const filled = b < bars;
                    const heights = ['h-1.5', 'h-2.5', 'h-3.5'];
                    return (
                      <motion.span
                        key={b}
                        animate={{
                          opacity: filled ? (active ? 1 : 0.45) : 0.16,
                          scaleY: active && filled ? 1 : 0.85,
                        }}
                        transition={{ duration: 0.24, ease: LIQUID_EASE }}
                        className={`w-[3px] rounded-full origin-bottom ${heights[b]} ${
                          active && filled ? 'bg-[var(--editorial-accent)]' : 'bg-[var(--tx)]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Animated Geometric Reasoning Stage (Replaces Static Photo) */}
      <div className="relative bg-[var(--surf)]/55 border-b border-[var(--bd)]/75 px-4 sm:px-8 pt-6 pb-5 overflow-hidden">
        {/* Top micro-header inside stage */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-4 text-xs font-medium text-[var(--mut)] overflow-x-auto no-scrollbar">
            {activeStepLabels.map((stepLabel, idx) => {
              const stepThreshold =
                activeStepLabels.length === 1
                  ? 1
                  : activeStepLabels.length === 3
                    ? idx === 0
                      ? 1
                      : idx === 1
                        ? 2
                        : 4
                    : idx + 1;
              const stepActive = prefersReducedMotion || phase >= stepThreshold;
              return (
                <span
                  key={`${currentIdx}-${stepLabel}`}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap transition-opacity duration-200 ${
                    stepActive ? 'text-[var(--tx)] opacity-100' : 'text-[var(--mut)] opacity-45'
                  }`}
                >
                  <span className="tabular-nums opacity-55">0{idx + 1}</span>
                  <span>{stepLabel}</span>
                </span>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setReplayNonce((n) => n + 1)}
            aria-label={copy.replayLabel}
            title={copy.replayLabel}
            className="w-7 h-7 rounded-full border border-[var(--bd)] bg-[var(--card)]/80 text-[var(--mut)] hover:text-[var(--tx)] hover:border-[var(--tx)]/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Crisp Vector Reasoning Topology */}
        <div className="w-full max-w-[740px] mx-auto">
          <svg
            viewBox="0 0 680 186"
            className="w-full h-auto block select-none overflow-visible"
            role="img"
            aria-label={`${currentAnswer.title}: ${currentAnswer.desc}`}
          >
            {/* Architectural hairline reference guides */}
            <g stroke="var(--tx)" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="2 5">
              <line x1="82" y1="18" x2="82" y2="162" />
              <line x1="340" y1="18" x2="340" y2="162" />
              <line x1="598" y1="18" x2="598" y2="162" />
            </g>

            {/* Subtle structural grid ticks */}
            <g fill="var(--tx)" fillOpacity="0.14">
              {[168, 254, 426, 512].map((x) =>
                [38, 92, 146].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />)
              )}
            </g>

            {/* Mode-Specific Animated Reasoning Trajectories */}
            <AnimatePresence mode="wait">
              {currentIdx === 0 && (
                <motion.g
                  key={`fast-${animKey}`}
                  initial={prefersReducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2, ease: LIQUID_EASE }}
                >
                  {/* Base guide rail */}
                  <path
                    d="M 100 92 L 580 92"
                    fill="none"
                    stroke="var(--tx)"
                    strokeOpacity="0.15"
                    strokeWidth="1.25"
                  />

                  {/* Direct velocity beam */}
                  <motion.path
                    d="M 100 92 L 580 92"
                    fill="none"
                    stroke="var(--editorial-accent)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: phase >= 1 ? 1 : 0 }}
                    transition={{ duration: 0.32, ease: LIQUID_EASE }}
                  />

                  {/* Traveling crisp signal marker */}
                  {!prefersReducedMotion && phase >= 1 && (
                    <motion.g
                      initial={{ x: 100, opacity: 0 }}
                      animate={{ x: [100, 580], opacity: [0, 1, 1, 0] }}
                      transition={{
                        duration: 0.4,
                        ease: LIQUID_EASE,
                        times: [0, 0.12, 0.86, 1],
                      }}
                    >
                      <circle cx="0" cy="92" r="7.5" fill="none" stroke="var(--editorial-accent)" strokeWidth="1.2" strokeOpacity="0.4" />
                      <circle cx="0" cy="92" r="3.5" fill="var(--editorial-accent)" />
                    </motion.g>
                  )}

                  {/* Minimalist midpoint diamond cadence mark */}
                  <motion.g
                    style={{ transformOrigin: '340px 92px' }}
                    initial={prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: 0.65, opacity: 0 }}
                    animate={{
                      scale: phase >= 1 ? 1 : 0.65,
                      opacity: phase >= 1 ? 1 : 0,
                    }}
                    transition={{ duration: 0.24, delay: 0.12, ease: LIQUID_EASE }}
                  >
                    <path
                      d="M 340 84.5 L 347.5 92 L 340 99.5 L 332.5 92 Z"
                      fill="var(--card)"
                      stroke="var(--editorial-accent)"
                      strokeWidth="1.6"
                    />
                    <circle cx="340" cy="92" r="2.2" fill="var(--editorial-accent)" />
                  </motion.g>

                  <motion.text
                    x="340"
                    y="122"
                    textAnchor="middle"
                    fill="var(--mut)"
                    fontSize="11.5"
                    fontWeight="500"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: phase >= 1 ? 1 : 0, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.14, ease: LIQUID_EASE }}
                  >
                    {copy.fastPass}
                  </motion.text>
                </motion.g>
              )}

              {currentIdx === 1 && (
                <motion.g
                  key={`balanced-${animKey}`}
                  initial={prefersReducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2, ease: LIQUID_EASE }}
                >
                  {/* Base guide curves */}
                  <g fill="none" stroke="var(--tx)" strokeOpacity="0.14" strokeWidth="1.25">
                    <path d="M 100 92 C 190 92, 232 48, 340 48 C 448 48, 490 92, 580 92" />
                    <path d="M 100 92 C 190 92, 232 136, 340 136 C 448 136, 490 92, 580 92" />
                  </g>

                  {/* Upper synthesis branch */}
                  <motion.path
                    d="M 100 92 C 190 92, 232 48, 340 48 C 448 48, 490 92, 580 92"
                    fill="none"
                    stroke="var(--editorial-accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: phase >= 1 ? 1 : 0 }}
                    transition={{ duration: 0.54, ease: LIQUID_EASE }}
                  />

                  {/* Lower synthesis branch */}
                  <motion.path
                    d="M 100 92 C 190 92, 232 136, 340 136 C 448 136, 490 92, 580 92"
                    fill="none"
                    stroke="var(--editorial-accent)"
                    strokeWidth="2"
                    strokeOpacity="0.78"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: phase >= 2 ? 1 : 0 }}
                    transition={{ duration: 0.54, ease: LIQUID_EASE }}
                  />

                  {/* Smooth curve-hugging signal pulses traveling along both Balanced arcs */}
                  {!prefersReducedMotion && phase >= 1 && (
                    <circle r="3" fill="var(--editorial-accent)" opacity="0.9">
                      <animateMotion
                        dur="2.4s"
                        repeatCount="indefinite"
                        keyPoints="0;1"
                        keyTimes="0;1"
                        calcMode="spline"
                        keySplines="0.22 1 0.36 1"
                        path="M 100 92 C 190 92, 232 48, 340 48 C 448 48, 490 92, 580 92"
                      />
                    </circle>
                  )}
                  {!prefersReducedMotion && phase >= 2 && (
                    <circle r="3" fill="var(--editorial-accent)" opacity="0.75">
                      <animateMotion
                        dur="2.4s"
                        begin="0.45s"
                        repeatCount="indefinite"
                        keyPoints="0;1"
                        keyTimes="0;1"
                        calcMode="spline"
                        keySplines="0.22 1 0.36 1"
                        path="M 100 92 C 190 92, 232 136, 340 136 C 448 136, 490 92, 580 92"
                      />
                    </circle>
                  )}

                  {/* Center equilibrium bridge connecting both perspectives */}
                  <motion.path
                    d="M 340 58 L 340 126"
                    fill="none"
                    stroke="var(--tx)"
                    strokeOpacity="0.4"
                    strokeWidth="1.35"
                    strokeDasharray="3 3"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: phase >= 2 ? 1 : 0 }}
                    transition={{ duration: 0.3, delay: 0.14, ease: LIQUID_EASE }}
                  />

                  {/* Upper checkpoint node */}
                  <motion.g
                    style={{ transformOrigin: '340px 48px' }}
                    initial={prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
                    animate={{
                      scale: phase >= 1 ? 1 : 0.6,
                      opacity: phase >= 1 ? 1 : 0,
                    }}
                    transition={{ duration: 0.28, delay: 0.18, ease: LIQUID_EASE }}
                  >
                    <circle cx="340" cy="48" r="9.5" fill="var(--card)" stroke="var(--editorial-accent)" strokeWidth="1.75" />
                    <circle cx="340" cy="48" r="3" fill="var(--editorial-accent)" />
                  </motion.g>
                  <motion.text
                    x="340"
                    y="27"
                    textAnchor="middle"
                    fill="var(--tx)"
                    fontSize="11.5"
                    fontWeight="500"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 3 }}
                    animate={{ opacity: phase >= 1 ? 0.92 : 0, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.22, ease: LIQUID_EASE }}
                  >
                    {copy.balancedTop}
                  </motion.text>

                  {/* Lower checkpoint node */}
                  <motion.g
                    style={{ transformOrigin: '340px 136px' }}
                    initial={prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
                    animate={{
                      scale: phase >= 2 ? 1 : 0.6,
                      opacity: phase >= 2 ? 1 : 0,
                    }}
                    transition={{ duration: 0.28, delay: 0.12, ease: LIQUID_EASE }}
                  >
                    <circle cx="340" cy="136" r="9.5" fill="var(--card)" stroke="var(--editorial-accent)" strokeWidth="1.75" />
                    <circle cx="340" cy="136" r="3" fill="var(--editorial-accent)" />
                  </motion.g>
                  <motion.text
                    x="340"
                    y="164"
                    textAnchor="middle"
                    fill="var(--tx)"
                    fontSize="11.5"
                    fontWeight="500"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -3 }}
                    animate={{ opacity: phase >= 2 ? 0.92 : 0, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.15, ease: LIQUID_EASE }}
                  >
                    {copy.balancedBottom}
                  </motion.text>
                </motion.g>
              )}

              {currentIdx === 2 && (
                <motion.g
                  key={`deep-${animKey}`}
                  initial={prefersReducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2, ease: LIQUID_EASE }}
                >
                  {/* Base 3-layer lattice guides */}
                  <g fill="none" stroke="var(--tx)" strokeOpacity="0.13" strokeWidth="1.2">
                    <path d="M 100 92 C 162 92, 184 38, 250 38 L 430 38 C 496 38, 518 92, 580 92" />
                    <path d="M 100 92 L 580 92" />
                    <path d="M 100 92 C 162 92, 184 146, 250 146 L 430 146 C 496 146, 518 92, 580 92" />
                  </g>

                  {/* Layer 1: Top analytical rail */}
                  <motion.path
                    d="M 100 92 C 162 92, 184 38, 250 38 L 430 38 C 496 38, 518 92, 580 92"
                    fill="none"
                    stroke="var(--editorial-accent)"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: phase >= 1 ? 1 : 0 }}
                    transition={{ duration: 0.52, ease: LIQUID_EASE }}
                  />

                  {/* Layer 2: Central spine */}
                  <motion.path
                    d="M 100 92 L 580 92"
                    fill="none"
                    stroke="var(--editorial-accent)"
                    strokeWidth="1.9"
                    strokeOpacity="0.86"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: phase >= 2 ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: LIQUID_EASE }}
                  />

                  {/* Layer 3: Bottom verification rail */}
                  <motion.path
                    d="M 100 92 C 162 92, 184 146, 250 146 L 430 146 C 496 146, 518 92, 580 92"
                    fill="none"
                    stroke="var(--editorial-accent)"
                    strokeWidth="1.9"
                    strokeOpacity="0.74"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: phase >= 3 ? 1 : 0 }}
                    transition={{ duration: 0.54, ease: LIQUID_EASE }}
                  />

                  {/* Curve-hugging signal pulses traveling across all 3 Deep lattice rails */}
                  {!prefersReducedMotion && phase >= 1 && (
                    <circle r="2.75" fill="var(--editorial-accent)" opacity="0.9">
                      <animateMotion
                        dur="2.8s"
                        repeatCount="indefinite"
                        keyPoints="0;1"
                        keyTimes="0;1"
                        calcMode="spline"
                        keySplines="0.22 1 0.36 1"
                        path="M 100 92 C 162 92, 184 38, 250 38 L 430 38 C 496 38, 518 92, 580 92"
                      />
                    </circle>
                  )}
                  {!prefersReducedMotion && phase >= 2 && (
                    <circle r="2.75" fill="var(--editorial-accent)" opacity="0.82">
                      <animateMotion
                        dur="2.8s"
                        begin="0.55s"
                        repeatCount="indefinite"
                        keyPoints="0;1"
                        keyTimes="0;1"
                        calcMode="spline"
                        keySplines="0.22 1 0.36 1"
                        path="M 100 92 L 580 92"
                      />
                    </circle>
                  )}
                  {!prefersReducedMotion && phase >= 3 && (
                    <circle r="2.75" fill="var(--editorial-accent)" opacity="0.74">
                      <animateMotion
                        dur="2.8s"
                        begin="1.1s"
                        repeatCount="indefinite"
                        keyPoints="0;1"
                        keyTimes="0;1"
                        calcMode="spline"
                        keySplines="0.22 1 0.36 1"
                        path="M 100 92 C 162 92, 184 146, 250 146 L 430 146 C 496 146, 518 92, 580 92"
                      />
                    </circle>
                  )}

                  {/* Cross-verification vertical & diagonal struts */}
                  <g fill="none" stroke="var(--tx)" strokeOpacity="0.34" strokeWidth="1.15">
                    <motion.path
                      d="M 250 46 L 250 84 M 250 100 L 250 138"
                      strokeDasharray="2.5 3"
                      initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                      animate={{ pathLength: phase >= 2 ? 1 : 0 }}
                      transition={{ duration: 0.34, delay: 0.1, ease: LIQUID_EASE }}
                    />
                    <motion.path
                      d="M 430 46 L 430 84 M 430 100 L 430 138"
                      strokeDasharray="2.5 3"
                      initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                      animate={{ pathLength: phase >= 3 ? 1 : 0 }}
                      transition={{ duration: 0.34, delay: 0.1, ease: LIQUID_EASE }}
                    />
                    <motion.path
                      d="M 257 42 L 423 88 M 257 142 L 423 96"
                      strokeOpacity="0.22"
                      initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                      animate={{ pathLength: phase >= 3 ? 1 : 0 }}
                      transition={{ duration: 0.42, delay: 0.14, ease: LIQUID_EASE }}
                    />
                  </g>

                  {/* 6 Lattice Nodes (3 layers × 2 stages) */}
                  {[
                    { y: 38, labelY: 24, phaseGate: 1, verifyGate: 2, label: copy.deepLabels[0] },
                    { y: 92, labelY: 79, phaseGate: 2, verifyGate: 3, label: copy.deepLabels[1] },
                    { y: 146, labelY: 166, phaseGate: 3, verifyGate: 4, label: copy.deepLabels[2] },
                  ].map((layer, idx) => {
                    const activeLayer = prefersReducedMotion || phase >= layer.phaseGate;
                    const verifiedLayer = prefersReducedMotion || phase >= layer.verifyGate;
                    return (
                      <g key={layer.label}>
                        {/* Analysis node (left) */}
                        <motion.g
                          style={{ transformOrigin: `250px ${layer.y}px` }}
                          initial={prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: 0.55, opacity: 0 }}
                          animate={{
                            scale: activeLayer ? 1 : 0.55,
                            opacity: activeLayer ? 1 : 0,
                          }}
                          transition={{ duration: 0.26, delay: 0.08, ease: LIQUID_EASE }}
                        >
                          <circle cx="250" cy={layer.y} r="7.5" fill="var(--card)" stroke="var(--editorial-accent)" strokeWidth="1.65" />
                          <circle cx="250" cy={layer.y} r="2.5" fill="var(--editorial-accent)" />
                        </motion.g>

                        {/* Verification node (right) */}
                        <motion.g
                          style={{ transformOrigin: `430px ${layer.y}px` }}
                          initial={prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: 0.55, opacity: 0 }}
                          animate={{
                            scale: verifiedLayer ? 1 : 0.55,
                            opacity: verifiedLayer ? 1 : 0,
                          }}
                          transition={{ duration: 0.26, delay: 0.06, ease: LIQUID_EASE }}
                        >
                          <circle cx="430" cy={layer.y} r="7.5" fill="var(--card)" stroke="var(--editorial-accent)" strokeWidth="1.65" />
                          <circle cx="430" cy={layer.y} r="2.5" fill="var(--editorial-accent)" />
                        </motion.g>

                        {/* Clean layer title centered between the two nodes */}
                        {idx === 1 && (
                          <rect
                            x="292"
                            y="67"
                            width="96"
                            height="16"
                            rx="4"
                            fill="var(--surf)"
                            fillOpacity="0.92"
                          />
                        )}
                        <motion.text
                          x="340"
                          y={layer.labelY}
                          textAnchor="middle"
                          fill="var(--tx)"
                          fontSize="11"
                          fontWeight="500"
                          initial={prefersReducedMotion ? { opacity: 0.9 } : { opacity: 0 }}
                          animate={{ opacity: activeLayer ? 0.9 : 0 }}
                          transition={{ duration: 0.26, delay: 0.1, ease: LIQUID_EASE }}
                        >
                          {layer.label}
                        </motion.text>
                      </g>
                    );
                  })}
                </motion.g>
              )}
            </AnimatePresence>

            {/* Left Anchor: Prompt Origin Node */}
            <g>
              <motion.circle
                cx="82"
                cy="92"
                r="26"
                fill="none"
                stroke="var(--tx)"
                strokeOpacity="0.16"
                strokeWidth="1"
                strokeDasharray="3 4"
                style={{ transformOrigin: '82px 92px' }}
                animate={
                  prefersReducedMotion
                    ? undefined
                    : { rotate: currentIdx * 60 + replayNonce * 45 }
                }
                transition={{ duration: 0.65, ease: LIQUID_EASE }}
              />
              <circle cx="82" cy="92" r="17" fill="var(--card)" stroke="var(--tx)" strokeOpacity="0.72" strokeWidth="1.5" />
              <circle cx="82" cy="92" r="4.5" fill="var(--editorial-accent)" />
              <text
                x="82"
                y="142"
                textAnchor="middle"
                fill="var(--mut)"
                fontSize="11.5"
                fontWeight="500"
              >
                {copy.promptLabel}
              </text>
            </g>

            {/* Right Anchor: Synthesis Output Node with Depth Rings (1 / 2 / 3) */}
            <g>
              {[0, 1, 2].map((ringIdx) => {
                const visibleForDepth = ringIdx <= currentIdx;
                const radius = 25 + ringIdx * 8.5;
                return (
                  <motion.circle
                    key={ringIdx}
                    cx="598"
                    cy="92"
                    r={radius}
                    fill="none"
                    stroke="var(--editorial-accent)"
                    strokeWidth={ringIdx === 0 ? '1.35' : '1.05'}
                    style={{ transformOrigin: '598px 92px' }}
                    initial={false}
                    animate={{
                      opacity: visibleForDepth && arrived ? 0.45 - ringIdx * 0.12 : 0,
                      scale: visibleForDepth && arrived ? 1 : 0.78,
                    }}
                    transition={{
                      duration: 0.36,
                      delay: visibleForDepth && arrived ? ringIdx * 0.06 : 0,
                      ease: LIQUID_EASE,
                    }}
                  />
                );
              })}

              <motion.circle
                cx="598"
                cy="92"
                r="17"
                strokeWidth="1.5"
                animate={{
                  fill: arrived ? 'var(--ac)' : 'var(--card)',
                  stroke: arrived ? 'var(--ac)' : 'var(--tx)',
                  strokeOpacity: arrived ? 1 : 0.35,
                }}
                transition={{ duration: 0.28, ease: LIQUID_EASE }}
              />

              {/* Minimal interlocking geometric mark inside Output node */}
              <motion.g
                animate={{ opacity: arrived ? 1 : 0.42 }}
                transition={{ duration: 0.24, ease: LIQUID_EASE }}
              >
                <circle
                  cx="594.8"
                  cy="92"
                  r="4.6"
                  fill="none"
                  stroke={arrived ? 'var(--on)' : 'var(--tx)'}
                  strokeWidth="1.5"
                />
                <circle
                  cx="601.2"
                  cy="92"
                  r="4.6"
                  fill="none"
                  stroke={arrived ? 'var(--on)' : 'var(--tx)'}
                  strokeWidth="1.5"
                />
              </motion.g>

              <text
                x="598"
                y="148"
                textAnchor="middle"
                fill="var(--mut)"
                fontSize="11.5"
                fontWeight="500"
              >
                {copy.answerLabel}
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Synchronized Live Answer Stage */}
      <div className="p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-[var(--bd)]/75">
          <p className="font-soft text-base sm:text-lg font-medium text-[var(--tx)]">
            “{prompt}”
          </p>
          <span className="text-xs font-medium tabular-nums text-[var(--mut)] shrink-0">
            0{currentIdx + 1} / 0{safeCount} · {currentAnswer.title}
          </span>
        </div>

        <div className="min-h-[164px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${lang}-${currentIdx}-${replayNonce}`}
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.18, ease: LIQUID_EASE }}
            >
              {/* Fast: Crisp single-line direct answer */}
              {currentIdx === 0 && (
                <motion.p
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{
                    opacity: arrived ? 1 : 0.2,
                    y: arrived ? 0 : 6,
                  }}
                  transition={{ duration: 0.26, ease: LIQUID_EASE }}
                  className="text-[15.5px] sm:text-[17px] leading-[1.72] text-[var(--tx)]/92 max-w-3xl"
                >
                  {currentAnswer.text}
                </motion.p>
              )}

              {/* Balanced: Two-part structured recommendation syncing with the 2 arcs */}
              {currentIdx === 1 && (
                <div className="space-y-4 max-w-3xl">
                  {balancedParagraphs.map((para, idx) => {
                    const visible = prefersReducedMotion || (idx === 0 ? phase >= 2 : phase >= 4);
                    return (
                      <motion.p
                        key={idx}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                        animate={{
                          opacity: visible ? 1 : 0.14,
                          y: visible ? 0 : 8,
                        }}
                        transition={{ duration: 0.32, ease: LIQUID_EASE }}
                        className="text-[15px] sm:text-[16px] leading-[1.75] text-[var(--tx)]/92"
                      >
                        {para}
                      </motion.p>
                    );
                  })}
                </div>
              )}

              {/* Deep: 3 cascading editorial strategy steps syncing with the 3 lattice layers */}
              {currentIdx === 2 && (
                <div className="space-y-3.5">
                  {deepSteps.map((step, idx) => {
                    const gate = idx + 1;
                    const visible = prefersReducedMotion || phase >= gate;
                    return (
                      <motion.div
                        key={step.num}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                        animate={{
                          opacity: visible ? 1 : 0.14,
                          y: visible ? 0 : 8,
                        }}
                        transition={{ duration: 0.34, ease: LIQUID_EASE }}
                        className="grid grid-cols-[2rem_1fr] gap-3 items-baseline"
                      >
                        <span className="text-xs tabular-nums text-[var(--editorial-accent)] font-semibold">
                          {step.num}
                        </span>
                        <p className="text-[14.5px] sm:text-[15.5px] leading-[1.7] text-[var(--tx)]/90">
                          {step.heading && (
                            <span className="font-semibold text-[var(--tx)]">
                              {step.heading}:{' '}
                            </span>
                          )}
                          <span>{step.body}</span>
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Subtle Bottom Hairline Auto-Cycle Progress Indicator */}
      <div className="h-[2px] w-full bg-[var(--bd)]/35 overflow-hidden" aria-hidden="true">
        {!prefersReducedMotion && (
          <motion.div
            key={`depth-dwell-${animKey}-${arrived ? 'dwell' : 'trace'}-${isPaused ? 'p' : 'r'}-${isInView ? 'v' : 'h'}`}
            className="h-full w-full bg-[var(--editorial-accent)]/80 origin-left"
            initial={{ scaleX: arrived ? 0.24 : 0 }}
            animate={{
              scaleX: !arrived ? 0.24 : isPaused || !isInView ? 0.24 : 1,
            }}
            transition={{
              duration: !arrived
                ? currentIdx === 0
                  ? 0.34
                  : currentIdx === 1
                    ? 0.68
                    : 1.0
                : isPaused || !isInView
                  ? 0.2
                  : dwellSeconds,
              ease: 'linear',
            }}
          />
        )}
      </div>
    </div>
  );
}
