import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { RotateCw, LogOut } from 'lucide-react';
import { LongclawLogo } from './Icons';
import { Language } from '../lib/i18n';
import { LIQUID_EASE } from '../lib/motion';
import { syncUserProfile, testConnection } from '../lib/firebase';
import { apiUrl, isStaticHostWithoutBackend } from '../lib/api';

interface LoginLoadingScreenProps {
  theme: 'light' | 'dark';
  lang: Language;
  /** True while Firebase is still resolving initial auth state on page load */
  authResolving: boolean;
  /** Authenticated user once Firebase resolves */
  user: User | null;
  /** True once Firestore has delivered the initial chats snapshot for this user */
  chatsReady: boolean;
  /** Called once every pre-entry check finishes */
  onComplete: () => void;
  /** Optional escape hatch if auth verification fails fatally */
  onSignOut?: () => void;
}

type CheckPhase = 'boot' | 'session' | 'sync' | 'workspace' | 'ready' | 'error';

const PHASE_LABELS: Record<Language, Record<CheckPhase, string>> = {
  en: {
    boot: 'Starting Longclaw…',
    session: 'Verifying your account…',
    sync: 'Syncing your conversations…',
    workspace: 'Checking AI workspace…',
    ready: "You're all set",
    error: 'Could not verify your session.',
  },
  tr: {
    boot: 'Longclaw başlatılıyor…',
    session: 'Hesabın doğrulanıyor…',
    sync: 'Sohbetlerin eşitleniyor…',
    workspace: 'Çalışma alanı kontrol ediliyor…',
    ready: 'Her şey hazır',
    error: 'Oturumun doğrulanamadı.',
  },
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);

    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

export function LoginLoadingScreen({
  theme,
  lang,
  authResolving,
  user,
  chatsReady,
  onComplete,
  onSignOut,
}: LoginLoadingScreenProps) {
  const [phase, setPhase] = useState<CheckPhase>(authResolving ? 'boot' : 'session');
  const [retryTick, setRetryTick] = useState(0);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const chatsReadyRef = useRef(chatsReady);
  chatsReadyRef.current = chatsReady;
  const chatsResolversRef = useRef<Array<() => void>>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (chatsReady && chatsResolversRef.current.length > 0) {
      const resolvers = chatsResolversRef.current.splice(0);
      resolvers.forEach((fn) => fn());
    }
  }, [chatsReady]);

  useEffect(() => {
    if (authResolving) {
      setPhase('boot');
      setErrorDetail(null);
      return;
    }

    if (!user) {
      return;
    }

    let cancelled = false;

    const waitForChatsReady = (timeoutMs: number) =>
      new Promise<void>((resolve) => {
        if (chatsReadyRef.current) {
          resolve();
          return;
        }
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          resolve();
        };
        const timer = window.setTimeout(finish, timeoutMs);
        chatsResolversRef.current.push(finish);
      });

    const runChecks = async () => {
      const startedAt = Date.now();
      setErrorDetail(null);
      setPhase('session');

      try {
        // 1. Verify active Firebase auth token & sync user profile in Firestore
        let tokenValid = false;
        try {
          const token = await withTimeout(user.getIdToken(false), 3500, '');
          tokenValid = Boolean(token);
        } catch {
          tokenValid = false;
        }

        if (!tokenValid && typeof navigator !== 'undefined' && navigator.onLine === false) {
          if (!cancelled) {
            setPhase('error');
            setErrorDetail(
              lang === 'tr'
                ? 'İnternet bağlantın yok. Bağlandıktan sonra tekrar dene.'
                : 'You appear to be offline. Reconnect and try again.'
            );
          }
          return;
        }

        await withTimeout(syncUserProfile(user), 2500, undefined);
        if (cancelled) return;

        // 2. Verify Firestore connectivity & wait for initial user chats snapshot
        setPhase('sync');
        await Promise.all([
          withTimeout(testConnection(), 2200, undefined),
          waitForChatsReady(2800),
        ]);
        if (cancelled) return;

        // 3. Check live AI backend readiness & workspace configuration
        setPhase('workspace');
        if (!isStaticHostWithoutBackend()) {
          const controller = new AbortController();
          const healthTimer = window.setTimeout(() => controller.abort(), 2500);
          try {
            await fetch(apiUrl('/api/health'), {
              method: 'GET',
              cache: 'no-store',
              signal: controller.signal,
            });
          } catch {
            // Non-blocking: allow workspace entry even if a transient health check times out
          } finally {
            window.clearTimeout(healthTimer);
          }
        }
        if (cancelled) return;

        // Ensure a calm, clearly visible reveal duration so the checks never flash by
        const elapsed = Date.now() - startedAt;
        const minDurationMs = 1500;
        if (elapsed < minDurationMs) {
          await new Promise((r) => window.setTimeout(r, minDurationMs - elapsed));
        }
        if (cancelled) return;

        setPhase('ready');
        await new Promise((r) => window.setTimeout(r, 720));
        if (!cancelled) {
          onCompleteRef.current();
        }
      } catch {
        if (!cancelled) {
          setPhase('error');
          setErrorDetail(
            lang === 'tr'
              ? 'Kontrol sırasında beklenmedik bir hata oluştu.'
              : 'An unexpected error occurred while checking your account.'
          );
        }
      }
    };

    void runChecks();

    return () => {
      cancelled = true;
    };
  }, [authResolving, user?.uid, retryTick, lang]);

  const isDark = theme === 'dark';
  const label = PHASE_LABELS[lang][phase];

  return (
    <motion.div
      key="longclaw-login-loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: LIQUID_EASE }}
      role="status"
      aria-live="polite"
      aria-busy={phase !== 'error'}
      className={`fixed inset-0 z-[100] h-[100dvh] w-screen flex flex-col items-center justify-between px-6 pt-[18vh] pb-[15vh] sm:pt-[20vh] sm:pb-[17vh] select-none ${
        isDark ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      {/* Top-Middle: Prominent Centered Brand Logo */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: LIQUID_EASE }}
        className="w-full flex flex-col items-center justify-center text-center"
      >
        <LongclawLogo className="w-24 h-24 sm:w-28 sm:h-28" />
      </motion.div>

      {/* Center breathing space */}
      <div className="flex-1 min-h-[48px]" aria-hidden="true" />

      {/* Bottom-Middle: Crisp Loading Circle + Verification Status */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: LIQUID_EASE }}
        className="w-full flex flex-col items-center justify-center gap-4 text-center"
      >
        {phase === 'error' ? (
          <div className="flex flex-col items-center gap-3.5 max-w-xs">
            <p className="text-sm font-medium">{errorDetail || label}</p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setRetryTick((n) => n + 1)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-opacity hover:opacity-85 cursor-pointer ${
                  isDark ? 'bg-white text-black' : 'bg-black text-white'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{lang === 'tr' ? 'Tekrar dene' : 'Try again'}</span>
              </button>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-opacity hover:opacity-80 cursor-pointer ${
                    isDark
                      ? 'border-white/25 text-white/85'
                      : 'border-black/20 text-black/80'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'tr' ? 'Çıkış yap' : 'Sign out'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Precision Circular Loading Ring -> Self-Drawing Ready Tick */}
            <div className="relative w-12 h-12 sm:w-[54px] sm:h-[54px] flex items-center justify-center" aria-hidden="true">
              <AnimatePresence mode="wait">
                {phase === 'ready' ? (
                  <motion.svg
                    key="ready-tick"
                    viewBox="0 0 48 48"
                    fill="none"
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: [0.85, 1.06, 1], opacity: 1 }}
                    transition={{ duration: 0.42, ease: LIQUID_EASE }}
                    className="w-full h-full text-emerald-500"
                  >
                    <motion.circle
                      cx="24"
                      cy="24"
                      r="19"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.34, ease: LIQUID_EASE }}
                    />
                    <motion.path
                      d="M15.5 24.6L21.5 30.4L33 18.2"
                      stroke="currentColor"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.34, delay: 0.16, ease: LIQUID_EASE }}
                    />
                  </motion.svg>
                ) : (
                  <motion.div
                    key="loading-ring"
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18 }}
                    className="w-full h-full"
                  >
                    <motion.svg
                      viewBox="0 0 48 48"
                      fill="none"
                      className="w-full h-full"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                    >
                      <circle
                        cx="24"
                        cy="24"
                        r="19"
                        stroke="currentColor"
                        strokeOpacity={isDark ? 0.2 : 0.16}
                        strokeWidth="3.2"
                      />
                      <path
                        d="M24 5A19 19 0 0 1 43 24"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                      />
                    </motion.svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-6 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: phase === 'ready' ? 1 : 0.65, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.22, ease: LIQUID_EASE }}
                  className={
                    phase === 'ready'
                      ? 'text-sm font-semibold tracking-tight'
                      : 'text-xs font-medium tracking-[0.01em]'
                  }
                >
                  {label}
                </motion.p>
              </AnimatePresence>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
