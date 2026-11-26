import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiUrl,
  isStaticHostErrorResponse,
  isStaticHostWithoutBackend,
} from '../lib/api';
import { Language, TRANSLATIONS } from '../lib/i18n';

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionInstanceLike;

interface UseVoiceInputOptions {
  lang: Language;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  maxDurationSeconds?: number;
}

const DEFAULT_BARS: [number, number, number, number, number] = [0.18, 0.24, 0.3, 0.24, 0.18];

function getBrowserSpeechRecognition(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function pickSupportedRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // Ignore probe error and try next codec
    }
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx >= 0) {
        resolve(result.slice(commaIdx + 1));
      } else {
        reject(new Error('Could not encode audio recording.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read audio recording.'));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceInput({
  lang,
  onTranscript,
  onError,
  maxDurationSeconds = 120,
}: UseVoiceInputOptions) {
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevels, setAudioLevels] =
    useState<[number, number, number, number, number]>(DEFAULT_BARS);
  const [interimTranscript, setInterimTranscript] = useState('');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const speechFinalTextRef = useRef('');
  const speechInterimTextRef = useRef('');
  const forceBrowserSpeechRef = useRef(false);

  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const langRef = useRef(lang);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined') ||
        getBrowserSpeechRecognition()
    );

  const cleanupAudioResources = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      void ctx.close().catch(() => {});
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      mediaStreamRef.current = null;
    }
    setAudioLevels(DEFAULT_BARS);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanupAudioResources();
        setStatus('idle');
      }
    }
  }, [cleanupAudioResources]);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.abort();
      } catch {}
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    speechFinalTextRef.current = '';
    speechInterimTextRef.current = '';
    setInterimTranscript('');
    setElapsedSeconds(0);
    cleanupAudioResources();
    setStatus('idle');
  }, [cleanupAudioResources]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

  const startElapsedTimer = useCallback(
    (onMaxReached: () => void) => {
      setElapsedSeconds(0);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        setElapsedSeconds(secs);
        if (secs >= maxDurationSeconds) {
          onMaxReached();
        }
      }, 250);
    },
    [maxDurationSeconds]
  );

  const startAudioMeter = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const bucketIndices = [2, 5, 9, 14, 20];

      const tick = () => {
        if (!audioContextRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const nextBars = bucketIndices.map((idx, i) => {
          const sample = dataArray[Math.min(idx, dataArray.length - 1)] || 0;
          const neighbor = dataArray[Math.min(idx + 1, dataArray.length - 1)] || 0;
          const avg = (sample + neighbor) / (2 * 255);
          const floor = i === 2 ? 0.22 : 0.16;
          return Math.min(1, Math.max(floor, floor + avg * 1.15));
        }) as [number, number, number, number, number];
        setAudioLevels(nextBars);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Audio meter is purely visual; silently keep subtle idle bars if Web Audio is unavailable
    }
  }, []);

  const startBrowserSpeechRecognition = useCallback(() => {
    const SpeechRec = getBrowserSpeechRecognition();
    const vText = TRANSLATIONS[langRef.current].chat.voice;
    if (!SpeechRec) {
      onErrorRef.current(vText.notSupported);
      return false;
    }

    cancelledRef.current = false;
    speechFinalTextRef.current = '';
    speechInterimTextRef.current = '';
    setInterimTranscript('');

    const rec = new SpeechRec();
    rec.lang = langRef.current === 'tr' ? 'tr-TR' : 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    recognitionRef.current = rec;

    rec.onresult = (event) => {
      if (cancelledRef.current) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const piece = res[0]?.transcript || '';
        if (res.isFinal) {
          speechFinalTextRef.current = `${speechFinalTextRef.current} ${piece}`.trim();
        } else {
          interim = `${interim} ${piece}`.trim();
        }
      }
      speechInterimTextRef.current = interim;
      setInterimTranscript(
        `${speechFinalTextRef.current} ${speechInterimTextRef.current}`.trim()
      );
    };

    rec.onerror = (event) => {
      if (cancelledRef.current) return;
      const errCode = event?.error || '';
      if (errCode === 'aborted') return;
      const voiceText = TRANSLATIONS[langRef.current].chat.voice;
      if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
        onErrorRef.current(voiceText.permissionDenied);
      } else if (errCode === 'audio-capture') {
        onErrorRef.current(voiceText.noMicrophone);
      } else if (errCode !== 'no-speech') {
        onErrorRef.current(voiceText.transcribeFailed);
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      cleanupAudioResources();
      setStatus('idle');
      setElapsedSeconds(0);
      if (cancelledRef.current) {
        setInterimTranscript('');
        return;
      }
      const combined = `${speechFinalTextRef.current} ${speechInterimTextRef.current}`.trim();
      setInterimTranscript('');
      if (combined) {
        onTranscriptRef.current(combined);
      } else {
        onErrorRef.current(TRANSLATIONS[langRef.current].chat.voice.emptyTranscript);
      }
    };

    try {
      rec.start();
      setStatus('recording');
      startElapsedTimer(() => {
        try {
          rec.stop();
        } catch {}
      });
      return true;
    } catch {
      recognitionRef.current = null;
      onErrorRef.current(vText.notSupported);
      return false;
    }
  }, [cleanupAudioResources, startElapsedTimer]);

  const startRecording = useCallback(async () => {
    if (status !== 'idle') return;
    const vText = TRANSLATIONS[langRef.current].chat.voice;

    const canRecordMedia =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';

    // On static hosts without a backend (or if MediaRecorder isn't available), use native SpeechRecognition
    if (forceBrowserSpeechRef.current || isStaticHostWithoutBackend() || !canRecordMedia) {
      startBrowserSpeechRecognition();
      return;
    }

    cancelledRef.current = false;
    recordedChunksRef.current = [];
    setInterimTranscript('');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      const errName = String(err?.name || '');
      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errName === 'SecurityError'
      ) {
        onErrorRef.current(vText.permissionDenied);
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        onErrorRef.current(vText.noMicrophone);
      } else {
        onErrorRef.current(vText.notSupported);
      }
      return;
    }

    mediaStreamRef.current = stream;

    const preferredMime = pickSupportedRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
    } catch {
      cleanupAudioResources();
      if (getBrowserSpeechRecognition()) {
        startBrowserSpeechRecognition();
      } else {
        onErrorRef.current(vText.notSupported);
      }
      return;
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        recordedChunksRef.current.push(ev.data);
      }
    };

    recorder.onerror = () => {
      cleanupAudioResources();
      mediaRecorderRef.current = null;
      setStatus('idle');
      setElapsedSeconds(0);
      if (!cancelledRef.current) {
        onErrorRef.current(TRANSLATIONS[langRef.current].chat.voice.transcribeFailed);
      }
    };

    recorder.onstop = async () => {
      const mime = (recorder.mimeType || preferredMime || 'audio/webm').split(';')[0].trim();
      const chunks = recordedChunksRef.current.slice();
      recordedChunksRef.current = [];
      mediaRecorderRef.current = null;
      cleanupAudioResources();
      setElapsedSeconds(0);

      if (cancelledRef.current) {
        setStatus('idle');
        return;
      }

      const blob = new Blob(chunks, { type: mime || 'audio/webm' });
      if (blob.size < 400) {
        setStatus('idle');
        onErrorRef.current(TRANSLATIONS[langRef.current].chat.voice.emptyTranscript);
        return;
      }

      setStatus('transcribing');
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const base64Audio = await blobToBase64(blob);
        const res = await fetch(apiUrl('/api/transcribe'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            audioData: base64Audio,
            mimeType: mime || 'audio/webm',
            lang: langRef.current,
          }),
        });

        if (isStaticHostErrorResponse(res)) {
          if (getBrowserSpeechRecognition()) {
            forceBrowserSpeechRef.current = true;
          }
          throw new Error(TRANSLATIONS[langRef.current].chat.voice.transcribeFailed);
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data?.error || TRANSLATIONS[langRef.current].chat.voice.transcribeFailed
          );
        }

        if (cancelledRef.current) return;

        const text = typeof data?.text === 'string' ? data.text.trim() : '';
        if (!text) {
          onErrorRef.current(TRANSLATIONS[langRef.current].chat.voice.emptyTranscript);
        } else {
          onTranscriptRef.current(text);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError' && !cancelledRef.current) {
          onErrorRef.current(
            err?.message || TRANSLATIONS[langRef.current].chat.voice.transcribeFailed
          );
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setStatus('idle');
      }
    };

    try {
      recorder.start(250);
      setStatus('recording');
      startAudioMeter(stream);
      startElapsedTimer(() => {
        onErrorRef.current(TRANSLATIONS[langRef.current].chat.voice.maxDurationReached);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
      });
    } catch {
      cleanupAudioResources();
      mediaRecorderRef.current = null;
      setStatus('idle');
      onErrorRef.current(vText.transcribeFailed);
    }
  }, [
    cleanupAudioResources,
    startAudioMeter,
    startBrowserSpeechRecognition,
    startElapsedTimer,
    status,
  ]);

  const toggleRecording = useCallback(() => {
    if (status === 'recording') {
      stopRecording();
    } else if (status === 'idle') {
      void startRecording();
    }
  }, [startRecording, status, stopRecording]);

  return {
    status,
    isRecording: status === 'recording',
    isTranscribing: status === 'transcribing',
    isSupported,
    elapsedSeconds,
    audioLevels,
    interimTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
    toggleRecording,
  };
}
