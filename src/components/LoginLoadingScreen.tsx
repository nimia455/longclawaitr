import React from 'react';
import { motion } from 'motion/react';
import { LongclawLogo } from './Icons';
import { Language } from '../lib/i18n';
import { LIQUID_EASE } from '../lib/motion';

interface LoginLoadingScreenProps {
  lang: Language;
}

/**
 * Lightweight, zero-delay monochrome splash shown strictly while Firebase Auth
 * resolves any persisted session on initial page load (typically ~50-200ms).
 * Never runs blocking network waterfalls or artificial timers.
 */
export function LoginLoadingScreen({ lang }: LoginLoadingScreenProps) {
  const label = lang === 'tr' ? 'Longclaw başlatılıyor…' : 'Starting Longclaw…';

  return (
    <motion.div
      key="longclaw-login-loading-screen"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: LIQUID_EASE }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] h-[100dvh] w-screen flex flex-col items-center justify-center gap-6 px-6 select-none bg-[var(--bg)] text-[var(--tx)]"
    >
      <LongclawLogo className="w-16 h-16 sm:w-20 sm:h-20" />

      <div className="flex flex-col items-center gap-3">
        <div className="relative w-8 h-8 flex items-center justify-center" aria-hidden="true">
          <motion.svg
            viewBox="0 0 36 36"
            fill="none"
            className="w-full h-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          >
            <circle cx="18" cy="18" r="14" stroke="var(--bd)" strokeWidth="2.5" />
            <path
              d="M18 4A14 14 0 0 1 32 18"
              stroke="var(--tx)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </motion.svg>
        </div>

        <p className="text-xs font-medium tracking-[0.01em] text-[var(--mut)]">{label}</p>
      </div>
    </motion.div>
  );
}
