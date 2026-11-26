import React, { useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { LongclawLogo, ModelLogo } from './Icons';
import type { ChatModelId } from '../lib/models';
import {
  EDITORIAL_EASE,
  EDITORIAL_VIEWPORT,
  LIQUID_EASE,
  LIQUID_SCROLL_SPRING,
  LIQUID_SPRING,
  LIQUID_TAP,
} from '../lib/motion';

/**
 * EditorialPhoto with graceful fallback (shared inside landing motion frames)
 */
export function EditorialPhoto({
  src,
  alt,
  className = '',
  fallbackLabel,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[var(--surf)] text-[var(--mut)] ${className}`}
        role="img"
        aria-label={alt}
      >
        <LongclawLogo className="w-[34px] h-[34px] opacity-65 mb-2" />
        {fallbackLabel && (
          <span className="text-xs opacity-75 px-4 text-center">{fallbackLabel}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

/**
 * Masked Editorial Line Reveal — glides text cleanly up from an invisible baseline (zero blur)
 */
export function MaskedReveal({
  children,
  delay = 0,
  className = '',
  inView = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  inView?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <span className={`block ${className}`}>{children}</span>;
  }

  return (
    <span className={`block overflow-hidden py-[0.04em] -my-[0.04em] ${className}`}>
      <motion.span
        className="block will-change-transform"
        initial={{ y: '104%', opacity: 0.01 }}
        animate={inView ? undefined : { y: '0%', opacity: 1 }}
        whileInView={inView ? { y: '0%', opacity: 1 } : undefined}
        viewport={inView ? EDITORIAL_VIEWPORT : undefined}
        transition={{ duration: 0.62, delay, ease: EDITORIAL_EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/**
 * Scroll-Linked Parallax Editorial Showcase Card with pointer-tracked subtle sheen
 */
export function ParallaxShowcaseCard({
  src,
  alt,
  kicker,
  title,
  desc,
  delay = 0,
}: {
  src: string;
  alt: string;
  kicker: string;
  title: string;
  desc: string;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'end start'],
  });
  const rawImageY = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? [0, 0] : [-18, 18]
  );
  const imageY = useSpring(rawImageY, LIQUID_SCROLL_SPRING);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <motion.article
      ref={cardRef}
      onPointerMove={handlePointerMove}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={EDITORIAL_VIEWPORT}
      transition={{ duration: 0.56, delay, ease: EDITORIAL_EASE }}
      className="spotlight-card group relative rounded-3xl bg-[var(--card)] border border-[var(--bd)] overflow-hidden flex flex-col transition-colors duration-300 hover:border-[var(--tx)]/22 shadow-[0_14px_38px_-28px_rgba(24,23,21,0.16)] dark:shadow-[0_18px_46px_-26px_rgba(0,0,0,0.62)]"
    >
      <div className="relative aspect-[16/10] bg-[var(--surf)] overflow-hidden">
        <motion.div
          style={{ y: imageY }}
          className="w-full h-[116%] -mt-[8%] will-change-transform"
        >
          <EditorialPhoto
            src={src}
            alt={alt}
            fallbackLabel={title}
            className="smooth-photo w-full h-full object-cover"
          />
        </motion.div>
        {/* Crisp top architectural edge highlight */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--bd)]/75"
          aria-hidden="true"
        />
      </div>

      <div className="relative p-6 sm:p-8 space-y-2.5">
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={EDITORIAL_VIEWPORT}
          transition={{ duration: 0.4, delay: delay + 0.08, ease: EDITORIAL_EASE }}
          className="text-xs font-medium text-[var(--mut)]"
        >
          {kicker}
        </motion.p>
        <motion.h3
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={EDITORIAL_VIEWPORT}
          transition={{ duration: 0.46, delay: delay + 0.13, ease: EDITORIAL_EASE }}
          className="font-soft text-xl sm:text-2xl font-semibold tracking-tight text-[var(--tx)] text-balance"
        >
          {title}
        </motion.h3>
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={EDITORIAL_VIEWPORT}
          transition={{ duration: 0.46, delay: delay + 0.18, ease: EDITORIAL_EASE }}
          className="text-[15px] text-[var(--mut)] leading-[1.7]"
        >
          {desc}
        </motion.p>
      </div>
    </motion.article>
  );
}

/**
 * Spotlight Model Card with cursor-tracked radial light & tactile logo lift
 */
export function SpotlightModelCard({
  modelId,
  name,
  tagline,
  description,
  index,
}: {
  modelId: ChatModelId;
  name: string;
  tagline: string;
  description: string;
  index: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.975 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={prefersReducedMotion ? undefined : { y: -3 }}
      viewport={EDITORIAL_VIEWPORT}
      transition={{
        opacity: { duration: 0.42, delay: index * 0.055, ease: EDITORIAL_EASE },
        y: { duration: 0.46, delay: index * 0.055, ease: EDITORIAL_EASE },
        scale: { duration: 0.46, delay: index * 0.055, ease: EDITORIAL_EASE },
      }}
      className="spotlight-card group relative rounded-2xl bg-[var(--card)] border border-[var(--bd)] hover:border-[var(--tx)]/24 p-5 sm:p-6 space-y-2.5 overflow-hidden transition-colors duration-200 shadow-[0_10px_28px_-22px_rgba(24,23,21,0.16)] dark:shadow-[0_14px_34px_-22px_rgba(0,0,0,0.6)]"
    >
      {/* Crisp top hairline accent sweep on hover */}
      <span
        className="pointer-events-none absolute inset-x-5 top-0 h-[1.5px] bg-[var(--ac)]/55 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--surf)]/85 border border-[var(--bd)]/80 flex items-center justify-center shrink-0 transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-6">
          <ModelLogo modelId={modelId} className="w-5 h-5 shrink-0" />
        </div>
        <div className="min-w-0">
          <h3 className="font-soft text-[15.5px] font-semibold text-[var(--tx)] truncate">
            {name}
          </h3>
          <p className="text-xs text-[var(--mut)] truncate">{tagline}</p>
        </div>
      </div>

      <p className="relative z-10 text-sm text-[var(--mut)] leading-[1.68] pt-0.5">
        {description}
      </p>
    </motion.div>
  );
}

/**
 * Format slash commands like /gmail, /takvim, /calendar cleanly inside timeline prompts
 */
function renderSlashHighlight(text: string) {
  const match = text.match(/^(\/[a-zA-ZçğıöşüÇĞİÖŞÜ0-9_-]+)(.*)$/);
  if (!match) return <>“{text}”</>;
  return (
    <>
      “
      <span className="font-mono text-[13.5px] font-semibold text-[var(--ac)] mr-1">
        {match[1]}
      </span>
      <span>{match[2]}”</span>
    </>
  );
}

/**
 * Scroll-Driven Architectural Timeline Section
 */
export function ScrollTimeline({
  items,
}: {
  items: ReadonlyArray<{
    time: string;
    title: string;
    prompt: string;
    answer: string;
  }>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ['start 76%', 'end 64%'],
  });
  const spineScaleY = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 32,
    mass: 0.45,
  });

  return (
    <div ref={listRef} className="relative">
      {/* Scroll-drawn architectural vertical rail on md+ */}
      <div
        className="hidden md:block absolute left-[11px] top-10 bottom-10 w-px bg-[var(--bd)]/80"
        aria-hidden="true"
      >
        {!prefersReducedMotion && (
          <motion.div
            style={{ scaleY: spineScaleY }}
            className="w-full h-full bg-[var(--ac)] origin-top will-change-transform"
          />
        )}
      </div>

      <div className="divide-y divide-[var(--bd)]/85 border-y border-[var(--bd)]/85">
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={EDITORIAL_VIEWPORT}
            transition={{
              duration: 0.5,
              delay: Math.min(idx * 0.055, 0.22),
              ease: EDITORIAL_EASE,
            }}
            className="group relative py-8 sm:py-10 md:pl-10 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start transition-colors"
          >
            {/* Timeline milestone node aligned to the scroll spine */}
            <motion.span
              initial={prefersReducedMotion ? false : { scale: 0.4, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={EDITORIAL_VIEWPORT}
              transition={{ duration: 0.36, delay: 0.08, ease: EDITORIAL_EASE }}
              className="hidden md:flex items-center justify-center absolute left-[4px] top-[44px] w-[15px] h-[15px] rounded-full bg-[var(--card)] border border-[var(--bd)] group-hover:border-[var(--ac)] transition-colors duration-200"
              aria-hidden="true"
            >
              <span className="w-[5px] h-[5px] rounded-full bg-[var(--tx)]/45 group-hover:bg-[var(--ac)] group-hover:scale-125 transition-all duration-200" />
            </motion.span>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={EDITORIAL_VIEWPORT}
              transition={{ duration: 0.46, delay: 0.05, ease: EDITORIAL_EASE }}
              className="md:col-span-4 space-y-1.5"
            >
              <span className="block font-mono text-xs tabular-nums text-[var(--ac)]/85 font-medium">
                {item.time}
              </span>
              <h3 className="font-soft text-lg font-semibold text-[var(--tx)] tracking-tight">
                {item.title}
              </h3>
            </motion.div>

            <div className="md:col-span-8 rounded-2xl border border-transparent group-hover:border-[var(--bd)]/80 group-hover:bg-[var(--card)]/75 px-0 md:px-5 py-0 md:py-4 md:-my-4 transition-all duration-250 space-y-2.5">
              <p className="text-[15px] font-medium text-[var(--tx)] leading-snug">
                {renderSlashHighlight(item.prompt)}
              </p>
              <p className="text-[14.5px] sm:text-[15px] text-[var(--mut)] leading-[1.75] whitespace-pre-line">
                {item.answer}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/**
 * Self-Drawing SVG Checkmark Capability Item
 */
export function AnimatedCheckItem({
  label,
  index,
}: {
  label: string;
  index: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.li
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={prefersReducedMotion ? undefined : { x: 3 }}
      viewport={EDITORIAL_VIEWPORT}
      transition={{
        opacity: { duration: 0.36, delay: index * 0.035, ease: EDITORIAL_EASE },
        y: { duration: 0.4, delay: index * 0.035, ease: EDITORIAL_EASE },
        x: LIQUID_SPRING,
      }}
      className="group flex items-start gap-3 py-1 text-[15px] text-[var(--tx)]/88 leading-relaxed"
    >
      <span
        className="w-5 h-5 rounded-full border border-[var(--bd)] bg-[var(--surf)]/75 group-hover:border-[var(--ac)]/55 flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-200"
        aria-hidden="true"
      >
        <svg className="w-3 h-3 text-[var(--ac)]" viewBox="0 0 14 14" fill="none">
          <motion.path
            d="M3 7.4L5.8 10.2L11.2 4.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={EDITORIAL_VIEWPORT}
            transition={{
              duration: 0.42,
              delay: index * 0.04 + 0.08,
              ease: LIQUID_EASE,
            }}
          />
        </svg>
      </span>
      <span className="group-hover:text-[var(--tx)] transition-colors duration-200">
        {label}
      </span>
    </motion.li>
  );
}

/**
 * Quiet Closing CTA with scroll-linked geometric interlocking rings backdrop (zero blur)
 */
export function ScrollMotifClosingCta({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start end', 'end start'],
  });
  const rawRotate = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? [0, 0] : [-18, 22]
  );
  const smoothRotate = useSpring(rawRotate, LIQUID_SCROLL_SPRING);
  const rawCounterRotate = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? [0, 0] : [16, -20]
  );
  const smoothCounterRotate = useSpring(rawCounterRotate, LIQUID_SCROLL_SPRING);

  return (
    <motion.div
      ref={stageRef}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={EDITORIAL_VIEWPORT}
      transition={{ duration: 0.52, ease: EDITORIAL_EASE }}
      className="relative mt-16 py-12 px-6 rounded-[28px] border border-[var(--bd)]/80 bg-[var(--card)]/75 overflow-hidden text-center"
    >
      {/* Subtle architectural concentric ring geometry driven by scroll */}
      <svg
        viewBox="0 0 600 180"
        className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.14] dark:opacity-[0.18]"
        aria-hidden="true"
      >
        <motion.g
          style={{
            transformOrigin: '260px 90px',
            rotate: smoothRotate,
          }}
        >
          <circle
            cx="260"
            cy="90"
            r="68"
            fill="none"
            stroke="var(--tx)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle cx="260" cy="90" r="102" fill="none" stroke="var(--tx)" strokeWidth="0.75" />
        </motion.g>
        <motion.g
          style={{
            transformOrigin: '340px 90px',
            rotate: smoothCounterRotate,
          }}
        >
          <circle
            cx="340"
            cy="90"
            r="68"
            fill="none"
            stroke="var(--ac)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle cx="340" cy="90" r="102" fill="none" stroke="var(--tx)" strokeWidth="0.75" />
        </motion.g>
      </svg>

      <div className="relative z-10 flex justify-center">
        <motion.button
          type="button"
          onClick={onClick}
          whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.015 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.975 }}
          transition={LIQUID_TAP}
          className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[var(--ac)] text-[var(--on)] hover:opacity-95 font-medium text-sm shadow-[0_14px_34px_-12px_rgba(24,23,21,0.34)] cursor-pointer whitespace-nowrap"
        >
          <span>{label}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
        </motion.button>
      </div>
    </motion.div>
  );
}
