import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Calendar,
  Code2,
  Mail,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { LongclawLogo } from './Icons';
import { Language } from '../lib/i18n';
import { EDITORIAL_EASE, LIQUID_EASE, LIQUID_MORPH, LIQUID_SPRING, LIQUID_TAP } from '../lib/motion';

interface DemoConversation {
  q: string;
  a: string;
}

interface HeroChatShowcaseProps {
  conversations: DemoConversation[];
  badgeLabel: string;
  lang: Language;
  onTryLongclaw: () => void;
  className?: string;
}

type Stage = 'composing' | 'launching' | 'thinking' | 'streaming' | 'done';

/**
 * Miniature interactive stopwatch embedded inside Demo #2
 * so landing-page visitors can literally test live preview in place.
 */
function MiniLiveTimer({ lang }: { lang: Language }) {
  const prefersReducedMotion = useReducedMotion();
  const [running, setRunning] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(14200);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsedMs((prev) => prev + 100);
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  const totalSec = Math.floor(elapsedMs / 1000);
  const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  const tenths = Math.floor((elapsedMs % 1000) / 100);

  return (
    <div className="mt-3.5 rounded-2xl border border-[var(--bd)] bg-[#141413] text-[#F5F4F0] px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/60 tracking-tight shrink-0">
          <Code2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{lang === 'tr' ? 'Önizleme' : 'Preview'}</span>
        </span>
        <span className="text-lg sm:text-xl font-semibold tracking-tight tabular-nums text-white">
          {mins}:{secs}
          <span className="text-white/45">.{tenths}</span>
        </span>

        {/* Crisp live cadence bars when running */}
        <span className="hidden sm:inline-flex items-end gap-[2.5px] h-3.5 ml-1" aria-hidden="true">
          {[0.45, 0.9, 0.65, 1].map((mult, idx) => (
            <motion.span
              key={idx}
              animate={
                running && !prefersReducedMotion
                  ? { scaleY: [0.28, mult, 0.35] }
                  : { scaleY: 0.28 }
              }
              transition={
                running
                  ? {
                      repeat: Infinity,
                      duration: 0.72 + idx * 0.12,
                      ease: 'easeInOut',
                    }
                  : { duration: 0.2 }
              }
              className="w-[2px] h-full rounded-full bg-emerald-400/75 origin-bottom"
            />
          ))}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#141413] text-[11px] font-medium hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
          <span>
            {running
              ? lang === 'tr'
                ? 'Duraklat'
                : 'Pause'
              : lang === 'tr'
                ? 'Başlat'
                : 'Start'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setElapsedMs(0);
          }}
          aria-label={lang === 'tr' ? 'Sıfırla' : 'Reset'}
          className="w-7 h-7 rounded-full border border-white/15 text-white/75 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Self-drawing crisp check icon for Hero Chat artifacts
 */
function AnimatedMiniTick({ delay = 0 }: { delay?: number }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <motion.path
        d="M2.6 7.4L5.6 10.4L11.4 3.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.34, delay, ease: LIQUID_EASE }}
      />
    </svg>
  );
}

export function HeroChatShowcase({
  conversations,
  badgeLabel,
  lang,
  onTryLongclaw,
  className = 'mt-12 sm:mt-16 max-w-2xl mx-auto',
}: HeroChatShowcaseProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(containerRef, { amount: 0.12 });
  const safeCount = Math.max(1, conversations.length);

  const [activeIdx, setActiveIdx] = useState(0);
  const [stage, setStage] = useState<Stage>(prefersReducedMotion ? 'done' : 'composing');
  const [composerText, setComposerText] = useState('');
  const [sendRipple, setSendRipple] = useState(false);
  const [sentQuestion, setSentQuestion] = useState('');
  const [visibleWords, setVisibleWords] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const isPausedRef = useRef(isPaused || !isInView);
  isPausedRef.current = isPaused || !isInView;

  const currentIdx = activeIdx % safeCount;
  const currentConv = conversations[currentIdx] || { q: '', a: '' };

  const scenarios =
    lang === 'tr'
      ? [
          {
            label: 'E-posta',
            thinking: 'Son e-postalar özetleniyor…',
            route: 'Clawing 1.2 Pro',
            Icon: Mail,
          },
          {
            label: 'Canlı kod',
            thinking: 'Canlı önizleme oluşturuluyor…',
            route: 'Clawing 1.2 Pro',
            Icon: Code2,
          },
          {
            label: '/takvim',
            thinking: 'Takvim kaydı ekleniyor…',
            route: 'Clawing 1.1 Low',
            Icon: Calendar,
          },
        ]
      : [
          {
            label: 'Inbox',
            thinking: 'Summarizing recent threads…',
            route: 'Clawing 1.2 Pro',
            Icon: Mail,
          },
          {
            label: 'Live code',
            thinking: 'Building interactive preview…',
            route: 'Clawing 1.2 Pro',
            Icon: Code2,
          },
          {
            label: '/calendar',
            thinking: 'Scheduling on Calendar…',
            route: 'Clawing 1.1 Low',
            Icon: Calendar,
          },
        ];

  const activeMeta = scenarios[currentIdx % scenarios.length];

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const answerTokens = currentConv.a.split(/\s+/).filter(Boolean);

    if (prefersReducedMotion) {
      setComposerText('');
      setSendRipple(false);
      setSentQuestion(currentConv.q);
      setVisibleWords(answerTokens);
      setStage('done');
      return;
    }

    if (!isInView) {
      return;
    }

    const runSequence = async () => {
      // Reset smoothly for the selected scenario
      setStage('composing');
      setComposerText('');
      setSendRipple(false);
      setSentQuestion('');
      setVisibleWords([]);

      // Stage 1: Brisk, organic phrase typing inside the composer
      await sleep(160);
      if (cancelled) return;

      const promptWords = currentConv.q.split(/(\s+)/);
      let draft = '';
      for (let i = 0; i < promptWords.length; i++) {
        if (cancelled) return;
        draft += promptWords[i];
        setComposerText(draft);
        if (promptWords[i].trim()) {
          await sleep(78);
        }
      }

      // Stage 2: Tactile send pulse & smooth message launch into feed
      await sleep(180);
      if (cancelled) return;
      setStage('launching');
      setSendRipple(true);
      await sleep(180);
      if (cancelled) return;

      setSendRipple(false);
      setComposerText('');
      setSentQuestion(currentConv.q);
      setStage('thinking');

      // Stage 3: Calm architectural thinking sweep
      await sleep(780);
      if (cancelled) return;

      // Stage 4: Fluid phrase-by-phrase fade-glide stream (zero choppy character jitter)
      setStage('streaming');
      for (let i = 0; i < answerTokens.length; i++) {
        if (cancelled) return;
        const word = answerTokens[i];
        setVisibleWords((prev) => [...prev, word]);
        const endsSentence = /[.!?…]$/.test(word);
        const endsPause = /[,;:—–]$/.test(word);
        await sleep(endsSentence ? 95 : endsPause ? 64 : 42);
      }

      if (cancelled) return;
      setStage('done');

      // Stage 5: Calm dwell (pauses automatically while hovered)
      let waited = 0;
      const targetDwell = 4800;
      while (waited < targetDwell) {
        await sleep(200);
        if (cancelled) return;
        if (!isPausedRef.current) {
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
  }, [currentIdx, lang, prefersReducedMotion, isInView, currentConv.q, currentConv.a, safeCount]);

  // Format slash command prefix cleanly inside bubbles & composer
  const renderPromptText = (text: string) => {
    const match = text.match(/^(\/[a-zA-ZçğıöşüÇĞİÖŞÜ0-9_-]+)(.*)$/);
    if (!match) return text;
    return (
      <>
        <span className="inline-flex items-center px-1.5 py-0.5 mr-1 rounded-md bg-[var(--editorial-accent-soft)] text-[var(--editorial-accent)] font-mono text-[12.5px] font-semibold align-baseline">
          {match[1]}
        </span>
        <span>{match[2]}</span>
      </>
    );
  };

  return (
    <motion.div
      ref={containerRef}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.18, ease: EDITORIAL_EASE }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`${className} text-left rounded-[26px] bg-[var(--card)] border border-[var(--bd)] shadow-[0_18px_44px_-28px_rgba(23,22,20,0.16)] dark:shadow-[0_24px_56px_-28px_rgba(0,0,0,0.65)] overflow-hidden`}
    >
      {/* Top Window Chrome: Brand Identity + Interactive Scenario Switcher */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-[var(--bd)]/80 bg-[var(--surf)]/45 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <LongclawLogo className="w-[19px] h-[19px] text-[var(--tx)] shrink-0" />
          <span className="truncate text-xs sm:text-[13px] font-semibold tracking-tight text-[var(--tx)]">
            {badgeLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-full bg-[var(--surf)]/90 border border-[var(--bd)]/70 shrink-0">
          {conversations.map((_, idx) => {
            const meta = scenarios[idx % scenarios.length];
            const Icon = meta.Icon;
            const active = currentIdx === idx;
            return (
                <button
                  key={idx}
                  type="button"
                  title={meta.label}
                  aria-label={meta.label}
                  onClick={() => setActiveIdx(idx)}
                  className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'text-[var(--on)]'
                      : 'text-[var(--mut)] hover:text-[var(--tx)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="hero-chat-scenario-pill"
                      transition={LIQUID_MORPH}
                      className="absolute inset-0 rounded-full bg-[var(--ac)]"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="relative z-10 w-3.5 h-3.5 sm:w-3 sm:h-3 shrink-0" />
                  <span className="relative z-10 hidden sm:inline">{meta.label}</span>
                </button>
            );
          })}
        </div>
      </div>

      {/* Main Conversation Stage */}
      <div className="px-4 sm:px-6 pt-5 pb-4 min-h-[224px] sm:min-h-[236px] flex flex-col justify-between gap-4">
        <div className="space-y-4">
          {/* User Sent Message Bubble — tactile spring lift from bottom composer */}
          <div className="min-h-[44px] flex justify-end items-start">
            <AnimatePresence mode="wait">
              {sentQuestion && (
                <motion.div
                  key={`${lang}-q-${currentIdx}`}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 30, scale: 0.93 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10, scale: 0.97 }}
                  transition={LIQUID_SPRING}
                  className="inline-block max-w-[88%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-[var(--surf)] border border-[var(--bd)]/80 text-[14px] sm:text-[14.5px] font-medium text-[var(--tx)] leading-snug origin-bottom-right"
                >
                  {renderPromptText(sentQuestion)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Longclaw Assistant Reply Row */}
          <AnimatePresence mode="wait">
            {stage !== 'composing' && stage !== 'launching' && (
              <motion.div
                key={`${lang}-a-${currentIdx}`}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
                className="flex items-start gap-3"
              >
                {/* Avatar with Crisp Orbital Ring while Thinking */}
                <div className="relative w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-7 h-7 rounded-full bg-[var(--surf)] border border-[var(--bd)] flex items-center justify-center">
                    <LongclawLogo className="w-[16px] h-[16px] text-[var(--tx)]" />
                  </div>
                  <AnimatePresence>
                    {stage === 'thinking' && !prefersReducedMotion && (
                      <motion.svg
                        key="avatar-orbit"
                        viewBox="0 0 36 36"
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1, rotate: 360 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{
                          opacity: { duration: 0.2 },
                          scale: { duration: 0.25, ease: LIQUID_EASE },
                          rotate: { duration: 1.4, repeat: Infinity, ease: 'linear' },
                        }}
                        className="pointer-events-none absolute inset-0 w-full h-full"
                        aria-hidden="true"
                      >
                        <circle
                          cx="18"
                          cy="18"
                          r="16.5"
                          fill="none"
                          stroke="var(--editorial-accent)"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeDasharray="24 80"
                        />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1 min-w-0">
                  <AnimatePresence mode="wait">
                    {stage === 'thinking' ? (
                      <motion.div
                        key="thinking-state"
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: LIQUID_EASE }}
                        className="py-1 space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--mut)]">
                          <span className="font-medium text-[var(--tx)]/85">
                            {activeMeta.thinking}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{activeMeta.route}</span>
                        </div>
                        {/* Crisp Scanning Shimmer Lines (zero blur) */}
                        <div className="space-y-1.5 max-w-sm" aria-hidden="true">
                          {[0, 1].map((lineIdx) => (
                            <div
                              key={lineIdx}
                              className={`h-1.5 rounded-full bg-[var(--surf)] overflow-hidden ${
                                lineIdx === 0 ? 'w-full' : 'w-2/3'
                              }`}
                            >
                              <motion.div
                                animate={
                                  prefersReducedMotion
                                    ? undefined
                                    : { x: ['-100%', '220%'] }
                                }
                                transition={{
                                  duration: 1.15,
                                  repeat: Infinity,
                                  delay: lineIdx * 0.16,
                                  ease: 'easeInOut',
                                }}
                                className="h-full w-1/2 rounded-full bg-[var(--ac)]/35"
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="reply-state"
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {/* Smooth Word-Glide Stream */}
                        <p className="text-[14px] sm:text-[15px] leading-[1.7] text-[var(--tx)]/92">
                          {visibleWords.map((word, idx) => (
                            <motion.span
                              key={`${currentIdx}-${idx}`}
                              initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
                              className="inline-block mr-[0.28em]"
                            >
                              {word}
                            </motion.span>
                          ))}
                          {stage === 'streaming' && (
                            <span
                              className="inline-block w-[2px] h-[0.95em] rounded-full bg-[var(--ac)] align-[-0.14em] animate-[blink_0.85s_steps(1)_infinite]"
                              aria-hidden="true"
                            />
                          )}
                        </p>

                        {/* Contextual Micro-Artifact after reply finishes streaming */}
                        <AnimatePresence>
                          {stage === 'done' && (
                            <motion.div
                              key={`artifact-${currentIdx}`}
                              initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 4 }}
                              transition={LIQUID_SPRING}
                            >
                              {currentIdx === 0 && (
                                <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-[var(--mut)]">
                                  {(lang === 'tr'
                                    ? ['Perşembe 14:00', 'Bütçe onaylı', 'Metin onayı bekleniyor']
                                    : ['Thu 14:00 review', 'Budget approved', 'Copy sign-off']
                                  ).map((item, idx) => (
                                    <motion.span
                                      key={item}
                                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{
                                        duration: 0.28,
                                        delay: idx * 0.08,
                                        ease: EDITORIAL_EASE,
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surf)]/85 border border-[var(--bd)]/80 text-[var(--tx)]/88 font-medium"
                                    >
                                      <AnimatedMiniTick delay={idx * 0.08 + 0.06} />
                                      <span>{item}</span>
                                    </motion.span>
                                  ))}
                                </div>
                              )}

                              {currentIdx === 1 && <MiniLiveTimer lang={lang} />}

                              {currentIdx === 2 && (
                                <div className="mt-3.5 rounded-2xl border border-[var(--bd)] bg-[var(--surf)]/70 px-4 py-3 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-[var(--card)] border border-[var(--bd)] flex items-center justify-center shrink-0">
                                      <Calendar className="w-4 h-4 text-[var(--tx)]" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-[var(--tx)] truncate">
                                        {lang === 'tr' ? 'Ekip Toplantısı' : 'Team Call'}
                                      </p>
                                      <p className="text-[11.5px] text-[var(--mut)] tabular-nums">
                                        {lang === 'tr'
                                          ? 'Yarın · 10:00 – 11:00'
                                          : 'Tomorrow · 10:00 – 11:00'}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shrink-0">
                                    <AnimatedMiniTick delay={0.08} />
                                    <span>{lang === 'tr' ? 'Eklendi' : 'Saved'}</span>
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Tactile Composer Strip */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onTryLongclaw}
            className="w-full flex items-center justify-between gap-3 pl-4 pr-2 py-2.5 rounded-2xl bg-[var(--bg)]/85 border border-[var(--bd)]/85 hover:border-[var(--tx)]/28 transition-colors text-left cursor-pointer group"
          >
            <span className="text-xs sm:text-[13.5px] truncate min-w-0 flex-1">
              {stage === 'composing' || stage === 'launching' ? (
                <span className="text-[var(--tx)] font-medium">
                  {renderPromptText(composerText)}
                  <span
                    className="inline-block w-[1.5px] h-[0.95em] ml-0.5 bg-[var(--tx)] align-[-0.14em] animate-[blink_0.85s_steps(1)_infinite]"
                    aria-hidden="true"
                  />
                </span>
              ) : (
                <span className="text-[var(--mut)] group-hover:text-[var(--tx)]/80 transition-colors">
                  {lang === 'tr'
                    ? 'Longclaw’a bir şey sor veya / komutunu dene…'
                    : 'Ask Longclaw anything or try a / command…'}
                </span>
              )}
            </span>

            <span className="relative inline-flex items-center justify-center shrink-0">
              {/* Expanding Tactile Send Ripple */}
              <AnimatePresence>
                {sendRipple && !prefersReducedMotion && (
                  <motion.span
                    key="send-ripple"
                    initial={{ scale: 0.8, opacity: 0.55 }}
                    animate={{ scale: 1.75, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.34, ease: EDITORIAL_EASE }}
                    className="pointer-events-none absolute inset-0 rounded-full border border-[var(--ac)]"
                    aria-hidden="true"
                  />
                )}
              </AnimatePresence>

              <motion.span
                animate={{
                  scale: sendRipple ? 0.86 : 1,
                  opacity:
                    (stage === 'composing' || stage === 'launching') && composerText.length > 0
                      ? 1
                      : 0.78,
                }}
                transition={LIQUID_SPRING}
                className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  (stage === 'composing' || stage === 'launching') && composerText.length > 0
                    ? 'bg-[var(--ac)] text-[var(--on)]'
                    : 'bg-[var(--surf)] text-[var(--tx)] group-hover:bg-[var(--ac)] group-hover:text-[var(--on)]'
                }`}
                aria-hidden="true"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </motion.span>
            </span>
          </button>
        </div>
      </div>

      {/* Subtle Bottom Hairline Progress Indicator */}
      <div className="h-[2px] w-full bg-[var(--bd)]/35 overflow-hidden" aria-hidden="true">
        {!prefersReducedMotion && (
          <motion.div
            key={`progress-${currentIdx}-${stage}`}
            className="h-full bg-[var(--editorial-accent)]/75 origin-left"
            initial={{
              scaleX:
                stage === 'composing'
                  ? 0
                  : stage === 'launching'
                    ? 0.24
                    : stage === 'thinking'
                      ? 0.32
                      : stage === 'streaming'
                        ? 0.48
                        : 0.72,
            }}
            animate={{
              scaleX:
                stage === 'composing'
                  ? 0.24
                  : stage === 'launching'
                    ? 0.32
                    : stage === 'thinking'
                      ? 0.48
                      : stage === 'streaming'
                        ? 0.72
                        : isPaused
                          ? 0.72
                          : 1,
            }}
            transition={{
              duration:
                stage === 'composing'
                  ? 0.85
                  : stage === 'launching'
                    ? 0.18
                    : stage === 'thinking'
                      ? 0.78
                      : stage === 'streaming'
                        ? 1.1
                        : isPaused
                          ? 0.2
                          : 4.8,
              ease: 'linear',
            }}
          />
        )}
      </div>
    </motion.div>
  );
}
