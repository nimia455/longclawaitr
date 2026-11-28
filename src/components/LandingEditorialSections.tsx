import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { ArrowLeft, ArrowRight, ArrowUpRight, AudioLines } from 'lucide-react';
import { LongclawLogo, ModelLogo } from './Icons';
import type { ChatModelId } from '../lib/models';
import type { Language } from '../lib/i18n';
import {
  EDITORIAL_EASE,
  EDITORIAL_VIEWPORT,
  LIQUID_MORPH,
  LIQUID_SCROLL_SPRING,
  LIQUID_SPRING,
  LIQUID_TAP,
  useIsCoarsePointer,
} from '../lib/motion';

type MiniEyeShape = 'round' | 'oval' | 'square';

const MINI_EYE_DIMS: Record<
  MiniEyeShape,
  { width: number; height: number; borderRadius: number }
> = {
  round: { width: 48, height: 48, borderRadius: 24 },
  oval: { width: 32, height: 56, borderRadius: 16 },
  square: { width: 46, height: 46, borderRadius: 10 },
};

/**
 * Interactive Voice Companion Eyes Bento Card
 * Pure pupil-less sculptural Round, Oval, and Square eyes with click-to-smile & whole-eye gaze.
 */
export function VoiceEyesMiniShowcase({
  lang,
  onTryVoice,
}: {
  lang: Language;
  onTryVoice: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(cardRef, { amount: 0.15 });
  const [shape, setShape] = useState<MiniEyeShape>('round');
  const [isBlinking, setIsBlinking] = useState(false);
  const [isSmiling, setIsSmiling] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  // Gentle organic blink every ~3.4s (only while visible on screen)
  useEffect(() => {
    if (prefersReducedMotion || !isInView) return;
    let cancelled = false;
    const schedule = () =>
      window.setTimeout(() => {
        if (cancelled) return;
        setIsBlinking(true);
        window.setTimeout(() => {
          if (!cancelled) setIsBlinking(false);
        }, 120);
        timer = schedule();
      }, 3100 + Math.random() * 1400);

    let timer = schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [prefersReducedMotion, isInView]);

  // Subtle whole-eye gaze shift (only while visible on screen)
  useEffect(() => {
    if (prefersReducedMotion || !isInView) return;
    const positions = [
      { x: 0, y: 0 },
      { x: 6, y: -2 },
      { x: -6, y: 1.5 },
      { x: 0, y: 0 },
    ];
    let idx = 0;
    const id = window.setInterval(() => {
      idx = (idx + 1) % positions.length;
      setGaze(positions[idx]);
    }, 2400);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion, isInView]);

  const dims = MINI_EYE_DIMS[shape];
  const isTr = lang === 'tr';

  const options: Array<{ id: MiniEyeShape; label: string }> = [
    { id: 'round', label: isTr ? 'Yuvarlak' : 'Round' },
    { id: 'oval', label: 'Oval' },
    { id: 'square', label: isTr ? 'Kare' : 'Square' },
  ];

  const triggerPlayfulSmile = () => {
    setIsSmiling(true);
    window.setTimeout(() => setIsSmiling(false), 1400);
  };

  return (
    <motion.article
      ref={cardRef}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={EDITORIAL_VIEWPORT}
      transition={{ duration: 0.52, delay: 0.12, ease: EDITORIAL_EASE }}
      className="relative rounded-[24px] bg-[var(--card)] border border-[var(--bd)] p-6 sm:p-7 flex flex-col justify-between gap-6 overflow-hidden transition-colors duration-300 hover:border-[var(--tx)]/24"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--mut)]">
            {isTr ? 'Sesli sohbet · Komut duyarlı gözler' : 'Voice chat · Command-driven eyes'}
          </p>
          <h3 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-[var(--tx)] text-balance">
            {isTr ? 'Söylediklerine göre şekil alan sesli eşlikçi' : 'A voice companion that reacts to every command'}
          </h3>
        </div>
        <button
          type="button"
          onClick={onTryVoice}
          aria-label={isTr ? 'Sesli sohbeti dene' : 'Try voice chat'}
          className="w-9 h-9 rounded-full border border-[var(--bd)] bg-[var(--surf)]/75 hover:bg-[var(--ac)] hover:text-[var(--on)] hover:border-transparent text-[var(--tx)] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
        >
          <AudioLines className="w-4 h-4" />
        </button>
      </div>

      {/* Sculptural Mini Eye Stage (pure pupil-less geometry, tap to smile) */}
      <div className="rounded-2xl bg-[var(--surf)]/60 border border-[var(--bd)]/75 py-7 px-4 flex flex-col items-center justify-center gap-5">
        <button
          type="button"
          onClick={triggerPlayfulSmile}
          aria-label={isTr ? 'Gözleri gülümset' : 'Tap eyes to smile'}
          className="h-[62px] px-4 flex items-center justify-center cursor-pointer focus-visible:outline-none"
        >
          <motion.div
            animate={prefersReducedMotion ? undefined : { x: gaze.x, y: gaze.y }}
            transition={LIQUID_SPRING}
            className="flex items-center justify-center gap-6 will-change-transform"
          >
            {[0, 1].map((idx) => (
              <motion.div
                key={idx}
                animate={{
                  width: dims.width,
                  height: dims.height,
                  borderRadius: dims.borderRadius,
                  scaleY: isBlinking ? 0.06 : 1,
                  scaleX: isBlinking
                    ? 1.08
                    : idx === 0
                      ? 1 + gaze.x * 0.006
                      : 1 - gaze.x * 0.006,
                }}
                transition={LIQUID_SPRING}
                className="relative bg-[var(--tx)] overflow-hidden ring-1 ring-inset ring-[var(--bg)]/12 will-change-transform"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.11] via-transparent to-black/[0.14]"
                />
                {/* Pure Crescent Smile Mask on Tap */}
                <motion.div
                  initial={false}
                  animate={{ y: isSmiling ? '52%' : '106%' }}
                  transition={LIQUID_SPRING}
                  className="pointer-events-none absolute -left-2 -right-2 bottom-0 h-[82%] rounded-t-[100%] bg-[var(--surf)]"
                />
              </motion.div>
            ))}
          </motion.div>
        </button>

        {/* Interactive Shape Selector */}
        <div
          role="tablist"
          aria-label={isTr ? 'Göz şekli seç' : 'Choose eye shape'}
          className="inline-flex items-center p-1 rounded-full bg-[var(--card)] border border-[var(--bd)]/80"
        >
          {options.map((opt) => {
            const active = shape === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setShape(opt.id)}
                className={`relative px-3.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'text-[var(--on)]' : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="landing-mini-eye-shape"
                    transition={LIQUID_MORPH}
                    className="absolute inset-0 rounded-full bg-[var(--ac)]"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.article>
  );
}

const MODEL_QUALITATIVE_PROFILES: Record<
  ChatModelId,
  { speed: number; depth: number; creativity: number }
> = {
  'longclaw-ultracode-1': { speed: 84, depth: 99, creativity: 99 },
  'longclaw-clawing-1.2-ultra': { speed: 64, depth: 98, creativity: 96 },
  'longclaw-clawing-1.2-pro': { speed: 84, depth: 88, creativity: 90 },
  'longclaw-clawing-1.1-ultra': { speed: 68, depth: 92, creativity: 86 },
  'longclaw-clawing-1.1-pro': { speed: 82, depth: 80, creativity: 82 },
  'longclaw-clawing-1-pro': { speed: 80, depth: 74, creativity: 78 },
  'longclaw-clawing-1.1-low': { speed: 97, depth: 62, creativity: 74 },
  'longclaw-clawing-1.1': { speed: 90, depth: 70, creativity: 80 },
};

/**
 * Architectural 2-Column Model Family Ledger & Interactive Dossier
 * Displays spring-animated qualitative capability profiles in clean Plus Jakarta Sans.
 */
export function ModelFamilyLedger({
  models,
  lang,
  onStartWorkspace,
  onOpenBenchmarks,
  compareLabel,
}: {
  models: ReadonlyArray<{
    id: ChatModelId;
    name: string;
    tagline: string;
    description: string;
  }>;
  lang: Language;
  onStartWorkspace: () => void;
  onOpenBenchmarks: () => void;
  compareLabel: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const dossierRef = useRef<HTMLDivElement | null>(null);
  const active = models[selectedIdx] || models[0];
  const isTr = lang === 'tr';

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = dossierRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const activeProfile = active
    ? MODEL_QUALITATIVE_PROFILES[active.id] || { speed: 80, depth: 80, creativity: 80 }
    : { speed: 80, depth: 80, creativity: 80 };

  const isUltraCode = active?.id === 'longclaw-ultracode-1';
  const profileAxes = [
    { label: isTr ? 'Yanıt hızı' : 'Response speed', value: activeProfile.speed },
    {
      label: isUltraCode
        ? isTr
          ? 'Kod doğruluğu ve mimari'
          : 'Code accuracy & architecture'
        : isTr
          ? 'Akıl yürütme derinliği'
          : 'Reasoning depth',
      value: activeProfile.depth,
    },
    {
      label: isUltraCode
        ? isTr
          ? 'Hata ayıklama ve optimizasyon'
          : 'Debugging & optimization'
        : isTr
          ? 'Üretim ve yazım dengesi'
          : 'Writing & synthesis',
      value: activeProfile.creativity,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
      {/* Left: Hairline-divided Interactive Ledger */}
      <div className="lg:col-span-5 flex flex-col divide-y divide-[var(--bd)]/80 border-y border-[var(--bd)]/80">
        {models.map((m, idx) => {
          const isSelected = idx === selectedIdx;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              aria-pressed={isSelected}
              className={`relative py-4 px-3.5 -mx-3.5 rounded-2xl text-left flex items-center justify-between gap-4 transition-colors cursor-pointer group ${
                isSelected ? 'text-[var(--tx)]' : 'text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--card)]/55'
              }`}
            >
              {isSelected && (
                <motion.span
                  layoutId="landing-model-ledger-active"
                  transition={LIQUID_MORPH}
                  className="absolute inset-0 rounded-2xl bg-[var(--card)] border border-[var(--bd)]"
                  aria-hidden="true"
                />
              )}
              <div className="relative z-10 flex items-center gap-3.5 min-w-0">
                <span
                  className={`text-xs font-mono font-medium tabular-nums w-5 shrink-0 transition-colors ${
                    isSelected ? 'text-[var(--editorial-accent)]' : 'text-[var(--mut)]'
                  }`}
                >
                  0{idx + 1}
                </span>
                <div className="w-9 h-9 rounded-xl bg-[var(--surf)] border border-[var(--bd)]/80 flex items-center justify-center shrink-0">
                  <ModelLogo modelId={m.id} className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm sm:text-[15px] font-semibold tracking-tight text-[var(--tx)] truncate">
                    {m.name}
                  </p>
                  <p className="text-xs text-[var(--mut)] truncate">{m.tagline}</p>
                </div>
              </div>
              <ArrowRight
                className={`relative z-10 w-3.5 h-3.5 shrink-0 transition-all duration-200 ${
                  isSelected
                    ? 'opacity-100 translate-x-0 text-[var(--editorial-accent)]'
                    : 'opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Right: Spacious Model Specification Dossier */}
      <div
        ref={dossierRef}
        onPointerMove={handlePointerMove}
        className="spotlight-card lg:col-span-7 relative rounded-[24px] bg-[var(--card)] border border-[var(--bd)] p-7 sm:p-10 flex flex-col justify-between gap-8 overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {active && (
            <motion.div
              key={active.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: EDITORIAL_EASE }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surf)] border border-[var(--bd)] flex items-center justify-center shrink-0">
                  <ModelLogo modelId={active.id} className="w-7 h-7" />
                </div>
                <span className="text-xs font-semibold tabular-nums text-[var(--mut)]">
                  0{selectedIdx + 1} / 0{models.length}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--mut)]">
                  <span>{active.tagline}</span>
                  <span className="mx-2 text-[var(--bd)]" aria-hidden="true">
                    ·
                  </span>
                  <span>
                    {isUltraCode
                      ? isTr
                        ? 'Kodlamaya özel mimari'
                        : 'Dedicated coding engine'
                      : isTr
                        ? 'Otomatik efor yönlendirme'
                        : 'Adaptive effort routing'}
                  </span>
                </p>
                <h3 className="font-display text-2xl sm:text-[2rem] font-medium tracking-[-0.025em] text-[var(--tx)] text-balance">
                  {active.name}
                </h3>
              </div>

              <p className="text-[15.5px] sm:text-base text-[var(--mut)] leading-[1.78] max-w-xl">
                {active.description}
              </p>

              {/* Calm Qualitative Profile Bars */}
              <div className="pt-2 space-y-3.5 max-w-lg">
                {profileAxes.map((axis) => (
                  <div key={axis.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--tx)]/85">{axis.label}</span>
                      <span className="font-mono text-[11px] tabular-nums text-[var(--mut)]">
                        {axis.value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--surf)] overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{ width: `${axis.value}%` }}
                        transition={LIQUID_SPRING}
                        className="h-full rounded-full bg-[var(--editorial-accent)]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-6 border-t border-[var(--bd)]/75 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onStartWorkspace}
            className="group inline-flex items-center gap-2 text-sm font-semibold text-[var(--tx)] hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap"
          >
            <span>{isTr ? 'Çalışma alanında dene' : 'Try in workspace'}</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={onOpenBenchmarks}
            className="group inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>{compareLabel}</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function renderSlashHighlight(text: string) {
  const match = text.match(/^(\/[a-zA-ZçğıöşüÇĞİÖŞÜ0-9_-]+)(.*)$/);
  if (!match) return <>“{text}”</>;
  return (
    <>
      “
      <span className="font-mono text-[14px] font-semibold text-[var(--editorial-accent)] mr-1">
        {match[1]}
      </span>
      <span>{match[2]}”</span>
    </>
  );
}

/**
 * Interactive Day-in-the-Life Editorial Chapters
 * Compact horizontal chapter rail + calm full-focus conversation stage in Plus Jakarta Sans.
 */
export function InteractiveDayChapters({
  items,
  lang,
}: {
  items: ReadonlyArray<{
    time: string;
    title: string;
    prompt: string;
    answer: string;
  }>;
  lang: Language;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const current = items[activeIdx] || items[0];
  const isTr = lang === 'tr';

  if (!current) return null;

  const stepPrev = () => setActiveIdx((prev) => (prev - 1 + items.length) % items.length);
  const stepNext = () => setActiveIdx((prev) => (prev + 1) % items.length);

  return (
    <div className="space-y-7">
      {/* Time-of-Day Chapter Scrubber */}
      <div
        role="tablist"
        aria-label={isTr ? 'Günlük akış adımları' : 'Daily workflow moments'}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {items.map((item, idx) => {
          const isActive = idx === activeIdx;
          return (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveIdx(idx)}
              className={`relative rounded-2xl p-4 text-left border transition-colors cursor-pointer ${
                isActive
                  ? 'border-[var(--tx)]/25 text-[var(--tx)]'
                  : 'border-[var(--bd)]/80 bg-[var(--card)]/45 hover:bg-[var(--card)]/85 text-[var(--mut)] hover:text-[var(--tx)]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="landing-day-chapter-active"
                  transition={LIQUID_MORPH}
                  className="absolute inset-0 rounded-2xl bg-[var(--card)] border border-[var(--tx)]/22"
                  aria-hidden="true"
                />
              )}
              <div className="relative z-10 space-y-1">
                <span className="block text-xs font-mono tabular-nums text-[var(--editorial-accent)] font-medium">
                  {item.time}
                </span>
                <p className="text-sm font-semibold tracking-tight text-[var(--tx)] leading-snug line-clamp-1">
                  {item.title}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Focused Editorial Dialogue Stage */}
      <div className="rounded-[24px] bg-[var(--card)] border border-[var(--bd)] p-6 sm:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIdx}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start"
          >
            <div className="lg:col-span-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[var(--mut)] font-mono tabular-nums font-medium">
                <span className="text-[var(--editorial-accent)] font-semibold">{current.time}</span>
                <span aria-hidden="true">·</span>
                <span>
                  0{activeIdx + 1} / 0{items.length}
                </span>
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-medium tracking-[-0.02em] text-[var(--tx)] text-balance">
                {current.title}
              </h3>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-2xl bg-[var(--surf)]/75 border border-[var(--bd)]/75 px-5 py-4">
                <p className="text-[15px] sm:text-base font-medium text-[var(--tx)] leading-relaxed">
                  {renderSlashHighlight(current.prompt)}
                </p>
              </div>

              <div className="flex items-start gap-3.5 px-1">
                <div className="w-7 h-7 rounded-full bg-[var(--surf)] border border-[var(--bd)] flex items-center justify-center shrink-0 mt-0.5">
                  <LongclawLogo className="w-4 h-4 text-[var(--tx)]" />
                </div>
                <p className="text-[15px] text-[var(--mut)] leading-[1.78] whitespace-pre-line">
                  {current.answer}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Quiet Step Controls */}
        <div className="mt-8 pt-5 border-t border-[var(--bd)]/75 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === activeIdx ? 'w-7 bg-[var(--ac)]' : 'w-2 bg-[var(--bd)]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={stepPrev}
              aria-label={isTr ? 'Önceki adım' : 'Previous moment'}
              className="w-9 h-9 rounded-full border border-[var(--bd)] bg-[var(--bg)] hover:bg-[var(--surf)] text-[var(--tx)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={stepNext}
              aria-label={isTr ? 'Sonraki adım' : 'Next moment'}
              className="w-9 h-9 rounded-full border border-[var(--bd)] bg-[var(--bg)] hover:bg-[var(--surf)] text-[var(--tx)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Photo-Free Architectural Horizon Closing Band
 * Scroll-driven concentric astrolabe rings and serene contour horizon matching Light & Dark themes.
 */
export function HorizonClosingBand({
  title,
  subtitle,
  ctaLabel,
  theme,
  onStart,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  theme: 'light' | 'dark';
  onStart: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const isCoarsePointer = useIsCoarsePointer();
  const disableScrollMotion = Boolean(prefersReducedMotion) || isCoarsePointer;
  const bandRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: bandRef,
    offset: ['start end', 'end start'],
  });
  const rawRot = useTransform(scrollYProgress, [0, 1], disableScrollMotion ? [0, 0] : [-18, 22]);
  const smoothRot = useSpring(rawRot, LIQUID_SCROLL_SPRING);
  const rawCounterRot = useTransform(
    scrollYProgress,
    [0, 1],
    disableScrollMotion ? [0, 0] : [16, -20]
  );
  const smoothCounterRot = useSpring(rawCounterRot, LIQUID_SCROLL_SPRING);
  const isDark = theme === 'dark';

  return (
    <motion.div
      ref={bandRef}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={EDITORIAL_VIEWPORT}
      transition={{ duration: 0.56, ease: EDITORIAL_EASE }}
      className="relative mt-20 rounded-[28px] border border-[var(--bd)] bg-[var(--card)] overflow-hidden"
    >
      {/* Tonal Atmospheric Horizon Wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(75% 85% at 50% 0%, rgba(255, 255, 255, 0.08) 0%, rgba(0, 0, 0, 0) 74%)'
            : 'radial-gradient(75% 85% at 50% 0%, rgba(0, 0, 0, 0.05) 0%, rgba(255, 255, 255, 0) 74%)',
        }}
      />

      {/* Subtle Architectural Dot Field */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.22] dark:opacity-[0.14]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, var(--bd) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Scroll-Driven Geometric Astrolabe & Contour Horizon */}
      <svg
        viewBox="0 0 900 320"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <motion.g style={{ transformOrigin: '450px 160px', rotate: smoothRot }}>
          <circle
            cx="450"
            cy="160"
            r="118"
            fill="none"
            stroke="var(--tx)"
            strokeOpacity={isDark ? 0.16 : 0.13}
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          <circle
            cx="450"
            cy="160"
            r="210"
            fill="none"
            stroke="var(--tx)"
            strokeOpacity={isDark ? 0.09 : 0.08}
            strokeWidth="0.9"
          />
        </motion.g>

        <motion.g style={{ transformOrigin: '450px 160px', rotate: smoothCounterRot }}>
          <circle
            cx="450"
            cy="160"
            r="164"
            fill="none"
            stroke="var(--ac)"
            strokeOpacity={isDark ? 0.24 : 0.18}
            strokeWidth="1.1"
            strokeDasharray="10 12"
          />
        </motion.g>

        {/* Quiet Horizon Contour Sweep */}
        <path
          d="M-20 264 C 210 218, 360 286, 560 242 C 710 208, 810 256, 920 226"
          fill="none"
          stroke="var(--bd)"
          strokeWidth="1.1"
        />
        <path
          d="M-20 286 C 240 246, 410 302, 620 264 C 760 238, 830 274, 920 250"
          fill="none"
          stroke="var(--ac)"
          strokeOpacity={isDark ? 0.18 : 0.14}
          strokeWidth="1"
          strokeDasharray="3 7"
        />
      </svg>

      <div className="relative z-10 px-6 sm:px-12 py-16 sm:py-22 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center mb-5">
          <LongclawLogo className="w-9 h-9 text-[var(--tx)]" />
        </div>
        <h3 className="font-display text-2xl sm:text-4xl font-medium tracking-[-0.025em] text-[var(--tx)] text-balance">
          {title}
        </h3>
        <p className="mt-3.5 text-[15px] sm:text-base text-[var(--mut)] leading-relaxed max-w-lg mx-auto">
          {subtitle}
        </p>
        <div className="mt-8 flex justify-center">
          <motion.button
            type="button"
            onClick={onStart}
            whileHover={prefersReducedMotion ? undefined : { y: -1.5, scale: 1.01 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            transition={LIQUID_TAP}
            className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[var(--ac)] text-[var(--on)] hover:opacity-92 font-medium text-sm cursor-pointer whitespace-nowrap"
          >
            <span>{ctaLabel}</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
