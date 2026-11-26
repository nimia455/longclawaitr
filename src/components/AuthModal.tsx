import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Check,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getAdditionalUserInfo } from 'firebase/auth';
import {
  EDITORIAL_EASE,
  LIQUID_EASE,
  MODAL_BACKDROP_ENTER,
  MODAL_BACKDROP_EXIT,
  MODAL_SHEET_ENTER,
  MODAL_SHEET_EXIT,
} from '../lib/motion';
import {
  auth,
  googleProvider,
  appleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  verifyPasswordResetCode,
  confirmPasswordReset,
  syncUserProfile,
} from '../lib/firebase';
import { GoogleIcon, AppleIcon, LongclawLogo } from './Icons';
import { LegalDocType } from './LegalModal';
import { Language, TRANSLATIONS } from '../lib/i18n';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: 'in' | 'up';
  initialResetCode?: string | null;
  lang: Language;
  onClose: () => void;
  onSuccess: () => void;
  onOpenLegal: (type: LegalDocType) => void;
  onAuthFlowPendingChange?: (pending: boolean) => void;
}

type AuthViewMode = 'email' | 'forgot' | 'created';
type BusyAction = 'google' | 'apple' | 'email' | 'reset-send' | 'reset-confirm' | null;

/**
 * Smooth, zero-jank accordion row powered by CSS Grid interpolation.
 * Synchronizes frame-for-frame with the segmented tab indicator and
 * occupies 0px height with zero phantom margin when closed.
 */
function SmoothCollapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      className={`-mx-1 grid transition-[grid-template-rows,opacity] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
      }`}
    >
      <div className="overflow-hidden px-1">
        <div
          className={`transition-transform duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? 'translate-y-0' : '-translate-y-1'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir * 16,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -14,
  }),
};

export function AuthModal({
  isOpen,
  initialTab = 'in',
  initialResetCode = null,
  lang,
  onClose,
  onSuccess,
  onOpenLegal,
  onAuthFlowPendingChange,
}: AuthModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const t = TRANSLATIONS[lang];
  const a = t.auth;
  const errs = a.errors;

  const [viewMode, setViewMode] = useState<AuthViewMode>(initialResetCode ? 'forgot' : 'email');
  const [viewDirection, setViewDirection] = useState<1 | -1>(1);
  const [tab, setTab] = useState<'in' | 'up'>(initialTab);
  const [createdName, setCreatedName] = useState('');

  // Email/Password states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [acceptTos, setAcceptTos] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password + email verification states
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>(
    initialResetCode ? 'verify' : 'request'
  );
  const [forgotDirection, setForgotDirection] = useState<1 | -1>(1);
  const [resetCode, setResetCode] = useState(initialResetCode || '');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [verifiedResetEmail, setVerifiedResetEmail] = useState<string | null>(null);

  // General UI states
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loading = busyAction !== null;
  const wasOpenRef = useRef(false);
  const celebrationTimerRef = useRef<number | null>(null);

  const finishAccountCreationCelebration = () => {
    if (celebrationTimerRef.current !== null) {
      window.clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }
    onAuthFlowPendingChange?.(false);
    onSuccess();
  };

  const triggerAccountCreatedCelebration = (displayName?: string | null) => {
    setCreatedName((displayName || '').trim());
    setViewDirection(1);
    setViewMode('created');
    onAuthFlowPendingChange?.(true);
    if (celebrationTimerRef.current !== null) {
      window.clearTimeout(celebrationTimerRef.current);
    }
    celebrationTimerRef.current = window.setTimeout(() => {
      finishAccountCreationCelebration();
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = null;
      }
      onAuthFlowPendingChange?.(false);
    };
  }, [onAuthFlowPendingChange]);

  // Cleanly initialize state every time the modal opens fresh
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setTab(initialTab);
      setError(null);
      setInfo(null);
      setShowPassword(false);
      setShowNewPassword(false);
      setBusyAction(null);
      setCreatedName('');
      if (initialResetCode) {
        setViewMode('forgot');
        setForgotStep('verify');
        setResetCode(initialResetCode);
      } else {
        setViewMode('email');
        setForgotStep('request');
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialTab, initialResetCode]);

  // Keep reset deep-link synced if triggered while already open
  useEffect(() => {
    if (initialResetCode) {
      setViewDirection(1);
      setViewMode('forgot');
      setForgotDirection(1);
      setForgotStep('verify');
      setResetCode(initialResetCode);
    }
  }, [initialResetCode]);

  // Prevent background page scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const handleSwitchTab = (nextTab: 'in' | 'up') => {
    if (nextTab === tab) return;
    setTab(nextTab);
    resetMessages();
  };

  const handleOpenForgot = () => {
    setViewDirection(1);
    setForgotDirection(1);
    setViewMode('forgot');
    setForgotStep('request');
    resetMessages();
  };

  const handleBackToEmail = () => {
    setViewDirection(-1);
    setViewMode('email');
    setForgotStep('request');
    resetMessages();
  };

  const handleGoogleSignIn = async () => {
    try {
      setBusyAction('google');
      resetMessages();
      if (tab === 'up') {
        onAuthFlowPendingChange?.(true);
      }
      const res = await signInWithPopup(auth, googleProvider);
      const isNewUser = Boolean(getAdditionalUserInfo(res)?.isNewUser);
      if (res.user) {
        await syncUserProfile(res.user);
      }
      if (isNewUser || tab === 'up') {
        triggerAccountCreatedCelebration(res.user?.displayName);
      } else {
        onAuthFlowPendingChange?.(false);
        onSuccess();
      }
    } catch (err: any) {
      onAuthFlowPendingChange?.(false);
      console.error('Google auth error:', err);
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      if (err.code === 'auth/unauthorized-domain') {
        setError(
          lang === 'tr'
            ? `"${host}" alan adı Firebase Yetkili Alan Adları listesinde yok. Firebase Console → Authentication → Settings → Authorized domains bölümüne ekleyin.`
            : `Domain "${host}" is not authorized in Firebase yet. Add it under Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError(errs.popupClosed);
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError(errs.accountExistsDifferentCred);
      } else {
        setError(err.message || errs.googleGeneric);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setBusyAction('apple');
      resetMessages();
      if (tab === 'up') {
        onAuthFlowPendingChange?.(true);
      }
      const res = await signInWithPopup(auth, appleProvider);
      const isNewUser = Boolean(getAdditionalUserInfo(res)?.isNewUser);
      if (res.user) {
        await syncUserProfile(res.user);
      }
      if (isNewUser || tab === 'up') {
        triggerAccountCreatedCelebration(res.user?.displayName);
      } else {
        onAuthFlowPendingChange?.(false);
        onSuccess();
      }
    } catch (err: any) {
      onAuthFlowPendingChange?.(false);
      console.error('Apple auth error:', err);
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      if (err.code === 'auth/unauthorized-domain') {
        setError(
          lang === 'tr'
            ? `"${host}" alan adı Firebase Yetkili Alan Adları listesinde yok. Firebase Console → Authentication → Settings → Authorized domains bölümüne ekleyin.`
            : `Domain "${host}" is not authorized in Firebase yet. Add it under Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError(errs.applePopupClosed);
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(errs.appleNotAllowed);
      } else {
        setError(err.message || errs.appleGeneric);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError(errs.invalidEmail);
      return;
    }

    if (password.length < 6) {
      setError(errs.shortPassword);
      return;
    }

    if (tab === 'up' && !acceptTos) {
      setError(errs.acceptTos);
      return;
    }

    try {
      setBusyAction('email');
      if (tab === 'up') {
        // Hold modal transition so the account-created tick celebration plays smoothly
        onAuthFlowPendingChange?.(true);
        const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (name.trim()) {
          await updateProfile(res.user, { displayName: name.trim() });
        }
        try {
          await sendEmailVerification(res.user);
        } catch (verifyErr) {
          console.warn('Email verification dispatch error:', verifyErr);
        }
        await syncUserProfile(res.user);
        triggerAccountCreatedCelebration(name.trim() || res.user.displayName);
      } else {
        const res = await signInWithEmailAndPassword(auth, cleanEmail, password);
        await syncUserProfile(res.user);
        onSuccess();
      }
    } catch (err: any) {
      onAuthFlowPendingChange?.(false);
      console.error('Email auth error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError(errs.emailInUse);
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError(errs.invalidCredential);
      } else if (err.code === 'auth/user-not-found') {
        setError(errs.userNotFound);
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(errs.operationNotAllowed);
      } else {
        setError(err.message || errs.genericAuth);
      }
    } finally {
      setBusyAction(null);
    }
  };

  // Forgot password Step 1: Send verification & reset email
  const handleSendPasswordReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    resetMessages();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError(errs.invalidEmailReset);
      return;
    }

    try {
      setBusyAction('reset-send');
      await sendPasswordResetEmail(auth, cleanEmail);
      setForgotDirection(1);
      setForgotStep('verify');
      setInfo(errs.resetSentInfo(cleanEmail));
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError(errs.resetUserNotFound);
      } else {
        setError(errs.resetSendFailed(err.message || errs.genericAuth));
      }
    } finally {
      setBusyAction(null);
    }
  };

  // Forgot password Step 2: Verify email oobCode and confirm new password
  const handleConfirmResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    let cleanCode = resetCode.trim();
    if (cleanCode.includes('oobCode=')) {
      try {
        const parsed = new URL(cleanCode);
        cleanCode = parsed.searchParams.get('oobCode') || cleanCode;
      } catch {
        const match = cleanCode.match(/oobCode=([^&]+)/);
        if (match) cleanCode = decodeURIComponent(match[1]);
      }
    }

    if (!cleanCode) {
      setError(errs.missingResetCode);
      return;
    }

    if (newPassword.length < 6) {
      setError(errs.shortNewPassword);
      return;
    }

    try {
      setBusyAction('reset-confirm');
      const verifiedEmail = await verifyPasswordResetCode(auth, cleanCode);
      setVerifiedResetEmail(verifiedEmail);
      await confirmPasswordReset(auth, cleanCode, newPassword);
      setInfo(errs.resetSuccessInfo(verifiedEmail));
      setEmail(verifiedEmail);
      setPassword('');
      setNewPassword('');
      setResetCode('');
      setTimeout(() => {
        setViewDirection(-1);
        setViewMode('email');
        setTab('in');
        setForgotStep('request');
      }, 1500);
    } catch (err: any) {
      console.error('Reset verification error:', err);
      if (err.code === 'auth/expired-action-code') {
        setError(errs.expiredActionCode);
      } else if (err.code === 'auth/invalid-action-code') {
        setError(errs.invalidActionCode);
      } else {
        setError(err.message || errs.resetVerifyFailed);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const headerKey = viewMode === 'forgot' ? 'forgot' : tab;
  const headerTitle =
    viewMode === 'forgot' ? a.titleForgot : tab === 'up' ? a.titleSignUp : a.titleSignIn;
  const headerSubtitle =
    viewMode === 'forgot'
      ? a.subtitle
      : tab === 'up'
        ? a.subtitleSignUp
        : a.subtitleSignIn;
  const passwordMeetsMin = password.length >= 6;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="auth-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: MODAL_BACKDROP_ENTER }}
          exit={{ opacity: 0, transition: MODAL_BACKDROP_EXIT }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/52 dark:bg-black/68"
          onClick={onClose}
        >
          <motion.div
            key="auth-modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: MODAL_SHEET_ENTER }}
            exit={{ opacity: 0, y: 8, scale: 0.985, transition: MODAL_SHEET_EXIT }}
            className="surface-3d-elevated w-full max-w-[424px] max-h-[90dvh] overflow-y-auto overflow-x-hidden text-[var(--tx)] rounded-3xl p-6 sm:p-7 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {viewMode !== 'created' && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer"
                aria-label={t.common.close}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            )}

            {/* Quiet brand mark & tailored editorial heading (hidden during full-focus created celebration) */}
            {viewMode !== 'created' && (
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-11 h-11 rounded-full bg-[var(--surf)] border border-[var(--bd)] flex items-center justify-center mb-3.5">
                  <LongclawLogo className="w-[22px] h-[22px] text-[var(--tx)]" />
                </div>

                <div className="min-h-[52px] flex flex-col justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={headerKey}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: LIQUID_EASE }}
                    >
                      <h3
                        id="auth-modal-title"
                        className="text-[24px] leading-tight font-semibold tracking-[-0.025em]"
                      >
                        {headerTitle}
                      </h3>
                      <p className="text-xs text-[var(--mut)] mt-1">{headerSubtitle}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div className="overflow-x-hidden">
              <AnimatePresence mode="wait" initial={false} custom={viewDirection}>
                {/* Celebration View: Animated Tick + "You're all set" */}
                {viewMode === 'created' ? (
                  <motion.div
                    key="created-celebration-view"
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.32, ease: EDITORIAL_EASE }}
                    role="status"
                    aria-live="polite"
                    className="py-10 px-2 flex flex-col items-center justify-center text-center"
                  >
                    {/* Animated Tick Circle + Expanding Ripple + Subtle Radial Burst */}
                    <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                      {/* Crisp Expanding Halo Ring (zero blur) */}
                      {!prefersReducedMotion && (
                        <motion.span
                          initial={{ scale: 0.72, opacity: 0.55 }}
                          animate={{ scale: 1.48, opacity: 0 }}
                          transition={{ duration: 0.88, delay: 0.28, ease: EDITORIAL_EASE }}
                          className="pointer-events-none absolute inset-1 rounded-full border border-emerald-500/70"
                          aria-hidden="true"
                        />
                      )}

                      {/* 8 Minimal Radial Accent Ticks */}
                      {!prefersReducedMotion && (
                        <svg
                          viewBox="0 0 112 112"
                          className="pointer-events-none absolute -inset-2 w-[112px] h-[112px]"
                          aria-hidden="true"
                        >
                          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                            <motion.line
                              key={deg}
                              x1="56"
                              y1="10"
                              x2="56"
                              y2="16"
                              stroke="var(--ac)"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              transform={`rotate(${deg} 56 56)`}
                              initial={{ opacity: 0, scaleY: 0.4 }}
                              animate={{ opacity: [0, 0.75, 0], scaleY: [0.4, 1, 0.7] }}
                              transition={{
                                duration: 0.72,
                                delay: 0.34,
                                ease: EDITORIAL_EASE,
                              }}
                            />
                          ))}
                        </svg>
                      )}

                      {/* Filled Circle Scale-In + Self-Drawing Tick SVG */}
                      <motion.div
                        initial={prefersReducedMotion ? false : { scale: 0.78 }}
                        animate={{ scale: [0.78, 1.06, 1] }}
                        transition={{
                          duration: 0.52,
                          times: [0, 0.65, 1],
                          ease: EDITORIAL_EASE,
                        }}
                        className="w-20 h-20 rounded-full bg-emerald-500/12 border border-emerald-500/35 flex items-center justify-center"
                      >
                        <svg
                          viewBox="0 0 56 56"
                          className="w-14 h-14 text-emerald-600 dark:text-emerald-400"
                          fill="none"
                          aria-hidden="true"
                        >
                          <motion.circle
                            cx="28"
                            cy="28"
                            r="24"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.48, ease: EDITORIAL_EASE }}
                          />
                          <motion.path
                            d="M17.5 28.8L24.8 36L39 20.8"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.42, delay: 0.28, ease: EDITORIAL_EASE }}
                          />
                        </svg>
                      </motion.div>
                    </div>

                    {/* "You're all set" directly underneath the tick */}
                    <motion.h3
                      id="auth-modal-title"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.36, ease: EDITORIAL_EASE }}
                      className="text-2xl font-semibold tracking-[-0.025em] text-[var(--tx)]"
                    >
                      {lang === 'tr' ? 'Her şey hazır' : "You're all set"}
                    </motion.h3>

                    <motion.p
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: 0.46, ease: EDITORIAL_EASE }}
                      className="mt-2 text-sm text-[var(--mut)] max-w-xs leading-relaxed"
                    >
                      {lang === 'tr'
                        ? createdName
                          ? `Longclaw'a hoş geldin, ${createdName}. Çalışma alanın açılıyor…`
                          : "Longclaw'a hoş geldin. Çalışma alanın açılıyor…"
                        : createdName
                          ? `Welcome to Longclaw, ${createdName}. Opening your workspace…`
                          : 'Welcome to Longclaw. Opening your workspace…'}
                    </motion.p>

                    <motion.button
                      type="button"
                      onClick={finishAccountCreationCelebration}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.36, delay: 0.62, ease: EDITORIAL_EASE }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                      className="mt-7 px-6 py-2.5 rounded-full bg-[var(--ac)] text-[var(--on)] hover:opacity-92 text-xs font-medium transition-opacity cursor-pointer"
                    >
                      {lang === 'tr' ? 'Çalışma alanına geç' : 'Continue to workspace'}
                    </motion.button>
                  </motion.div>
                ) : viewMode === 'forgot' ? (
                  <motion.div
                    key="forgot-view"
                    custom={viewDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: LIQUID_EASE }}
                    className="space-y-4"
                  >
                    <button
                      type="button"
                      onClick={handleBackToEmail}
                      className="inline-flex items-center gap-1.5 text-xs text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{a.backToSignIn}</span>
                    </button>

                    <AnimatePresence mode="wait" initial={false} custom={forgotDirection}>
                      {forgotStep === 'request' ? (
                        <motion.form
                          key="forgot-request"
                          custom={forgotDirection}
                          variants={slideVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ duration: 0.18, ease: LIQUID_EASE }}
                          onSubmit={handleSendPasswordReset}
                        >
                          <p className="text-xs text-[var(--mut)] leading-relaxed pb-3.5">
                            {a.forgotDesc}
                          </p>

                          <div className="pb-3">
                            <div className="relative">
                              <Mail className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="email"
                                placeholder={a.emailPlaceholder}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                                className="well-3d w-full pl-10 pr-4 py-3 sm:py-2.5 rounded-xl text-[var(--tx)] placeholder:text-[var(--mut)] text-base sm:text-sm outline-none focus:border-[var(--tx)] transition-colors"
                              />
                            </div>
                          </div>

                          <SmoothCollapse open={Boolean(error)}>
                            <div className="pb-3">
                              <div
                                role="alert"
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs"
                              >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                              </div>
                            </div>
                          </SmoothCollapse>

                          <SmoothCollapse open={Boolean(info)}>
                            <div className="pb-3">
                              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>{info}</span>
                              </div>
                            </div>
                          </SmoothCollapse>

                          <button
                            type="submit"
                            disabled={loading}
                            className="btn-3d-primary w-full py-2.5 rounded-full font-medium text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                          >
                            {busyAction === 'reset-send' && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            <span>{busyAction === 'reset-send' ? a.sending : a.sendVerificationEmail}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setForgotDirection(1);
                              setForgotStep('verify');
                              resetMessages();
                            }}
                            className="w-full text-center text-xs text-[var(--mut)] hover:text-[var(--tx)] transition-colors pt-3.5 cursor-pointer"
                          >
                            {a.haveCodePrompt}
                          </button>
                        </motion.form>
                      ) : (
                        <motion.form
                          key="forgot-verify"
                          custom={forgotDirection}
                          variants={slideVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ duration: 0.18, ease: LIQUID_EASE }}
                          onSubmit={handleConfirmResetCode}
                        >
                          <div className="p-3 rounded-xl bg-[var(--surf)] border border-[var(--bd)] text-xs text-[var(--mut)] space-y-1 mb-3">
                            <div className="flex items-center gap-1.5 text-[var(--tx)] font-medium">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span>{a.verificationStepTitle}</span>
                            </div>
                            <p className="leading-relaxed">
                              {verifiedResetEmail
                                ? a.verificationStepVerified(verifiedResetEmail)
                                : a.verificationStepDefault}
                            </p>
                          </div>

                          <div className="pb-3">
                            <div className="relative">
                              <KeyRound className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                placeholder={a.codePlaceholder}
                                value={resetCode}
                                onChange={(e) => setResetCode(e.target.value)}
                                required
                                className="well-3d w-full pl-10 pr-4 py-3 sm:py-2.5 rounded-xl text-[var(--tx)] placeholder:text-[var(--mut)] text-base sm:text-sm outline-none focus:border-[var(--tx)] transition-colors"
                              />
                            </div>
                          </div>

                          <div className="pb-3">
                            <div className="relative">
                              <Lock className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type={showNewPassword ? 'text' : 'password'}
                                placeholder={a.newPasswordPlaceholder}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                                className="well-3d w-full pl-10 pr-11 py-3 sm:py-2.5 rounded-xl text-[var(--tx)] placeholder:text-[var(--mut)] text-base sm:text-sm outline-none focus:border-[var(--tx)] transition-colors"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword((prev) => !prev)}
                                aria-label={showNewPassword ? a.hidePassword : a.showPassword}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                              >
                                {showNewPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <SmoothCollapse open={Boolean(error)}>
                            <div className="pb-3">
                              <div
                                role="alert"
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs"
                              >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                              </div>
                            </div>
                          </SmoothCollapse>

                          <SmoothCollapse open={Boolean(info)}>
                            <div className="pb-3">
                              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>{info}</span>
                              </div>
                            </div>
                          </SmoothCollapse>

                          <button
                            type="submit"
                            disabled={loading}
                            className="btn-3d-primary w-full py-2.5 rounded-full font-medium text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                          >
                            {busyAction === 'reset-confirm' && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            <span>
                              {busyAction === 'reset-confirm'
                                ? a.verifying
                                : a.verifyAndUpdatePassword}
                            </span>
                          </button>

                          {email && (
                            <button
                              type="button"
                              onClick={() => handleSendPasswordReset()}
                              disabled={loading}
                              className="w-full text-center text-xs text-[var(--mut)] hover:text-[var(--tx)] transition-colors pt-3.5 cursor-pointer"
                            >
                              {a.resendVerificationEmail}
                            </button>
                          )}
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  /* Default View: Social + Email/Password */
                  <motion.div
                    key="email-view"
                    custom={viewDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: LIQUID_EASE }}
                  >
                    {/* Social Logins */}
                    <div className="space-y-2.5 mb-5">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="btn-3d-soft w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full font-medium text-sm disabled:opacity-50 cursor-pointer"
                      >
                        {busyAction === 'google' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <GoogleIcon className="w-4 h-4" />
                        )}
                        <span>{a.continueWithGoogle}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAppleSignIn}
                        disabled={loading}
                        className="btn-3d-soft w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full font-medium text-sm disabled:opacity-50 cursor-pointer"
                      >
                        {busyAction === 'apple' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <AppleIcon className="w-4 h-4" />
                        )}
                        <span>{a.continueWithApple}</span>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="relative flex items-center justify-center my-4">
                      <div className="w-full border-t border-[var(--bd)]" />
                      <span className="absolute px-3 bg-[var(--card)] text-xs text-[var(--mut)]">
                        {a.orWithEmail}
                      </span>
                    </div>

                    {/* Pure GPU-Composited Segmented Auth Mode Switch (Zero layoutId jump, zero squish) */}
                    <div
                      role="tablist"
                      aria-label={a.titleDefault}
                      className="segmented-track-3d relative grid grid-cols-2 p-1 rounded-full mb-4 select-none"
                    >
                      <span
                        aria-hidden="true"
                        className="segmented-thumb-3d pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
                        style={{
                          transform: tab === 'up' ? 'translateX(100%)' : 'translateX(0%)',
                        }}
                      />
                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'in'}
                        onClick={() => handleSwitchTab('in')}
                        className={`relative z-10 py-1.5 rounded-full text-xs transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                          tab === 'in'
                            ? 'text-[var(--tx)] font-semibold'
                            : 'text-[var(--mut)] hover:text-[var(--tx)] font-medium'
                        }`}
                      >
                        {a.tabSignIn}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'up'}
                        onClick={() => handleSwitchTab('up')}
                        className={`relative z-10 py-1.5 rounded-full text-xs transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                          tab === 'up'
                            ? 'text-[var(--tx)] font-semibold'
                            : 'text-[var(--mut)] hover:text-[var(--tx)] font-medium'
                        }`}
                      >
                        {a.tabSignUp}
                      </button>
                    </div>

                    {/* Form with synchronized zero-jump field transitions */}
                    <form onSubmit={handleEmailAuth} noValidate>
                      {/* Name field — smoothly unfolds only in Sign Up */}
                      <SmoothCollapse open={tab === 'up'}>
                        <div className="pb-3 pt-0.5">
                          <div className="relative">
                            <UserIcon className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              placeholder={a.namePlaceholder}
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              autoComplete="name"
                              tabIndex={tab === 'up' ? 0 : -1}
                              className="well-3d w-full pl-10 pr-4 py-3 sm:py-2.5 rounded-xl text-[var(--tx)] placeholder:text-[var(--mut)] text-base sm:text-sm outline-none focus:border-[var(--tx)] transition-colors"
                            />
                          </div>
                        </div>
                      </SmoothCollapse>

                      {/* Email */}
                      <div className="pb-3">
                        <div className="relative">
                          <Mail className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="email"
                            placeholder={a.emailShortPlaceholder}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                            className="well-3d w-full pl-10 pr-4 py-3 sm:py-2.5 rounded-xl text-[var(--tx)] placeholder:text-[var(--mut)] text-base sm:text-sm outline-none focus:border-[var(--tx)] transition-colors"
                          />
                        </div>
                      </div>

                      {/* Password with accessible show/hide toggle */}
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={a.passwordPlaceholder}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete={tab === 'up' ? 'new-password' : 'current-password'}
                          required
                          className="well-3d w-full pl-10 pr-11 py-3 sm:py-2.5 rounded-xl text-[var(--tx)] placeholder:text-[var(--mut)] text-base sm:text-sm outline-none focus:border-[var(--tx)] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? a.hidePassword : a.showPassword}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Sign-in row: Forgot password link */}
                      <SmoothCollapse open={tab === 'in'}>
                        <div className="flex justify-end pt-2.5">
                          <button
                            type="button"
                            tabIndex={tab === 'in' ? 0 : -1}
                            onClick={handleOpenForgot}
                            className="text-xs text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                          >
                            {a.forgotPasswordLink}
                          </button>
                        </div>
                      </SmoothCollapse>

                      {/* Sign-up rows: Subtle password length cue + Terms checkbox */}
                      <SmoothCollapse open={tab === 'up'}>
                        <div className="pt-2.5 space-y-3">
                          <div
                            className={`flex items-center gap-1.5 text-[11.5px] transition-colors duration-200 ${
                              passwordMeetsMin
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-[var(--mut)]'
                            }`}
                          >
                            <Check
                              className={`w-3.5 h-3.5 transition-opacity duration-200 ${
                                passwordMeetsMin ? 'opacity-100' : 'opacity-45'
                              }`}
                            />
                            <span>{a.passwordMinHint}</span>
                          </div>

                          <label className="flex items-start gap-2.5 text-xs text-[var(--mut)] cursor-pointer leading-relaxed">
                            <input
                              type="checkbox"
                              checked={acceptTos}
                              onChange={(e) => setAcceptTos(e.target.checked)}
                              tabIndex={tab === 'up' ? 0 : -1}
                              className="mt-0.5 rounded border-[var(--bd)] accent-[var(--tx)] cursor-pointer"
                            />
                            <span>
                              {a.tosPrefix}
                              <button
                                type="button"
                                tabIndex={tab === 'up' ? 0 : -1}
                                onClick={() => onOpenLegal('sartlar')}
                                className="underline hover:text-[var(--tx)] text-[var(--tx)] font-medium cursor-pointer"
                              >
                                {a.tosTerms}
                              </button>
                              {a.tosAnd}
                              <button
                                type="button"
                                tabIndex={tab === 'up' ? 0 : -1}
                                onClick={() => onOpenLegal('gizlilik')}
                                className="underline hover:text-[var(--tx)] text-[var(--tx)] font-medium cursor-pointer"
                              >
                                {a.tosPrivacy}
                              </button>
                              {a.tosSuffix}
                            </span>
                          </label>
                        </div>
                      </SmoothCollapse>

                      {/* Error banner — smoothly unfolds */}
                      <SmoothCollapse open={Boolean(error)}>
                        <div className="pt-3">
                          <div
                            role="alert"
                            className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                          </div>
                        </div>
                      </SmoothCollapse>

                      {/* Info banner — smoothly unfolds */}
                      <SmoothCollapse open={Boolean(info)}>
                        <div className="pt-3">
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{info}</span>
                          </div>
                        </div>
                      </SmoothCollapse>

                      {/* Submit CTA */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-3d-primary w-full py-2.5 rounded-full font-medium text-sm disabled:opacity-50 cursor-pointer mt-4 flex items-center justify-center gap-2"
                      >
                        {busyAction === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={busyAction === 'email' ? 'busy' : tab}
                            initial={{ opacity: 0, y: 3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -3 }}
                            transition={{ duration: 0.14, ease: LIQUID_EASE }}
                          >
                            {busyAction === 'email'
                              ? a.processing
                              : tab === 'up'
                                ? a.createAccount
                                : a.signInBtn}
                          </motion.span>
                        </AnimatePresence>
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {viewMode !== 'created' && (
              <p className="text-[11px] text-[var(--mut)] text-center mt-5">{a.footerSecurity}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
