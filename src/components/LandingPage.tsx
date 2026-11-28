import React, { useEffect, useState, useRef } from 'react';
import {
  Sun,
  Moon,
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'motion/react';
import type { User } from 'firebase/auth';
import { LongclawLogo } from './Icons';
import { HeroChatShowcase } from './HeroChatShowcase';
import { DepthsShowcase } from './DepthsShowcase';
import {
  AnimatedCheckItem,
  MaskedReveal,
} from './LandingMotion';
import {
  HorizonClosingBand,
  InteractiveDayChapters,
  ModelFamilyLedger,
  VoiceEyesMiniShowcase,
} from './LandingEditorialSections';
import {
  HeroContourAtmosphere,
  LiveCodeShowcaseCard,
  ReasoningFlowShowcaseCard,
} from './LandingVisualStages';
import { LegalDocType } from './LegalModal';
import { FAMILY_MODELS } from '../lib/models';
import { BenchmarkPage } from './BenchmarkPage';
import { Language, TRANSLATIONS } from '../lib/i18n';
import {
  EDITORIAL_EASE,
  EDITORIAL_VIEWPORT,
  LIQUID_EASE,
  LIQUID_MORPH,
  LIQUID_SPRING,
  LIQUID_TAP,
  PROGRESS_SCROLL_SPRING,
  useIsCoarsePointer,
} from '../lib/motion';

interface LandingPageProps {
  user?: User | null;
  onOpenAuth: (tab: 'in' | 'up') => void;
  onOpenLegal: (type: LegalDocType) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  lang: Language;
  onChangeLang: (lang: Language) => void;
}

type NavTarget = 'top' | 'gun' | 'modlar' | 'sss' | 'benchmarks';

export function LandingPage({
  user,
  onOpenAuth,
  onOpenLegal,
  theme,
  onToggleTheme,
  lang,
  onChangeLang,
}: LandingPageProps) {
  const t = TRANSLATIONS[lang];
  const l = t.landing;
  const demoConversations = l.demoConversations;
  const depthAnswers = l.depthAnswers;
  const prefersReducedMotion = useReducedMotion();
  const isCoarsePointer = useIsCoarsePointer();

  const [activePage, setActivePage] = useState<'home' | 'benchmarks'>('home');
  const [activeSection, setActiveSection] = useState<'top' | 'gun' | 'modlar' | 'sss'>('top');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Page-wide scroll reading hairline (desktop only to keep mobile scroll completely zero-overhead)
  const { scrollYProgress: pageScrollProgress } = useScroll();
  const smoothPageProgress = useSpring(pageScrollProgress, PROGRESS_SCROLL_SPRING);

  // Hero section ref for scroll-linked architectural contour parallax
  const heroRef = useRef<HTMLElement | null>(null);

  // Lightweight scroll-spy for gliding top-bar active indicator
  useEffect(() => {
    if (activePage !== 'home' || typeof window === 'undefined') return;
    const sectionIds: Array<'top' | 'modlar' | 'gun' | 'sss'> = ['top', 'modlar', 'gun', 'sss'];
    const observed = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (observed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          const id = visible[0].target.id as 'top' | 'modlar' | 'gun' | 'sss';
          setActiveSection(id);
        }
      },
      { rootMargin: '-28% 0px -48% 0px', threshold: [0.05, 0.25, 0.5] }
    );

    observed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activePage]);

  const openBenchmarks = () => {
    setMobileNavOpen(false);
    setActivePage('benchmarks');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigateToSection = (sectionId: 'top' | 'gun' | 'modlar' | 'sss') => {
    setMobileNavOpen(false);
    setActivePage('home');
    setActiveSection(sectionId);
    setTimeout(() => {
      if (sectionId === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 30);
  };

  const activeNavKey: NavTarget =
    activePage === 'benchmarks' ? 'benchmarks' : activeSection;

  const navItems: Array<{
    key: NavTarget;
    label: string;
    onClick: () => void;
  }> = [
    { key: 'modlar', label: t.nav.depths, onClick: () => navigateToSection('modlar') },
    { key: 'gun', label: t.nav.whatItDoes, onClick: () => navigateToSection('gun') },
    { key: 'benchmarks', label: t.nav.benchmarks, onClick: openBenchmarks },
    { key: 'sss', label: t.nav.faq, onClick: () => navigateToSection('sss') },
  ];

  const localizedFamilyModels = FAMILY_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    tagline: t.models[m.id].tagline,
    description: t.models[m.id].description,
  }));

  const capabilityPillars =
    lang === 'tr'
      ? [
          {
            num: '01',
            title: 'Otomatik efor yönlendirme',
            desc: 'Basit sorularda hızlanır, zor problemlerde otomatik olarak daha derin modellere geçer.',
          },
          {
            num: '02',
            title: 'Komut duyarlı sesli eşlikçi',
            desc: 'Doğal sesle konuşur, verdiğin komutlara göre şekil ve ifade değiştiren yalın gözlerle yanıt verir.',
          },
          {
            num: '03',
            title: 'Canlı kod önizleme',
            desc: 'HTML, CSS, SVG ve JavaScript çıktılarını sohbeti terk etmeden anında çalıştırır.',
          },
          {
            num: '04',
            title: 'Doğrudan Google Workspace',
            desc: '/gmail, /takvim ve /drive komutlarıyla işlerini tek çalışma alanından yönetir.',
          },
        ]
      : [
          {
            num: '01',
            title: 'Adaptive effort routing',
            desc: 'Answers quick notes instantly and quietly scales up to deeper models when reasoning demands it.',
          },
          {
            num: '02',
            title: 'Expressive voice companion',
            desc: 'Speaks naturally with minimalist pupil-less eyes that morph to every spoken command.',
          },
          {
            num: '03',
            title: 'Live sandbox preview',
            desc: 'Runs HTML, CSS, SVG, and JavaScript right beside your conversation with zero setup.',
          },
          {
            num: '04',
            title: 'Direct Google Workspace',
            desc: 'Act across Gmail, Calendar, Drive, and Docs with clean / commands in one calm window.',
          },
        ];

  return (
    <div className="ambient-canvas relative min-h-screen font-soft text-[var(--tx)] selection:bg-[var(--tx)] selection:text-[var(--bg)]">
      {/* Ultra-subtle fine-art paper grain (desktop only so mobile GPUs avoid full-screen noise compositing) */}
      <div
        className="hidden md:block ambient-grain pointer-events-none fixed inset-0 z-0 opacity-[0.028] dark:opacity-[0.04]"
        aria-hidden="true"
      />

      {/* Clean 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] bg-[var(--bg)]/95 md:bg-[var(--bg)]/82 md:backdrop-blur-lg border-b border-[var(--bd)]/65">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <motion.a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              navigateToSection('top');
            }}
            whileHover={prefersReducedMotion ? undefined : { x: 1 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            transition={LIQUID_TAP}
            className="group flex items-center gap-2 font-semibold text-base sm:text-[17px] tracking-[-0.02em] text-[var(--tx)] whitespace-nowrap shrink-0"
          >
            <span className="inline-flex transition-transform duration-300 ease-out group-hover:-rotate-12 group-hover:scale-105">
              <LongclawLogo className="w-[26px] h-[26px] text-[var(--tx)]" />
            </span>
            <span>Longclaw</span>
          </motion.a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--mut)]">
            {navItems.map((item) => {
              const isActive = activeNavKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`relative py-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-200 ${
                    isActive ? 'text-[var(--tx)] font-semibold' : 'hover:text-[var(--tx)]'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="landing-nav-underline"
                      transition={LIQUID_MORPH}
                      className="absolute inset-x-0 -bottom-0.5 h-[1.5px] rounded-full bg-[var(--ac)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Language, Theme, Sign In, Primary Action */}
          <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
            <div
              role="group"
              aria-label={t.nav.chooseLanguage}
              className="hidden sm:inline-flex items-center gap-1 text-xs shrink-0"
            >
              <button
                type="button"
                onClick={() => onChangeLang('en')}
                aria-pressed={lang === 'en'}
                className={`px-1 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                  lang === 'en'
                    ? 'text-[var(--tx)] font-semibold'
                    : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                EN
              </button>
              <span className="text-[var(--bd)] select-none" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => onChangeLang('tr')}
                aria-pressed={lang === 'tr'}
                className={`px-1 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                  lang === 'tr'
                    ? 'text-[var(--tx)] font-semibold'
                    : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                TR
              </button>
            </div>

            <motion.button
              type="button"
              onClick={onToggleTheme}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
              transition={LIQUID_TAP}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer shrink-0 overflow-hidden"
              aria-label={t.nav.toggleTheme}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={prefersReducedMotion ? false : { opacity: 0, rotate: -45, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, rotate: 45, scale: 0.7 }}
                  transition={{ duration: 0.2, ease: LIQUID_EASE }}
                  className="inline-flex items-center justify-center"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {!user && (
              <button
                type="button"
                onClick={() => onOpenAuth('in')}
                className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {t.nav.signIn}
              </button>
            )}

            <motion.button
              type="button"
              onClick={() => onOpenAuth('up')}
              whileHover={prefersReducedMotion ? undefined : { y: -1 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              transition={LIQUID_TAP}
              className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--ac)] text-[var(--on)] hover:opacity-92 text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap shrink-0 transition-opacity"
            >
              <span>
                {user
                  ? lang === 'tr'
                    ? 'Çalışma alanı'
                    : 'Open workspace'
                  : t.nav.start}
              </span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </motion.button>

            {/* Mobile Navigation Drawer Toggle */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? t.common.close : lang === 'tr' ? 'Menüyü aç' : 'Open menu'}
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer shrink-0"
            >
              {mobileNavOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>

        {/* Clean Mobile Navigation Sheet */}
        <AnimatePresence initial={false}>
          {mobileNavOpen && (
            <motion.div
              key="landing-mobile-nav"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: LIQUID_EASE }}
              className="md:hidden overflow-hidden border-t border-[var(--bd)]/75 bg-[var(--bg)]"
            >
              <div className="px-4 py-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = activeNavKey === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onClick}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[var(--surf)] text-[var(--tx)] font-semibold'
                          : 'text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)]/60 font-medium'
                      }`}
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-55" />
                    </button>
                  );
                })}

                <div className="pt-3 mt-2 border-t border-[var(--bd)]/75 flex items-center justify-between gap-3 px-2">
                  <div
                    role="group"
                    aria-label={t.nav.chooseLanguage}
                    className="inline-flex items-center gap-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeLang('en')}
                      aria-pressed={lang === 'en'}
                      className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                        lang === 'en'
                          ? 'bg-[var(--surf)] text-[var(--tx)] font-semibold'
                          : 'text-[var(--mut)]'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeLang('tr')}
                      aria-pressed={lang === 'tr'}
                      className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                        lang === 'tr'
                          ? 'bg-[var(--surf)] text-[var(--tx)] font-semibold'
                          : 'text-[var(--mut)]'
                      }`}
                    >
                      Türkçe
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      onOpenAuth('in');
                    }}
                    className="px-3.5 py-1.5 rounded-full border border-[var(--bd)] bg-[var(--card)] text-xs font-medium text-[var(--tx)] cursor-pointer whitespace-nowrap"
                  >
                    {user
                      ? lang === 'tr'
                        ? 'Çalışma alanı'
                        : 'Open workspace'
                      : t.nav.signIn}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Razor-Thin Scroll Reading Progress Hairline (desktop only for silky mobile scrolling) */}
        {activePage === 'home' && !prefersReducedMotion && !isCoarsePointer && (
          <motion.div
            style={{ scaleX: smoothPageProgress }}
            className="hidden md:block h-[1.5px] w-full bg-[var(--editorial-accent)]/75 origin-left will-change-transform"
            aria-hidden="true"
          />
        )}
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {activePage === 'benchmarks' ? (
          <motion.div
            key="benchmarks-view"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
            className="relative z-10"
          >
            <BenchmarkPage
              lang={lang}
              onBack={() => navigateToSection('top')}
              onOpenAuth={onOpenAuth}
            />
          </motion.div>
        ) : (
          <motion.main
            key="home-view"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.24, ease: LIQUID_EASE }}
            className="relative z-10"
          >
            {/* GRAND EDITORIAL HERO: Authoritative Jakarta Display + Full-Width Live Workspace Stage */}
            <section
              ref={heroRef}
              id="top"
              className="relative z-10 overflow-hidden border-b border-[var(--bd)]/75"
            >
              <HeroContourAtmosphere theme={theme} scrollTargetRef={heroRef} />

              <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 lg:pt-28 pb-16 sm:pb-24">
                <div className="max-w-3xl mx-auto text-center">
                  <motion.p
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.44, ease: EDITORIAL_EASE }}
                    className="inline-flex items-center gap-3 text-xs sm:text-[13px] font-medium text-[var(--mut)] mb-6"
                  >
                    <span className="w-5 h-px bg-[var(--bd)]" aria-hidden="true" />
                    <span>{l.poweredBy}</span>
                    <span className="w-5 h-px bg-[var(--bd)]" aria-hidden="true" />
                  </motion.p>

                  <h1 className="font-display text-[2.65rem] sm:text-[3.85rem] lg:text-[4.65rem] font-medium tracking-[-0.03em] leading-[1.04] text-[var(--tx)] text-balance">
                    <MaskedReveal delay={0.04}>{l.heroTitleLine1}</MaskedReveal>
                    <MaskedReveal delay={0.12}>
                      <span className="italic font-normal text-[var(--tx)]/76">
                        {l.heroTitleLine2}
                      </span>
                    </MaskedReveal>
                  </h1>

                  <motion.p
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.52, delay: 0.18, ease: EDITORIAL_EASE }}
                    className="mt-6 text-base sm:text-[17.5px] text-[var(--mut)] max-w-xl mx-auto leading-[1.72] text-balance"
                  >
                    {l.heroSubtitle}
                  </motion.p>

                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.24, ease: EDITORIAL_EASE }}
                    className="mt-9 flex flex-wrap items-center justify-center gap-5"
                  >
                    <motion.button
                      type="button"
                      onClick={() => onOpenAuth('up')}
                      whileHover={prefersReducedMotion ? undefined : { y: -1.5, scale: 1.01 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                      transition={LIQUID_TAP}
                      className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[var(--ac)] text-[var(--on)] hover:opacity-92 text-sm font-medium cursor-pointer whitespace-nowrap transition-opacity"
                    >
                      <span>{l.startFree}</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                    </motion.button>

                    <button
                      type="button"
                      onClick={openBenchmarks}
                      className="group inline-flex items-center gap-1.5 py-2 text-sm font-medium text-[var(--tx)]/82 hover:text-[var(--tx)] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span className="underline underline-offset-4 decoration-[var(--tx)]/28 group-hover:decoration-[var(--tx)] transition-colors">
                        {l.benchmarksCta}
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-[var(--mut)] transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  </motion.div>
                </div>

                {/* Wide, Full-Presence Interactive Workspace Showcase */}
                <div className="mt-14 sm:mt-16 max-w-3xl mx-auto">
                  <HeroChatShowcase
                    conversations={demoConversations}
                    badgeLabel={l.heroThinkingBadge}
                    lang={lang}
                    onTryLongclaw={() => onOpenAuth('up')}
                    className="w-full"
                  />
                </div>
              </div>
            </section>

            {/* ARCHITECTURAL PILLARS STRIP: 4-Column Hairline Capability Overview */}
            <section className="relative z-10 border-b border-[var(--bd)]/75 bg-[var(--card)]/78">
              <div className="max-w-6xl mx-auto px-4 sm:px-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--bd)]/75">
                  {capabilityPillars.map((pillar, idx) => (
                    <motion.div
                      key={pillar.num}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={EDITORIAL_VIEWPORT}
                      transition={{
                        duration: 0.45,
                        delay: idx * 0.05,
                        ease: EDITORIAL_EASE,
                      }}
                      className="py-7 sm:py-8 sm:px-6 first:sm:pl-0 last:sm:pr-0 space-y-2"
                    >
                      <span className="block text-xs font-mono font-medium tabular-nums text-[var(--editorial-accent)]">
                        {pillar.num}
                      </span>
                      <h2 className="text-[15px] font-semibold tracking-tight text-[var(--tx)]">
                        {pillar.title}
                      </h2>
                      <p className="text-[13.5px] text-[var(--mut)] leading-[1.65]">
                        {pillar.desc}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 01: Asymmetric Interactive Studio Bento */}
            <section className="mobile-scroll-section py-20 sm:py-26 border-b border-[var(--bd)]/75">
              <div className="max-w-6xl mx-auto px-4 sm:px-8">
                <div className="max-w-2xl mb-12 sm:mb-14">
                  <motion.p
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={EDITORIAL_VIEWPORT}
                    transition={{ duration: 0.42, ease: EDITORIAL_EASE }}
                    className="text-xs font-medium tabular-nums text-[var(--mut)] mb-2.5"
                  >
                    <span className="font-mono text-[var(--editorial-accent)] mr-1.5">01.</span>
                    {l.showcaseEyebrow}
                  </motion.p>
                  <h2 className="font-display text-3xl sm:text-[2.7rem] font-medium tracking-[-0.025em] leading-[1.1] text-balance">
                    <MaskedReveal inView delay={0.04}>
                      {l.showcaseTitle}
                    </MaskedReveal>
                  </h2>
                </div>

                {/* 7 / 5 Asymmetric Interactive Bento Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
                  <div className="lg:col-span-7 flex">
                    <div className="w-full flex flex-col [&>article]:flex-1">
                      <ReasoningFlowShowcaseCard
                        kicker={l.showcaseCards.reasoningKicker}
                        title={l.showcaseCards.reasoningTitle}
                        desc={l.showcaseCards.reasoningDesc}
                        lang={lang}
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-5 flex flex-col gap-6 sm:gap-8">
                    <LiveCodeShowcaseCard
                      kicker={l.showcaseCards.codingKicker}
                      title={l.showcaseCards.codingTitle}
                      desc={l.showcaseCards.codingDesc}
                      lang={lang}
                    />
                    <VoiceEyesMiniShowcase
                      lang={lang}
                      onTryVoice={() => onOpenAuth('up')}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 02: Interactive Clawing Model Family Ledger */}
            <section className="mobile-scroll-section relative z-10 py-20 sm:py-26 bg-[var(--surf)]/65 border-b border-[var(--bd)]/75">
              <div className="max-w-6xl mx-auto px-4 sm:px-8">
                <div className="max-w-2xl mb-12 sm:mb-14">
                  <motion.p
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={EDITORIAL_VIEWPORT}
                    transition={{ duration: 0.42, ease: EDITORIAL_EASE }}
                    className="text-xs font-medium tabular-nums text-[var(--mut)] mb-2.5"
                  >
                    <span className="font-mono text-[var(--editorial-accent)] mr-1.5">02.</span>
                    {l.familyEyebrow}
                  </motion.p>
                  <h2 className="font-display text-3xl sm:text-[2.7rem] font-medium tracking-[-0.025em] leading-[1.1] text-balance">
                    <MaskedReveal inView delay={0.04}>
                      {l.familyTitle}
                    </MaskedReveal>
                  </h2>
                  <motion.p
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={EDITORIAL_VIEWPORT}
                    transition={{ duration: 0.46, delay: 0.1, ease: EDITORIAL_EASE }}
                    className="mt-3.5 text-[15.5px] text-[var(--mut)] leading-relaxed"
                  >
                    {l.familySubtitle}
                  </motion.p>
                </div>

                <ModelFamilyLedger
                  models={localizedFamilyModels}
                  lang={lang}
                  onStartWorkspace={() => onOpenAuth('up')}
                  onOpenBenchmarks={openBenchmarks}
                  compareLabel={l.compareBenchmarks}
                />
              </div>
            </section>

            {/* SECTION 03: Three Reasoning Depths (Full-Presence Editorial Stage) */}
            <section id="modlar" className="mobile-scroll-section py-20 sm:py-26 border-b border-[var(--bd)]/75">
              <div className="max-w-6xl mx-auto px-4 sm:px-8">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 sm:mb-12">
                  <div className="max-w-xl">
                    <motion.p
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={EDITORIAL_VIEWPORT}
                      transition={{ duration: 0.42, ease: EDITORIAL_EASE }}
                      className="text-xs font-medium tabular-nums text-[var(--mut)] mb-2.5"
                    >
                      <span className="font-mono text-[var(--editorial-accent)] mr-1.5">03.</span>
                      {t.nav.depths}
                    </motion.p>
                    <h2 className="font-display text-3xl sm:text-[2.7rem] font-medium tracking-[-0.025em] leading-[1.1] text-balance">
                      <MaskedReveal inView>{l.depthsTitle}</MaskedReveal>
                    </h2>
                  </div>

                  <motion.p
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={EDITORIAL_VIEWPORT}
                    transition={{ duration: 0.46, delay: 0.08, ease: EDITORIAL_EASE }}
                    className="text-[var(--mut)] text-[15px] leading-[1.72] max-w-md"
                  >
                    {l.depthsSubtitle}
                  </motion.p>
                </div>

                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={EDITORIAL_VIEWPORT}
                  transition={{ duration: 0.56, ease: EDITORIAL_EASE }}
                >
                  <DepthsShowcase
                    prompt={l.depthPrompt}
                    answers={depthAnswers}
                    lang={lang}
                  />
                </motion.div>
              </div>
            </section>

            {/* SECTION 04: Interactive Daily Workflow Chapters */}
            <section
              id="gun"
              className="mobile-scroll-section relative z-10 py-20 sm:py-26 bg-[var(--surf)]/65 border-b border-[var(--bd)]/75"
            >
              <div className="max-w-6xl mx-auto px-4 sm:px-8">
                <div className="max-w-2xl mb-10 sm:mb-12">
                  <motion.p
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={EDITORIAL_VIEWPORT}
                    transition={{ duration: 0.42, ease: EDITORIAL_EASE }}
                    className="text-xs font-medium tabular-nums text-[var(--mut)] mb-2.5"
                  >
                    <span className="font-mono text-[var(--editorial-accent)] mr-1.5">04.</span>
                    {t.nav.whatItDoes}
                  </motion.p>
                  <h2 className="font-display text-3xl sm:text-[2.7rem] font-medium tracking-[-0.025em] leading-[1.1] text-balance">
                    <MaskedReveal inView>{l.timelineTitle}</MaskedReveal>
                  </h2>
                </div>

                <InteractiveDayChapters items={l.timelineItems} lang={lang} />
              </div>
            </section>

            {/* SECTION 05: Quiet Details + Asymmetric FAQ + Architectural Horizon Closing Band */}
            <section id="sss" className="mobile-scroll-section py-20 sm:py-26">
              <div className="max-w-6xl mx-auto px-4 sm:px-8">
                {/* Quiet Details Hairline Band */}
                <div className="pb-16 sm:pb-20 mb-16 sm:mb-20 border-b border-[var(--bd)]/75 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                  <div className="lg:col-span-4">
                    <p className="text-xs font-medium tabular-nums text-[var(--mut)] mb-2.5">
                      <span className="font-mono text-[var(--editorial-accent)] mr-1.5">05.</span>
                      {lang === 'tr' ? 'Ayrıntılar' : 'Craft & Details'}
                    </p>
                    <h2 className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.025em] leading-[1.12] text-balance">
                      <MaskedReveal inView>{l.checklistTitle}</MaskedReveal>
                    </h2>
                  </div>

                  <ul className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
                    {l.checklistItems.map((feat, i) => (
                      <AnimatedCheckItem key={i} label={feat} index={i} />
                    ))}
                  </ul>
                </div>

                {/* Asymmetric FAQ Split */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                  <div className="lg:col-span-4 lg:sticky lg:top-24">
                    <p className="text-xs font-medium text-[var(--mut)] mb-2.5">
                      {t.nav.faq}
                    </p>
                    <h2 className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.025em] leading-[1.12] text-balance">
                      <MaskedReveal inView>{l.faqTitle}</MaskedReveal>
                    </h2>
                  </div>

                  <div className="lg:col-span-8 divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
                    {l.faqs.map((faq, i) => {
                      const isOpen = openFaqIdx === i;
                      return (
                        <motion.div
                          key={i}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={EDITORIAL_VIEWPORT}
                          transition={{
                            duration: 0.42,
                            delay: Math.min(i * 0.045, 0.2),
                            ease: EDITORIAL_EASE,
                          }}
                          className="relative"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenFaqIdx(isOpen ? null : i)}
                            aria-expanded={isOpen}
                            className="w-full py-5 text-left font-medium text-[15.5px] sm:text-base cursor-pointer flex items-center justify-between gap-4 text-[var(--tx)] hover:opacity-85 transition-opacity"
                          >
                            <span>{faq.q}</span>

                            {/* Morphing Plus / Minus Geometric Indicator */}
                            <span
                              className="relative w-5 h-5 flex items-center justify-center shrink-0 text-[var(--mut)]"
                              aria-hidden="true"
                            >
                              <span className="w-3.5 h-[1.5px] rounded-full bg-current" />
                              <motion.span
                                initial={false}
                                animate={{
                                  rotate: isOpen ? 90 : 0,
                                  scaleY: isOpen ? 0 : 1,
                                  opacity: isOpen ? 0 : 1,
                                }}
                                transition={LIQUID_SPRING}
                                className="absolute w-[1.5px] h-3.5 rounded-full bg-current"
                              />
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{
                                  height: LIQUID_SPRING,
                                  opacity: { duration: 0.22, ease: LIQUID_EASE },
                                }}
                                className="overflow-hidden"
                              >
                                <motion.p
                                  initial={prefersReducedMotion ? false : { y: -6, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  exit={prefersReducedMotion ? undefined : { y: -4, opacity: 0 }}
                                  transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
                                  className="pb-5 text-[14.5px] sm:text-[15px] text-[var(--mut)] leading-[1.72] max-w-2xl"
                                >
                                  {faq.a}
                                </motion.p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Photo-Free Architectural Horizon Closing Band */}
                <HorizonClosingBand
                  title={
                    lang === 'tr'
                      ? 'Sakin, odaklanmış bir çalışma alanına geç.'
                      : 'Step into a calmer way to think and build.'
                  }
                  subtitle={l.footerTagline}
                  ctaLabel={l.getStartedNow}
                  theme={theme}
                  onStart={() => onOpenAuth('up')}
                />
              </div>
            </section>
          </motion.main>
        )}
      </AnimatePresence>

      {/* Calm Minimal Footer */}
      <motion.footer
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={EDITORIAL_VIEWPORT}
        transition={{ duration: 0.48, ease: EDITORIAL_EASE }}
        className="mobile-scroll-section relative z-10 border-t border-[var(--bd)]/75 py-14 sm:py-16 bg-[var(--surf)]/65 text-[var(--mut)] text-xs"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-8 grid grid-cols-1 sm:grid-cols-3 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 font-semibold text-base tracking-[-0.02em] text-[var(--tx)] mb-2.5">
              <LongclawLogo className="w-[22px] h-[22px] text-[var(--tx)]" />
              <span>Longclaw</span>
            </div>
            <p className="leading-relaxed mb-5 max-w-xs">{l.footerTagline}</p>

            <div
              role="group"
              aria-label={t.nav.chooseLanguage}
              className="inline-flex items-center gap-2.5 text-xs"
            >
              <button
                type="button"
                onClick={() => onChangeLang('en')}
                aria-pressed={lang === 'en'}
                className={`py-0.5 transition-colors cursor-pointer ${
                  lang === 'en'
                    ? 'text-[var(--tx)] font-semibold'
                    : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                English
              </button>
              <span className="text-[var(--bd)] select-none" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => onChangeLang('tr')}
                aria-pressed={lang === 'tr'}
                className={`py-0.5 transition-colors cursor-pointer ${
                  lang === 'tr'
                    ? 'text-[var(--tx)] font-semibold'
                    : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                Türkçe
              </button>
            </div>
          </div>

          <div>
            <h5 className="font-semibold text-[var(--tx)] text-xs mb-3.5">
              {l.footerNavHeading}
            </h5>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => navigateToSection('top')}
                className="block py-0.5 hover:text-[var(--tx)] transition-colors text-left cursor-pointer"
              >
                {l.footerBackToTop}
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('modlar')}
                className="block py-0.5 hover:text-[var(--tx)] transition-colors text-left cursor-pointer"
              >
                {t.nav.depths}
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('gun')}
                className="block py-0.5 hover:text-[var(--tx)] transition-colors text-left cursor-pointer"
              >
                {t.nav.whatItDoes}
              </button>
              <button
                type="button"
                onClick={openBenchmarks}
                className="block py-0.5 hover:text-[var(--tx)] transition-colors text-left cursor-pointer"
              >
                {l.benchmarksCta}
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('sss')}
                className="block py-0.5 hover:text-[var(--tx)] transition-colors text-left cursor-pointer"
              >
                {t.nav.faq}
              </button>
            </div>
          </div>

          <div>
            <h5 className="font-semibold text-[var(--tx)] text-xs mb-3.5">
              {l.footerLegalHeading}
            </h5>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => onOpenLegal('gizlilik')}
                className="block py-0.5 hover:text-[var(--tx)] transition-colors text-left cursor-pointer"
              >
                {l.footerPrivacy}
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('sartlar')}
                className="block py-0.5 hover:text-[var(--tx)] transition-colors text-left cursor-pointer"
              >
                {l.footerTerms}
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('kvkk')}
                className="block py-0.5 hover:text-[var(--tx)] transition-colors text-left cursor-pointer"
              >
                {l.footerKvkk}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 border-t border-[var(--bd)]/75 flex flex-wrap items-center justify-between gap-4">
          <span>{l.footerCopyright}</span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <LongclawLogo className="w-[17px] h-[17px] text-[var(--tx)] shrink-0" />
            <span>{l.poweredBy}</span>
          </span>
        </div>
      </motion.footer>
    </div>
  );
}
