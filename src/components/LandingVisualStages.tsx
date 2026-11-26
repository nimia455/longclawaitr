import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { Play } from 'lucide-react';
import type { Language } from '../lib/i18n';
import {
  EDITORIAL_EASE,
  EDITORIAL_VIEWPORT,
  LIQUID_EASE,
  LIQUID_MORPH,
  LIQUID_SCROLL_SPRING,
  LIQUID_SPRING,
} from '../lib/motion';

/**
 * HeroContourAtmosphere
 * Full-bleed photo-free architectural horizon & dawn/twilight atmospheric field.
 * Designed around a grand centered hero showcase with scroll-linked concentric meridians
 * and gentle topographic contour sweeps.
 */
export function HeroContourAtmosphere({
  theme,
  scrollTargetRef,
}: {
  theme: 'light' | 'dark';
  scrollTargetRef: React.RefObject<HTMLElement | null>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: scrollTargetRef,
    offset: ['start start', 'end start'],
  });

  const rawBackY = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [0, 56]);
  const rawMidY = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [0, 28]);
  const rawArcRot = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [0, 18]);

  const backY = useSpring(rawBackY, LIQUID_SCROLL_SPRING);
  const midY = useSpring(rawMidY, LIQUID_SCROLL_SPRING);
  const arcRot = useSpring(rawArcRot, LIQUID_SCROLL_SPRING);

  const isDark = theme === 'dark';

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Serene Dawn / Blue-Hour Atmospheric Wash */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background:
            'radial-gradient(66% 58% at 50% 8%, rgba(224, 206, 180, 0.44) 0%, rgba(238, 228, 214, 0.22) 44%, rgba(250, 249, 246, 0) 76%), radial-gradient(46% 48% at 86% 24%, rgba(196, 214, 232, 0.3) 0%, rgba(250, 249, 246, 0) 70%), radial-gradient(46% 48% at 14% 26%, rgba(236, 216, 192, 0.28) 0%, rgba(250, 249, 246, 0) 70%)',
        }}
      />
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(64% 56% at 50% 6%, rgba(102, 128, 168, 0.22) 0%, rgba(52, 64, 86, 0.12) 45%, rgba(17, 17, 16, 0) 76%), radial-gradient(44% 46% at 84% 26%, rgba(176, 134, 98, 0.12) 0%, rgba(17, 17, 16, 0) 70%), radial-gradient(44% 46% at 16% 26%, rgba(92, 114, 150, 0.14) 0%, rgba(17, 17, 16, 0) 70%)',
        }}
      />

      {/* Precision Architectural Dot Matrix */}
      <div
        className="absolute inset-0 opacity-[0.24] dark:opacity-[0.14]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, var(--bd) 1px, transparent 0)',
          backgroundSize: '34px 34px',
          maskImage:
            'radial-gradient(76% 68% at 50% 28%, black 18%, transparent 86%)',
          WebkitMaskImage:
            'radial-gradient(76% 68% at 50% 28%, black 18%, transparent 86%)',
        }}
      />

      {/* Centered Celestial Meridian Rings & Distant Contours */}
      <motion.svg
        style={{ y: backY }}
        viewBox="0 0 1440 860"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full will-change-transform"
      >
        <motion.g
          style={{
            transformOrigin: '720px 240px',
            rotate: arcRot,
          }}
        >
          <circle
            cx="720"
            cy="240"
            r="240"
            fill="none"
            stroke="var(--tx)"
            strokeOpacity={isDark ? 0.1 : 0.08}
            strokeWidth="1"
            strokeDasharray="3 9"
          />
          <circle
            cx="720"
            cy="240"
            r="380"
            fill="none"
            stroke="var(--ac)"
            strokeOpacity={isDark ? 0.14 : 0.1}
            strokeWidth="0.95"
          />
          <circle
            cx="720"
            cy="240"
            r="530"
            fill="none"
            stroke="var(--tx)"
            strokeOpacity={isDark ? 0.07 : 0.06}
            strokeWidth="0.85"
            strokeDasharray="6 12"
          />
        </motion.g>

        {/* Quiet Horizon Axis Lines */}
        <line
          x1="0"
          y1="240"
          x2="1440"
          y2="240"
          stroke="var(--bd)"
          strokeOpacity="0.45"
          strokeDasharray="3 8"
          strokeWidth="0.85"
        />

        {/* Flowing Architectural Contour Curves */}
        <motion.path
          d="M-40 612 C 220 540, 440 644, 720 572 C 980 506, 1180 598, 1480 518"
          fill="none"
          stroke="var(--tx)"
          strokeOpacity={isDark ? 0.13 : 0.1}
          strokeWidth="1.2"
          animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M-40 662 C 250 594, 480 688, 760 618 C 1020 554, 1210 640, 1480 568"
          fill="none"
          stroke="var(--ac)"
          strokeOpacity={isDark ? 0.2 : 0.14}
          strokeWidth="1.15"
          animate={prefersReducedMotion ? undefined : { y: [0, 7, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.svg>

      {/* Foreground Sculpted Ridge Layer */}
      <motion.svg
        style={{ y: midY }}
        viewBox="0 0 1440 860"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full will-change-transform"
      >
        <path
          d="M-40 712 C 280 650, 540 732, 830 666 C 1090 608, 1270 686, 1480 628 L 1480 880 L -40 880 Z"
          fill="var(--surf)"
          fillOpacity={isDark ? 0.34 : 0.54}
        />
        <path
          d="M-40 712 C 280 650, 540 732, 830 666 C 1090 608, 1270 686, 1480 628"
          fill="none"
          stroke="var(--bd)"
          strokeWidth="1.1"
        />
      </motion.svg>

      {/* Seamless Bottom Fade into Page Canvas */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/75 to-transparent" />
    </div>
  );
}

type EffortTierId = 'quick' | 'balanced' | 'deep';

/**
 * ReasoningFlowShowcaseCard
 * Interactive Adaptive Effort & Reasoning Flow Diagram in pure Plus Jakarta Sans.
 */
export function ReasoningFlowShowcaseCard({
  kicker,
  title,
  desc,
  lang,
}: {
  kicker: string;
  title: string;
  desc: string;
  lang: Language;
}) {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLElement | null>(null);
  const [tier, setTier] = useState<EffortTierId>('balanced');
  const [userSelected, setUserSelected] = useState(false);

  const isTr = lang === 'tr';

  // Gently cycle through effort profiles until user clicks one
  useEffect(() => {
    if (prefersReducedMotion || userSelected) return;
    const order: EffortTierId[] = ['quick', 'balanced', 'deep'];
    const id = window.setInterval(() => {
      setTier((prev) => order[(order.indexOf(prev) + 1) % order.length]);
    }, 4600);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion, userSelected]);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const tiers: Record<
    EffortTierId,
    {
      label: string;
      routeLabel: string;
      latency: string;
      activeNodes: number[];
      steps: Array<{ index: string; text: string; metric: string }>;
    }
  > = {
    quick: {
      label: isTr ? 'Hızlı' : 'Quick',
      routeLabel: 'Clawing 1.1 Low',
      latency: '0.4s',
      activeNodes: [0, 3],
      steps: isTr
        ? [
            { index: '01', text: 'Niyet ve dil anında çözümlendi', metric: 'Doğrudan' },
            { index: '02', text: 'Tek geçişte net yanıt üretildi', metric: '1 geçiş' },
          ]
        : [
            { index: '01', text: 'Intent & language parsed instantly', metric: 'Direct' },
            { index: '02', text: 'Clean single-pass response delivered', metric: '1 pass' },
          ],
    },
    balanced: {
      label: isTr ? 'Dengeli' : 'Balanced',
      routeLabel: 'Clawing 1.2 Pro',
      latency: '1.1s',
      activeNodes: [0, 1, 3],
      steps: isTr
        ? [
            { index: '01', text: 'Bağlam ve önceki mesajlar tarandı', metric: 'Bağlam' },
            { index: '02', text: 'Yapısal karşılaştırma ve kontrol', metric: '2 geçiş' },
            { index: '03', text: 'Ölçülü, sakin sentez hazırlandı', metric: 'Doğrulandı' },
          ]
        : [
            { index: '01', text: 'Conversation context & constraints mapped', metric: 'Context' },
            { index: '02', text: 'Structured trade-off comparison', metric: '2 passes' },
            { index: '03', text: 'Calm, structured synthesis ready', metric: 'Verified' },
          ],
    },
    deep: {
      label: isTr ? 'Derin' : 'Deep',
      routeLabel: 'Clawing 1.2 Ultra',
      latency: '2.6s',
      activeNodes: [0, 1, 2, 3],
      steps: isTr
        ? [
            { index: '01', text: 'Problem alt parçalara ayrıldı', metric: 'Ayrıştırma' },
            { index: '02', text: 'Alternatif hipotezler çapraz test edildi', metric: 'Çapraz kontrol' },
            { index: '03', text: 'Uç durumlar ve tutarlılık doğrulandı', metric: 'Doğrulandı' },
          ]
        : [
            { index: '01', text: 'Complex prompt decomposed into sub-proofs', metric: 'Decompose' },
            { index: '02', text: 'Competing hypotheses cross-checked', metric: 'Cross-check' },
            { index: '03', text: 'Edge cases verified before final output', metric: 'Verified' },
          ],
    },
  };

  const current = tiers[tier];
  const nodeMeta = isTr
    ? [
        { x: 64, y: 84, title: 'İstek' },
        { x: 186, y: 42, title: 'Bağlam' },
        { x: 308, y: 126, title: 'Doğrulama' },
        { x: 424, y: 84, title: 'Yanıt' },
      ]
    : [
        { x: 64, y: 84, title: 'Prompt' },
        { x: 186, y: 42, title: 'Context' },
        { x: 308, y: 126, title: 'Verify' },
        { x: 424, y: 84, title: 'Answer' },
      ];

  const activePaths =
    tier === 'quick'
      ? ['M 64 84 C 175 84, 315 84, 424 84']
      : tier === 'balanced'
        ? [
            'M 64 84 C 118 84, 134 42, 186 42',
            'M 186 42 C 266 42, 344 84, 424 84',
          ]
        : [
            'M 64 84 C 118 84, 134 42, 186 42',
            'M 186 42 C 246 42, 250 126, 308 126',
            'M 308 126 C 358 126, 372 84, 424 84',
          ];

  const fullMotionPath =
    tier === 'quick'
      ? 'M 64 84 C 175 84, 315 84, 424 84'
      : tier === 'balanced'
        ? 'M 64 84 C 118 84, 134 42, 186 42 C 266 42, 344 84, 424 84'
        : 'M 64 84 C 118 84, 134 42, 186 42 C 246 42, 250 126, 308 126 C 358 126, 372 84, 424 84';

  return (
    <motion.article
      ref={cardRef}
      onPointerMove={handlePointerMove}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={EDITORIAL_VIEWPORT}
      transition={{ duration: 0.56, ease: EDITORIAL_EASE }}
      className="spotlight-card relative rounded-[28px] bg-[var(--card)] border border-[var(--bd)] overflow-hidden flex flex-col justify-between transition-colors duration-300 hover:border-[var(--tx)]/22 shadow-[0_16px_42px_-28px_rgba(24,23,21,0.16)] dark:shadow-[0_20px_50px_-26px_rgba(0,0,0,0.62)]"
    >
      {/* Interactive Architectural Reasoning Canvas */}
      <div className="relative bg-[var(--surf)]/55 border-b border-[var(--bd)]/80 p-5 sm:p-7 flex flex-col gap-5">
        {/* Top Control Bar: Effort Switcher + Routed Model */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label={isTr ? 'Efor seviyesi' : 'Effort tier'}
            className="inline-flex items-center p-1 rounded-full bg-[var(--card)] border border-[var(--bd)]/85"
          >
            {(['quick', 'balanced', 'deep'] as EffortTierId[]).map((id) => {
              const active = tier === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setUserSelected(true);
                    setTier(id);
                  }}
                  className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'text-[var(--on)]' : 'text-[var(--mut)] hover:text-[var(--tx)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="landing-reasoning-tier"
                      transition={LIQUID_MORPH}
                      className="absolute inset-0 rounded-full bg-[var(--ac)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10">{tiers[id].label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--mut)] tabular-nums font-medium">
            <span className="text-[var(--tx)] font-semibold">{current.routeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{current.latency}</span>
          </div>
        </div>

        {/* Crisp Vector Routing Graph with Curve-Hugging Signal Pulse */}
        <div className="relative rounded-2xl bg-[var(--card)] border border-[var(--bd)]/80 px-3 py-4 overflow-hidden">
          <svg
            viewBox="0 0 488 168"
            className="w-full h-[148px] sm:h-[172px]"
            role="img"
            aria-label={
              isTr ? 'Otomatik akıl yürütme yönlendirme şeması' : 'Adaptive effort routing diagram'
            }
          >
            {/* Subtle Architectural Grid Lines */}
            <line x1="24" y1="84" x2="464" y2="84" stroke="var(--bd)" strokeDasharray="3 6" strokeWidth="1" />
            <line x1="186" y1="18" x2="186" y2="150" stroke="var(--bd)" strokeOpacity="0.55" strokeWidth="0.75" />
            <line x1="308" y1="18" x2="308" y2="150" stroke="var(--bd)" strokeOpacity="0.55" strokeWidth="0.75" />

            {/* Passive Guide Splines */}
            <path
              d="M 64 84 C 118 84, 134 42, 186 42 C 246 42, 250 126, 308 126 C 358 126, 372 84, 424 84"
              fill="none"
              stroke="var(--bd)"
              strokeWidth="1.25"
            />
            <path
              d="M 64 84 C 175 84, 315 84, 424 84"
              fill="none"
              stroke="var(--bd)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />

            {/* Active Effort Signal Paths */}
            <AnimatePresence mode="wait">
              <motion.g
                key={tier}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: LIQUID_EASE }}
              >
                {activePaths.map((d, idx) => (
                  <motion.path
                    key={d}
                    d={d}
                    fill="none"
                    stroke="var(--ac)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 0.52,
                      delay: idx * 0.12,
                      ease: EDITORIAL_EASE,
                    }}
                  />
                ))}

                {/* Smooth Signal Dot Gliding Along the Active Route */}
                {!prefersReducedMotion && (
                  <circle r="3.4" fill="var(--ac)" opacity="0.92">
                    <animateMotion
                      dur={tier === 'quick' ? '1.8s' : tier === 'balanced' ? '2.4s' : '3.0s'}
                      repeatCount="indefinite"
                      keyPoints="0;1"
                      keyTimes="0;1"
                      calcMode="spline"
                      keySplines="0.22 1 0.36 1"
                      path={fullMotionPath}
                    />
                  </circle>
                )}
              </motion.g>
            </AnimatePresence>

            {/* Architectural Nodes */}
            {nodeMeta.map((node, idx) => {
              const isActive = current.activeNodes.includes(idx);
              return (
                <g key={node.title} transform={`translate(${node.x}, ${node.y})`}>
                  <motion.circle
                    r={isActive ? 15 : 11}
                    fill="var(--card)"
                    stroke={isActive ? 'var(--ac)' : 'var(--bd)'}
                    strokeWidth={isActive ? 1.8 : 1.2}
                    animate={{ scale: isActive ? 1 : 0.92 }}
                    transition={LIQUID_SPRING}
                  />
                  <motion.circle
                    r={isActive ? 4.5 : 2.5}
                    fill={isActive ? 'var(--ac)' : 'var(--mut)'}
                    fillOpacity={isActive ? 1 : 0.45}
                    animate={{ scale: isActive ? 1 : 0.85 }}
                    transition={LIQUID_SPRING}
                  />
                  <text
                    y={idx === 1 ? -22 : 30}
                    textAnchor="middle"
                    className="text-[11.5px] font-medium"
                    fill={isActive ? 'var(--tx)' : 'var(--mut)'}
                  >
                    {node.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Live Structured Reasoning Trace */}
        <div className="min-h-[104px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tier}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -5 }}
              transition={{ duration: 0.24, ease: EDITORIAL_EASE }}
              className="divide-y divide-[var(--bd)]/70 border-y border-[var(--bd)]/70"
            >
              {current.steps.map((step) => (
                <div
                  key={step.index}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-semibold tabular-nums text-[var(--ac)] shrink-0">
                      {step.index}
                    </span>
                    <span className="text-[var(--tx)] font-medium truncate">{step.text}</span>
                  </div>
                  <span className="text-[11.5px] font-medium text-[var(--mut)] shrink-0">
                    {step.metric}
                  </span>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Editorial Caption */}
      <div className="relative p-6 sm:p-8 space-y-2.5">
        <p className="text-xs font-medium text-[var(--mut)]">{kicker}</p>
        <h3 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-[var(--tx)] text-balance">
          {title}
        </h3>
        <p className="text-[15px] text-[var(--mut)] leading-[1.72]">{desc}</p>
      </div>
    </motion.article>
  );
}

type SandboxPreset = 'metrics' | 'layout';

/**
 * LiveCodeShowcaseCard
 * Interactive Code-to-Live-Preview mini studio with crisp Plus Jakarta Sans styling.
 */
export function LiveCodeShowcaseCard({
  kicker,
  title,
  desc,
  lang,
}: {
  kicker: string;
  title: string;
  desc: string;
  lang: Language;
}) {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLElement | null>(null);
  const [preset, setPreset] = useState<SandboxPreset>('metrics');
  const isTr = lang === 'tr';

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const bars = preset === 'metrics' ? [38, 62, 54, 86, 74, 94] : [72, 46, 84, 58, 92, 66];

  const codeLines =
    preset === 'metrics'
      ? [
          'const series = [38, 62, 54, 86, 74, 94];',
          'renderChart(series, { spring: true });',
          'export default LivePreview;',
        ]
      : [
          'const grid = layout("asymmetric");',
          'mountCanvas({ theme: "calm" });',
          'export default StudioCard;',
        ];

  return (
    <motion.article
      ref={cardRef}
      onPointerMove={handlePointerMove}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={EDITORIAL_VIEWPORT}
      transition={{ duration: 0.56, delay: 0.08, ease: EDITORIAL_EASE }}
      className="spotlight-card relative rounded-[28px] bg-[var(--card)] border border-[var(--bd)] overflow-hidden flex flex-col transition-colors duration-300 hover:border-[var(--tx)]/22 shadow-[0_16px_42px_-28px_rgba(24,23,21,0.16)] dark:shadow-[0_20px_50px_-26px_rgba(0,0,0,0.62)]"
    >
      {/* Interactive Mini Code & Live Render Stage */}
      <div className="bg-[var(--surf)]/55 border-b border-[var(--bd)]/80 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center p-0.5 rounded-full bg-[var(--card)] border border-[var(--bd)]/85">
            {(
              [
                { id: 'metrics' as const, label: isTr ? 'Grafik' : 'Chart' },
                { id: 'layout' as const, label: isTr ? 'Arayüz' : 'Layout' },
              ]
            ).map((opt) => {
              const active = preset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPreset(opt.id)}
                  className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'text-[var(--on)]' : 'text-[var(--mut)] hover:text-[var(--tx)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="landing-sandbox-preset"
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

          <button
            type="button"
            onClick={() => setPreset((p) => (p === 'metrics' ? 'layout' : 'metrics'))}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isTr ? 'Çalıştır' : 'Run'}</span>
          </button>
        </div>

        {/* Clean Code Strip */}
        <div className="rounded-xl bg-[var(--bg)] border border-[var(--bd)]/85 px-3.5 py-3 text-xs leading-[1.7] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={preset}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: LIQUID_EASE }}
              className="space-y-0.5"
            >
              {codeLines.map((line, i) => (
                <div key={i} className="flex items-center gap-3 truncate">
                  <span className="text-[var(--mut)]/55 tabular-nums select-none w-3 font-medium">
                    {i + 1}
                  </span>
                  <span
                    className={
                      i === 1 ? 'text-[var(--ac)] font-medium' : 'text-[var(--tx)]/85'
                    }
                  >
                    {line}
                  </span>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Live Visual Output Frame */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--bd)]/85 p-3.5 h-[92px] flex items-end justify-between gap-2 overflow-hidden">
          {preset === 'metrics' ? (
            bars.map((val, idx) => (
              <div key={idx} className="flex-1 h-full flex flex-col justify-end">
                <motion.div
                  initial={false}
                  animate={{ height: `${val}%` }}
                  transition={LIQUID_SPRING}
                  className={`w-full rounded-md ${
                    idx === bars.length - 1 ? 'bg-[var(--ac)]' : 'bg-[var(--tx)]/18'
                  }`}
                />
              </div>
            ))
          ) : (
            <motion.div
              key="layout-preview"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: EDITORIAL_EASE }}
              className="w-full h-full grid grid-cols-12 gap-2"
            >
              <div className="col-span-5 rounded-lg bg-[var(--ac)]/15 border border-[var(--ac)]/32 p-2.5 flex flex-col justify-between">
                <span className="w-6 h-1.5 rounded-full bg-[var(--ac)]" />
                <span className="w-10 h-1.5 rounded-full bg-[var(--tx)]/25" />
              </div>
              <div className="col-span-7 flex flex-col gap-2">
                <div className="flex-1 rounded-lg bg-[var(--surf)] border border-[var(--bd)]/80 px-2.5 flex items-center justify-between">
                  <span className="w-12 h-1.5 rounded-full bg-[var(--tx)]/35" />
                  <span className="w-4 h-1.5 rounded-full bg-[var(--ac)]/70" />
                </div>
                <div className="flex-1 rounded-lg bg-[var(--surf)] border border-[var(--bd)]/80 px-2.5 flex items-center gap-1.5">
                  <span className="w-7 h-1.5 rounded-full bg-[var(--tx)]/22" />
                  <span className="w-11 h-1.5 rounded-full bg-[var(--tx)]/14" />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Editorial Caption */}
      <div className="relative p-6 sm:p-7 space-y-2">
        <p className="text-xs font-medium text-[var(--mut)]">{kicker}</p>
        <h3 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-[var(--tx)] text-balance">
          {title}
        </h3>
        <p className="text-sm sm:text-[14.5px] text-[var(--mut)] leading-[1.68]">{desc}</p>
      </div>
    </motion.article>
  );
}
