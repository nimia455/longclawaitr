import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Loader2,
  Mic,
  Repeat,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { VoiceCompanionEyes } from './VoiceCompanionEyes';
import { LongclawLogo } from './Icons';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { apiUrl, isStaticHostErrorResponse } from '../lib/api';
import { Language, TRANSLATIONS } from '../lib/i18n';
import { LIQUID_EASE, LIQUID_MORPH, LIQUID_TAP } from '../lib/motion';
import {
  detectCommandVisualCue,
  EyeShape,
  EyeShapePreference,
  getMoodDisplayLabel,
  getVoiceTtsStyle,
  VOICE_PERSONAS,
  VoiceMood,
  VoicePersonaName,
  VoicePhase,
} from '../lib/voiceCommandEngine';

interface VoiceHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface VoiceChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  history: VoiceHistoryItem[];
  onCommitExchange: (userText: string, assistantText: string) => void;
}

function EyeShapeMiniIcon({ pref }: { pref: EyeShapePreference }) {
  if (pref === 'round') {
    return (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
        <circle cx="8" cy="8" r="5.2" fill="currentColor" />
      </svg>
    );
  }
  if (pref === 'oval') {
    return (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
        <ellipse cx="8" cy="8" rx="3.7" ry="5.8" fill="currentColor" />
      </svg>
    );
  }
  if (pref === 'square') {
    return (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="2.4" fill="currentColor" />
      </svg>
    );
  }
  // Auto: trio of round + oval + square micro-shapes
  return (
    <svg viewBox="0 0 18 16" className="w-4 h-3.5" aria-hidden="true">
      <circle cx="3.3" cy="8" r="2.1" fill="currentColor" />
      <ellipse cx="9" cy="8" rx="1.6" ry="2.7" fill="currentColor" />
      <rect x="12.6" y="5.8" width="4.1" height="4.1" rx="1" fill="currentColor" />
    </svg>
  );
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function VoiceChatOverlay({
  isOpen,
  onClose,
  lang,
  history,
  onCommitExchange,
}: VoiceChatOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const vc = TRANSLATIONS[lang].chat.voiceChat;
  const closeLabel = TRANSLATIONS[lang].common.close;

  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [eyePreference, setEyePreference] = useState<EyeShapePreference>('auto');
  const [autoEyeShape, setAutoEyeShape] = useState<EyeShape>('round');
  const [mood, setMood] = useState<VoiceMood>('calm');
  const [voiceName, setVoiceName] = useState<VoicePersonaName>('Kore');
  const [isMuted, setIsMuted] = useState(false);
  const [handsFree, setHandsFree] = useState(false);

  const [lastUserText, setLastUserText] = useState('');
  const [lastAssistantText, setLastAssistantText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [outputLevel, setOutputLevel] = useState(0);
  const [gazeOffset, setGazeOffset] = useState({ x: 0, y: 0 });

  const localHistoryRef = useRef<VoiceHistoryItem[]>([]);
  const wasOpenRef = useRef(false);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const playbackAudioCtxRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackAudioElRef = useRef<HTMLAudioElement | null>(null);
  const playbackObjectUrlRef = useRef<string | null>(null);
  const playbackRafRef = useRef<number | null>(null);
  const speechSynthTimerRef = useRef<number | null>(null);
  const handsFreeTimerRef = useRef<number | null>(null);
  const isOpenRef = useRef(isOpen);
  const handsFreeRef = useRef(handsFree);
  const isMutedRef = useRef(isMuted);
  const voiceNameRef = useRef(voiceName);
  const eyePreferenceRef = useRef(eyePreference);
  const langRef = useRef(lang);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    voiceNameRef.current = voiceName;
  }, [voiceName]);
  useEffect(() => {
    eyePreferenceRef.current = eyePreference;
  }, [eyePreference]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // Seed local conversation history only on closed -> open transition (not on every parent commit)
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      localHistoryRef.current = history.slice(-12);
      setErrorMsg(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, history]);

  const stopPlayback = useCallback(() => {
    if (handsFreeTimerRef.current !== null) {
      window.clearTimeout(handsFreeTimerRef.current);
      handsFreeTimerRef.current = null;
    }
    if (playbackRafRef.current !== null) {
      cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
    if (speechSynthTimerRef.current !== null) {
      window.clearInterval(speechSynthTimerRef.current);
      speechSynthTimerRef.current = null;
    }
    if (playbackSourceRef.current) {
      try {
        playbackSourceRef.current.onended = null;
        playbackSourceRef.current.stop();
      } catch {}
      playbackSourceRef.current = null;
    }
    if (playbackAudioCtxRef.current) {
      const ctx = playbackAudioCtxRef.current;
      playbackAudioCtxRef.current = null;
      void ctx.close().catch(() => {});
    }
    if (playbackAudioElRef.current) {
      const el = playbackAudioElRef.current;
      playbackAudioElRef.current = null;
      try {
        el.onended = null;
        el.onerror = null;
        el.pause();
        el.removeAttribute('src');
        el.load();
      } catch {}
    }
    if (playbackObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(playbackObjectUrlRef.current);
      } catch {}
      playbackObjectUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setOutputLevel(0);
  }, []);

  const startRecordingRef = useRef<() => Promise<void>>(async () => {});

  const scheduleHandsFreeListen = useCallback(() => {
    if (!handsFreeRef.current || !isOpenRef.current) return;
    if (handsFreeTimerRef.current !== null) {
      window.clearTimeout(handsFreeTimerRef.current);
    }
    handsFreeTimerRef.current = window.setTimeout(() => {
      handsFreeTimerRef.current = null;
      if (handsFreeRef.current && isOpenRef.current) {
        void startRecordingRef.current();
      }
    }, 450);
  }, []);

  const speakWithBrowserFallback = useCallback(
    (text: string, currentLang: Language): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          resolve();
          return;
        }
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = currentLang === 'tr' ? 'tr-TR' : 'en-US';
          utterance.rate = 1.02;

          let phaseStep = 0;
          const finish = () => {
            if (speechSynthTimerRef.current !== null) {
              window.clearInterval(speechSynthTimerRef.current);
              speechSynthTimerRef.current = null;
            }
            setOutputLevel(0);
            resolve();
          };

          utterance.onstart = () => {
            setPhase('speaking');
            speechSynthTimerRef.current = window.setInterval(() => {
              phaseStep += 0.42;
              const wave =
                0.38 +
                0.3 * Math.sin(phaseStep) +
                0.2 * Math.sin(phaseStep * 2.3);
              setOutputLevel(Math.max(0.14, Math.min(0.92, wave)));
            }, 65);
          };
          utterance.onend = finish;
          utterance.onerror = finish;
          window.speechSynthesis.speak(utterance);
        } catch {
          resolve();
        }
      });
    },
    []
  );

  const playServerWavBase64 = useCallback(
    async (base64Wav: string, mimeType = 'audio/wav'): Promise<boolean> => {
      const arrayBuffer = decodeBase64ToArrayBuffer(base64Wav);
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          playbackAudioCtxRef.current = ctx;
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }

          // Pass a copy so fallback can still use arrayBuffer if decodeAudioData detaches/fails
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

          if (!isOpenRef.current || playbackAudioCtxRef.current !== ctx) {
            void ctx.close().catch(() => {});
            return true;
          }

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.72;

          source.connect(analyser);
          analyser.connect(ctx.destination);
          playbackSourceRef.current = source;

          const samples = new Uint8Array(analyser.fftSize);
          setPhase('speaking');

          const tick = () => {
            if (playbackAudioCtxRef.current !== ctx) return;
            analyser.getByteTimeDomainData(samples);
            let sumSq = 0;
            for (let i = 0; i < samples.length; i++) {
              const norm = (samples[i] - 128) / 128;
              sumSq += norm * norm;
            }
            const rms = Math.sqrt(sumSq / samples.length);
            setOutputLevel(Math.min(1, rms * 3.4));
            playbackRafRef.current = requestAnimationFrame(tick);
          };
          playbackRafRef.current = requestAnimationFrame(tick);

          await new Promise<void>((resolve) => {
            source.onended = () => resolve();
            source.start(0);
          });

          if (playbackAudioCtxRef.current === ctx) {
            stopPlayback();
          }
          return true;
        }
      } catch {
        stopPlayback();
      }

      // Fallback: HTML5 <audio> Blob playback if Web Audio decodeAudioData fails on Safari/mobile
      try {
        if (!isOpenRef.current) return true;
        const blob = new Blob([arrayBuffer], { type: mimeType || 'audio/wav' });
        const objectUrl = URL.createObjectURL(blob);
        playbackObjectUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        playbackAudioElRef.current = audio;

        let step = 0;
        const ok = await new Promise<boolean>((resolve) => {
          audio.onplay = () => {
            setPhase('speaking');
            speechSynthTimerRef.current = window.setInterval(() => {
              step += 0.4;
              setOutputLevel(0.32 + 0.25 * Math.sin(step) + 0.15 * Math.sin(step * 2.1));
            }, 65);
          };
          audio.onended = () => resolve(true);
          audio.onerror = () => resolve(false);
          audio.play().catch(() => resolve(false));
        });

        stopPlayback();
        return ok;
      } catch {
        stopPlayback();
        return false;
      }
    },
    [stopPlayback]
  );

  const speakReply = useCallback(
    async (replyText: string, nextMood: VoiceMood, signal: AbortSignal) => {
      if (isMutedRef.current || !replyText.trim() || !isOpenRef.current) {
        setPhase('idle');
        scheduleHandsFreeListen();
        return;
      }

      let played = false;
      try {
        const ttsRes = await fetch(apiUrl('/api/tts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            text: replyText.slice(0, 1100),
            lang: langRef.current,
            voiceName: voiceNameRef.current,
            style: getVoiceTtsStyle(nextMood, langRef.current),
          }),
        });

        if (!isStaticHostErrorResponse(ttsRes) && ttsRes.ok) {
          const data = await ttsRes.json().catch(() => ({}));
          if (typeof data?.audioBase64 === 'string' && data.audioBase64.length > 64) {
            played = await playServerWavBase64(data.audioBase64, data.mimeType || 'audio/wav');
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setPhase('idle');
          return;
        }
      }

      if (!played && !signal.aborted && isOpenRef.current && !isMutedRef.current) {
        await speakWithBrowserFallback(replyText, langRef.current);
      }

      if (isOpenRef.current) {
        setPhase('idle');
        scheduleHandsFreeListen();
      }
    },
    [playServerWavBase64, scheduleHandsFreeListen, speakWithBrowserFallback]
  );

  const handleUserCommand = useCallback(
    async (rawTranscript: string) => {
      const transcript = rawTranscript.trim();
      if (!transcript || !isOpenRef.current) return;

      stopPlayback();
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }

      setErrorMsg(null);
      setLastUserText(transcript);

      // Instant client-side eye shape + mood reaction based on user command
      const cue = detectCommandVisualCue(transcript);
      if (cue.explicitShape && cue.eyeShape) {
        // Explicit spoken eye-shape command always takes immediate effect
        setEyePreference('auto');
        setAutoEyeShape(cue.eyeShape);
      } else if (eyePreferenceRef.current === 'auto' && cue.eyeShape) {
        setAutoEyeShape(cue.eyeShape);
      }
      if (cue.mood) {
        setMood(cue.mood);
      }
      setPhase('thinking');

      const controller = new AbortController();
      fetchAbortRef.current = controller;

      try {
        const res = await fetch(apiUrl('/api/voice-chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            transcript,
            history: localHistoryRef.current.slice(-12),
            lang: langRef.current,
            nowIso: new Date().toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          }),
        });

        if (isStaticHostErrorResponse(res)) {
          throw new Error(
            langRef.current === 'en'
              ? 'Voice chat requires the live backend server.'
              : 'Sesli sohbet için canlı sunucu bağlantısı gerekli.'
          );
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data?.error ||
              (langRef.current === 'en'
                ? 'Could not get a voice reply.'
                : 'Sesli yanıt alınamadı.')
          );
        }

        if (controller.signal.aborted || !isOpenRef.current) return;

        const reply =
          typeof data?.reply === 'string' && data.reply.trim()
            ? data.reply.trim()
            : langRef.current === 'en'
              ? 'I heard you clearly.'
              : 'Seni net bir şekilde duydum.';

        const serverShape: EyeShape =
          data?.eyeShape === 'round' ||
          data?.eyeShape === 'oval' ||
          data?.eyeShape === 'square'
            ? data.eyeShape
            : cue.eyeShape || 'round';

        const validMoods: VoiceMood[] = [
          'calm',
          'happy',
          'coding',
          'curious',
          'sleepy',
          'surprised',
          'love',
          'serious',
          'playful',
        ];
        const serverMood: VoiceMood = validMoods.includes(data?.mood)
          ? data.mood
          : cue.mood || 'calm';

        // Honor explicit user eye-shape voice command first, otherwise apply Gemini's chosen shape
        const finalShape: EyeShape =
          cue.explicitShape && cue.eyeShape ? cue.eyeShape : serverShape;
        if (cue.explicitShape || eyePreferenceRef.current === 'auto') {
          setAutoEyeShape(finalShape);
        }
        setMood(serverMood);
        setLastAssistantText(reply);

        localHistoryRef.current = [
          ...localHistoryRef.current.slice(-10),
          { role: 'user', content: transcript },
          { role: 'assistant', content: reply },
        ];
        onCommitExchange(transcript, reply);

        await speakReply(reply, serverMood, controller.signal);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setErrorMsg(
          err?.message ||
            (langRef.current === 'en'
              ? 'Something went wrong. Please try again.'
              : 'Bir sorun oluştu. Lütfen tekrar dene.')
        );
        setPhase('idle');
      } finally {
        if (fetchAbortRef.current === controller) {
          fetchAbortRef.current = null;
        }
      }
    },
    [onCommitExchange, speakReply, stopPlayback]
  );

  const voice = useVoiceInput({
    lang,
    onTranscript: (text) => {
      void handleUserCommand(text);
    },
    onError: (msg) => {
      const emptyMsg = TRANSLATIONS[langRef.current].chat.voice.emptyTranscript;
      if (handsFreeRef.current && msg === emptyMsg) {
        setPhase('idle');
        return;
      }
      setErrorMsg(msg);
      setPhase('idle');
    },
    maxDurationSeconds: 60,
  });

  useEffect(() => {
    startRecordingRef.current = voice.startRecording;
  }, [voice.startRecording]);

  // Keep VoicePhase synced with voice recording / transcription states
  useEffect(() => {
    if (voice.isRecording) {
      setPhase('listening');
    } else if (voice.isTranscribing) {
      setPhase('transcribing');
    }
  }, [voice.isRecording, voice.isTranscribing]);

  // Full cleanup when closing or unmounting
  const handleClose = useCallback(() => {
    voice.cancelRecording();
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
      fetchAbortRef.current = null;
    }
    stopPlayback();
    setPhase('idle');
    onClose();
  }, [onClose, stopPlayback, voice]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      stopPlayback();
    };
  }, [stopPlayback]);

  // Live microphone input level (0..1)
  const inputLevel = useMemo(() => {
    if (!voice.isRecording) return 0;
    const avg =
      voice.audioLevels.reduce((acc, v) => acc + v, 0) /
      Math.max(1, voice.audioLevels.length);
    return Math.min(1, Math.max(0, (avg - 0.16) * 1.35));
  }, [voice.audioLevels, voice.isRecording]);

  const effectiveShape: EyeShape =
    eyePreference === 'auto' ? autoEyeShape : eyePreference;

  const statusText = useMemo(() => {
    switch (phase) {
      case 'listening':
        return vc.listening;
      case 'transcribing':
        return vc.transcribing;
      case 'thinking':
        return vc.thinking;
      case 'speaking':
        return vc.speaking;
      default:
        return vc.tapToSpeak;
    }
  }, [phase, vc]);

  const shapeLabelMap: Record<EyeShape, string> = {
    round: vc.eyeRound,
    oval: vc.eyeOval,
    square: vc.eyeSquare,
  };

  const handlePrimaryAction = () => {
    setErrorMsg(null);
    if (phase === 'speaking') {
      stopPlayback();
      setPhase('idle');
      if (voice.isSupported) {
        void voice.startRecording();
      }
      return;
    }
    if (phase === 'thinking') {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
        fetchAbortRef.current = null;
      }
      setPhase('idle');
      return;
    }
    if (voice.isRecording) {
      voice.stopRecording();
      return;
    }
    if (voice.isTranscribing) {
      return;
    }
    if (!voice.isSupported) {
      setErrorMsg(TRANSLATIONS[lang].chat.voice.notSupported);
      return;
    }
    void voice.startRecording();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setGazeOffset({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    });
  };

  const shapeOptions: Array<{ id: EyeShapePreference; label: string }> = [
    { id: 'auto', label: vc.eyeAuto },
    { id: 'round', label: vc.eyeRound },
    { id: 'oval', label: vc.eyeOval },
    { id: 'square', label: vc.eyeSquare },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="voice-chat-overlay"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.22, ease: LIQUID_EASE }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setGazeOffset({ x: 0, y: 0 })}
          role="dialog"
          aria-modal="true"
          aria-label={vc.title}
          className="fixed inset-0 z-[75] h-[100dvh] w-full flex flex-col bg-[var(--bg)] text-[var(--tx)] overflow-hidden select-none"
        >
          {/* Top Navigation Bar */}
          <header className="w-full pt-[env(safe-area-inset-top)] px-4 sm:px-6 border-b border-[var(--bd)]/70 shrink-0">
            <div className="max-w-5xl mx-auto min-h-16 py-2.5 flex flex-wrap items-center justify-between gap-3">
              {/* Brand + Title */}
              <div className="flex items-center gap-2.5">
                <LongclawLogo className="w-6 h-6 shrink-0" />
                <span className="font-display font-semibold text-[15px] tracking-tight">
                  {vc.title}
                </span>
              </div>

              {/* Eye Shape Switcher (Auto / Round / Oval / Square) */}
              <div
                role="tablist"
                aria-label="Eye shape"
                className="flex items-center p-1 rounded-full bg-[var(--surf)] border border-[var(--bd)]/80"
              >
                {shapeOptions.map((opt) => {
                  const active = eyePreference === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setEyePreference(opt.id);
                        if (opt.id !== 'auto') {
                          setAutoEyeShape(opt.id);
                        }
                      }}
                      className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'text-[var(--on)]'
                          : 'text-[var(--mut)] hover:text-[var(--tx)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="voice-eye-shape-active"
                          transition={LIQUID_MORPH}
                          className="absolute inset-0 rounded-full bg-[var(--ac)]"
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        <EyeShapeMiniIcon pref={opt.id} />
                        <span className="hidden sm:inline">{opt.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Controls: Voice Persona, Mute, Close */}
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor="voice-persona-select">
                  {vc.voiceLabel}
                </label>
                <select
                  id="voice-persona-select"
                  value={voiceName}
                  onChange={(e) =>
                    setVoiceName(e.target.value as VoicePersonaName)
                  }
                  className="h-9 px-3 rounded-full bg-[var(--surf)] border border-[var(--bd)]/80 text-xs font-medium text-[var(--tx)] focus:outline-none cursor-pointer"
                >
                  {VOICE_PERSONAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const nextMuted = !isMuted;
                    setIsMuted(nextMuted);
                    if (nextMuted && phase === 'speaking') {
                      stopPlayback();
                      setPhase('idle');
                    }
                  }}
                  title={isMuted ? vc.unmute : vc.mute}
                  aria-label={isMuted ? vc.unmute : vc.mute}
                  aria-pressed={isMuted}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
                    isMuted
                      ? 'bg-[var(--surf)] border-[var(--bd)] text-[var(--mut)]'
                      : 'bg-[var(--card)] border-[var(--bd)] text-[var(--tx)] hover:bg-[var(--surf)]'
                  }`}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  title={closeLabel}
                  aria-label={closeLabel}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--card)] border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Center Stage: Big Expressive Eyes + Live Captions */}
          <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 sm:px-6 py-4 overflow-y-auto">
            <div className="w-full max-w-2xl flex flex-col items-center">
              {/* Big Round / Oval / Square Eyes */}
              <VoiceCompanionEyes
                shape={effectiveShape}
                mood={mood}
                phase={phase}
                inputLevel={inputLevel}
                outputLevel={outputLevel}
                gazeOffset={gazeOffset}
              />

              {/* Subtle State + Current Shape & Mood Indicator */}
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--mut)]">
                <span
                  className={`font-medium ${
                    phase === 'listening' || phase === 'speaking'
                      ? 'text-[var(--editorial-accent)]'
                      : 'text-[var(--tx)]'
                  }`}
                >
                  {statusText}
                </span>
                <span aria-hidden="true">·</span>
                <span>{shapeLabelMap[effectiveShape]}</span>
                <span aria-hidden="true">·</span>
                <span>{getMoodDisplayLabel(mood, lang)}</span>
              </div>

              {/* Live Transcript & Spoken Reply Display */}
              <div className="w-full max-w-xl mt-5 min-h-[84px] flex flex-col items-center justify-center text-center gap-2 select-text">
                {errorMsg ? (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                    {errorMsg}
                  </p>
                ) : (
                  <>
                    {(voice.interimTranscript || lastUserText) && (
                      <p className="text-xs sm:text-sm text-[var(--mut)] line-clamp-2 max-w-lg">
                        “{voice.interimTranscript || lastUserText}”
                      </p>
                    )}
                    {lastAssistantText && (
                      <motion.p
                        key={lastAssistantText}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24, ease: LIQUID_EASE }}
                        className="text-sm sm:text-base font-medium text-[var(--tx)] leading-relaxed max-w-lg line-clamp-4"
                      >
                        {lastAssistantText}
                      </motion.p>
                    )}
                  </>
                )}
              </div>
            </div>
          </main>

          {/* Bottom Control Dock */}
          <footer className="w-full pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 px-4 sm:px-6 border-t border-[var(--bd)]/70 shrink-0">
            <div className="max-w-md mx-auto flex items-center justify-between gap-4">
              {/* Hands-free Auto-Listen Toggle */}
              <button
                type="button"
                onClick={() => setHandsFree((prev) => !prev)}
                aria-pressed={handsFree}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  handsFree
                    ? 'bg-[var(--ac)] text-[var(--on)] border-transparent'
                    : 'bg-[var(--card)] text-[var(--mut)] hover:text-[var(--tx)] border-[var(--bd)] hover:bg-[var(--surf)]'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>{vc.handsFree}</span>
              </button>

              {/* Central Talk / Send / Interrupt Trigger */}
              <motion.button
                type="button"
                onClick={handlePrimaryAction}
                disabled={phase === 'transcribing'}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
                transition={LIQUID_TAP}
                aria-label={
                  phase === 'listening'
                    ? vc.tapToStop
                    : phase === 'speaking'
                      ? vc.interrupt
                      : vc.tapToSpeak
                }
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60 ${
                  phase === 'listening'
                    ? 'bg-[var(--editorial-accent)] text-[var(--on)] hover:opacity-92'
                    : phase === 'speaking' || phase === 'thinking'
                      ? 'bg-[var(--tx)] text-[var(--bg)] hover:opacity-90'
                      : 'btn-3d-primary'
                }`}
              >
                {phase === 'transcribing' || phase === 'thinking' ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : phase === 'listening' || phase === 'speaking' ? (
                  <Square className="w-5 h-5 fill-current" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </motion.button>

              {/* Cancel / Reset Action */}
              <button
                type="button"
                onClick={() => {
                  voice.cancelRecording();
                  if (fetchAbortRef.current) {
                    fetchAbortRef.current.abort();
                    fetchAbortRef.current = null;
                  }
                  stopPlayback();
                  setPhase('idle');
                  setErrorMsg(null);
                }}
                disabled={phase === 'idle'}
                className="px-3.5 py-2.5 rounded-full text-xs font-medium bg-[var(--card)] border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
              >
                {lang === 'tr' ? 'Durdur' : 'Stop'}
              </button>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
