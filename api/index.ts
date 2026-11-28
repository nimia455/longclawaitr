import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  buildTrainedChatSystemPrompt,
  buildTrainedVoiceSystemPrompt,
} from './longclawTraining.ts';

if (!process.env.VERCEL) {
  dotenv.config({ override: true });
}

const app = express();
const serverStartedAt = Date.now();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Production-safe response headers (intentionally omits X-Frame-Options to preserve iframe embeds)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Redact any accidental credential/key patterns before writing error messages to server logs
function sanitizeForLog(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  return raw
    .replace(/AIza[0-9A-Za-z_-]{16,}/g, '[REDACTED_KEY]')
    .replace(/(?:sk|ghp|ya29|xoxb)-[0-9A-Za-z._-]{12,}/g, '[REDACTED_TOKEN]')
    .replace(/Bearer\s+[0-9A-Za-z._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:key|api_key|token|access_token)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 500);
}

// Safe CORS for longclaw.vercel.app, this Vercel project's deployments, GitHub Pages, and explicitly allowed origins
const configuredAllowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

const ALLOWED_EXACT_HOSTNAMES = new Set(
  [
    'longclaw.vercel.app',
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    .map((h) => h.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase())
);

function isAllowedCorsOrigin(origin: string): boolean {
  const normalized = origin.trim().replace(/\/+$/, '');
  if (!normalized) return false;
  if (configuredAllowedOrigins.has(normalized)) return true;
  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol === 'https:' && ALLOWED_EXACT_HOSTNAMES.has(hostname)) {
      return true;
    }
    if (parsed.protocol === 'https:' && hostname.endsWith('.github.io')) {
      return true;
    }
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (hostname === 'localhost' || hostname === '127.0.0.1')
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (origin && isAllowedCorsOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '15mb' }));

// Lightweight in-memory sliding-window rate limiter per client IP + route bucket
const rateLimitBuckets = new Map<string, number[]>();

// Rely on Express trust proxy (configured above) instead of spoofable raw X-Forwarded-For headers
function getClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter(bucket: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${bucket}:${getClientIp(req)}`;
    const recent = (rateLimitBuckets.get(key) || []).filter((ts) => now - ts < windowMs);

    if (recent.length >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
      const uiLang = resolveUiLang(req.body);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error:
          uiLang === 'en'
            ? `Too many requests right now. Please wait ${retryAfterSec} seconds and try again.`
            : `Çok fazla istek gönderildi. Lütfen ${retryAfterSec} saniye bekleyip tekrar dene.`,
      });
    }

    recent.push(now);
    rateLimitBuckets.set(key, recent);

    // Prevent unbounded growth on long-running servers
    if (rateLimitBuckets.size > 4000) {
      for (const [k, timestamps] of rateLimitBuckets.entries()) {
        if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > windowMs) {
          rateLimitBuckets.delete(k);
        }
      }
    }

    next();
  };
}

const chatRateLimit = createRateLimiter('chat', 40, 60_000);
const imageRateLimit = createRateLimiter('image', 12, 60_000);
const titleRateLimit = createRateLimiter('title', 40, 60_000);
const workspaceRateLimit = createRateLimiter('workspace', 25, 60_000);
const proxyRateLimit = createRateLimiter('proxy', 60, 60_000);
const transcribeRateLimit = createRateLimiter('transcribe', 20, 60_000);
const voiceChatRateLimit = createRateLimiter('voice-chat', 30, 60_000);
const ttsRateLimit = createRateLimiter('tts', 30, 60_000);

// Multi-key unpaid Gemini client pool (supports up to 3 fallback keys: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3)
const clientPool = new Map<string, GoogleGenAI>();
const ttsClientPool = new Map<string, GoogleGenAI>();
const keyModelCooldownUntil = new Map<string, number>();
let preferredKeyIndex = 0;

function cooldownKey(apiKey: string, model: string): string {
  return `${apiKey}::${model}`;
}

function isPlaceholderKey(val: string): boolean {
  const trimmed = val.trim();
  return !trimmed || trimmed.startsWith('MY_GEMINI_API_KEY');
}

function getConfiguredApiKeys(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    ...(process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : []),
  ];

  const seen = new Set<string>();
  const keys: string[] = [];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (isPlaceholderKey(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    keys.push(trimmed);
  }
  return keys;
}

function getOrderedApiKeys(model: string): { healthy: string[]; all: string[] } {
  const keys = getConfiguredApiKeys();
  if (keys.length === 0) return { healthy: [], all: [] };

  const now = Date.now();
  const rotated: string[] = [];
  for (let offset = 0; offset < keys.length; offset++) {
    rotated.push(keys[(preferredKeyIndex + offset) % keys.length]);
  }

  const healthy = rotated.filter(
    (k) => (keyModelCooldownUntil.get(cooldownKey(k, model)) || 0) <= now
  );
  const coolingDown = rotated.filter(
    (k) => (keyModelCooldownUntil.get(cooldownKey(k, model)) || 0) > now
  );
  return { healthy, all: [...healthy, ...coolingDown] };
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  let client = clientPool.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    clientPool.set(apiKey, client);
  }
  return client;
}

function getGeminiTtsClient(apiKey: string): GoogleGenAI {
  let client = ttsClientPool.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    ttsClientPool.set(apiKey, client);
  }
  return client;
}

function markKeySuccess(apiKey: string, model: string) {
  keyModelCooldownUntil.delete(cooldownKey(apiKey, model));
  const keys = getConfiguredApiKeys();
  const idx = keys.indexOf(apiKey);
  if (idx >= 0) {
    preferredKeyIndex = idx;
  }
}

function markKeyFailure(apiKey: string, model: string, err: any) {
  const status = Number(err?.status || err?.code) || 500;
  const rawMsg = String(err?.message || '').toUpperCase();
  const isAuthError =
    status === 401 ||
    status === 403 ||
    rawMsg.includes('API_KEY_INVALID') ||
    rawMsg.includes('PERMISSION_DENIED');
  const isRateLimit =
    status === 429 ||
    rawMsg.includes('RESOURCE_EXHAUSTED') ||
    rawMsg.includes('QUOTA');
  const singleKey = getConfiguredApiKeys().length <= 1;
  const cooldownMs = isAuthError
    ? singleKey
      ? 60_000
      : 300_000
    : isRateLimit
      ? 45_000
      : status === 503 || status === 504
        ? singleKey
          ? 8_000
          : 30_000
        : 10_000;
  keyModelCooldownUntil.set(cooldownKey(apiKey, model), Date.now() + cooldownMs);
}

// Supported Longclaw model aliases -> underlying Gemini models
const DEFAULT_PUBLIC_MODEL = 'longclaw-clawing-1.2-pro';
const DEFAULT_BACKEND_MODEL = 'gemini-4-hydrogen';

const PUBLIC_TO_BACKEND_MODEL: Record<string, string> = {
  'longclaw-ultracode-1': 'gemini-4-hydrogen',
  'longclaw-clawing-1.2-ultra': 'gemini-4-hydrogen',
  'longclaw-clawing-1.2-pro': 'gemini-4-hydrogen',
  'longclaw-clawing-1.1-ultra': 'gemini-4-hydrogen',
  'longclaw-clawing-1.1-pro': 'gemini-4-hydrogen',
  'longclaw-clawing-1-pro': 'gemini-4-hydrogen',
  'longclaw-clawing-1.1': 'gemini-4-hydrogen',
  'longclaw-clawing-1.1-low': 'gemini-3.1-flash-lite',
};

function resolvePublicModel(requestedModel: unknown): string {
  if (requestedModel === 'longclaw-clawing-1-low') {
    return 'longclaw-clawing-1.1-low';
  }
  if (requestedModel === 'longclaw-clawing-1') {
    return 'longclaw-clawing-1.1';
  }
  if (typeof requestedModel === 'string' && requestedModel in PUBLIC_TO_BACKEND_MODEL) {
    return requestedModel;
  }
  return DEFAULT_PUBLIC_MODEL;
}

type EffortTier = 'instant' | 'light' | 'balanced' | 'deep';

interface SilentRoutePlan {
  tier: EffortTier;
  primaryModel: string;
  fallbackModels: string[];
  includeThoughts: boolean;
}

const TRIVIAL_CHAT_PATTERN =
  /^(merhaba+|selam+|günaydın|iyi\s*(akşamlar|geceler|günler)|nasılsın\??|naber\??|ne\s*haber\??|teşekkür(ler| ederim)?|sağ\s*ol|eyvallah|tamam|ok(ay)?|peki|evet|hayır|görüşürüz|hoşça\s*kal|hi+|hello+|hey+|good\s*(morning|afternoon|evening|night)|how\s*are\s*you\??|thanks?(\s*you)?|bye|goodbye|yes|no|sure|hangi\s*modelsin\??|what\s*model\s*are\s*you\??|sen\s*kimsin\??|who\s*are\s*you\??)[!.\s?]*$/i;

const DEEP_EFFORT_PATTERNS: RegExp[] = [
  /```/,
  /\b(architecture|mimari|system\s+design|sistem\s+tasarımı|microservices|distributed)\b/i,
  /\b(debug|hata\s*ayıkla|stack\s*trace|traceback|exception|segfault|deadlock|race\s+condition|root\s+cause|kök\s+neden)\b/i,
  /\b(algorithm|algoritma|dynamic\s+programming|time\s+complexity|big\s*o|optimize|refactor|compiler|derleyici)\b/i,
  /\b(proof|prove|kanıtla|kanıt|ispat|theorem|teorem|integral|türev|derivative|differential|eigenvalue|matrix|matris|probability|olasılık)\b/i,
  /\b(compare|karşılaştır|trade-?offs?|pros\s+and\s+cons|step\s+by\s+step|adım\s+adım|in-?depth|comprehensive|detaylı|kapsamlı|analyze|analiz)\b/i,
  /\b(security\s+audit|güvenlik|cryptography|encryption|sql|regex|docker|kubernetes|terraform|concurrency|async)\b/i,
  /\b(quantum|kuantum|physics|fizik|chemistry|kimya|biology|biyoloji|economics|ekonomi|legal|hukuk|philosophy|felsefe|calculus|algebra)\b/i,
  /\b(how\s+many\s+(?:times|letters|words)|kaç\s+(?:tane|kez|harf)|riddle|puzzle|bulmaca|mantık\s+sorusu)\b/i,
];

const CODING_EFFORT_PATTERN =
  /\b(typescript|javascript|python|rust|golang|java|c\+\+|react|nextjs|vue|svelte|html|css|svg|api|json|yaml|bash|shell|function|component|class|hook|script|kod|code|app|uygulama|website|web\s*sitesi|game|oyun|timer|pomodoro|kronometre|calculator|hesap\s*makinesi|dashboard|chart|grafik|diagram|diyagram|flowchart|interactive|etkileşimli|shader|canvas|mermaid)\b/i;

const BUILD_ACTION_PATTERN =
  /\b(write|build|create|design|implement|fix|generate|make|yaz|oluştur|tasarla|yap|düzelt|geliştir)\b/i;

const MEDIUM_EFFORT_PATTERN =
  /\b(explain|açıkla|anlat|why|neden|niçin|how|nasıl|summarize|özetle|translate|çevir|email|e-posta|mail|draft|taslak|rewrite|yeniden\s+yaz|improve|plan|strateji|strategy|essay|makale|article|report|rapor|ideas|fikir|brainstorm|difference|fark|calculate|hesapla|solve|çöz|slash|komut|commands?)\b/i;

function assessSilentRoutePlan(options: {
  messages: Array<{ role?: string; content?: string; images?: unknown[] }>;
  depth: string;
  publicModel: string;
  hasAttachedImages: boolean;
  hasWorkspaceContext: boolean;
}): SilentRoutePlan {
  const { messages, depth, publicModel, hasAttachedImages, hasWorkspaceContext } = options;
  const lastUser = [...messages].reverse().find((m) => m.role !== 'assistant');
  const text = (lastUser?.content || '').trim();

  // Trivial greetings / acknowledgments / identity checks switch silently to the fastest responsive tier
  // while keeping LongClaw UltraCode 1 on its dedicated flagship engine (with low latency, no thoughts)
  if (!hasAttachedImages && !hasWorkspaceContext && (!text || TRIVIAL_CHAT_PATTERN.test(text))) {
    if (publicModel === 'longclaw-ultracode-1') {
      return buildSilentRoutePlan('balanced', 'fast');
    }
    return buildSilentRoutePlan('instant', depth);
  }

  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const lineCount = text ? text.split('\n').length : 0;
  const questionMarks = (text.match(/\?/g) || []).length;

  let score = 0;

  // 1. Prompt length & structural density
  if (text.length >= 1200 || lineCount >= 12) {
    score += 4;
  } else if (text.length >= 450 || lineCount >= 6) {
    score += 3;
  } else if (text.length >= 160 || words >= 28) {
    score += 2;
  } else if (text.length >= 65 || words >= 12) {
    score += 1;
  }

  if (questionMarks >= 2) {
    score += 1;
  }

  // 2. Deep reasoning / math / debugging / architecture cues
  let deepHits = 0;
  for (const pattern of DEEP_EFFORT_PATTERNS) {
    if (pattern.test(text)) {
      deepHits += 1;
    }
  }
  score += Math.min(5, deepHits * 2);

  // 3. Coding & building cues
  const hasCodingCue = CODING_EFFORT_PATTERN.test(text) || /```/.test(text);
  if (hasCodingCue) {
    score += BUILD_ACTION_PATTERN.test(text) ? 4 : 3;
  }

  // 4. Everyday synthesis / writing / explanation cues
  if (MEDIUM_EFFORT_PATTERN.test(text)) {
    score += 2;
  }

  // 5. Multimodal & connected workspace context
  if (hasAttachedImages) {
    score += 4;
  }
  if (hasWorkspaceContext) {
    score += 3;
  }

  // 6. Conversation continuity: follow-ups inside an active coding or long technical thread
  let priorHasCode = false;
  if (messages.length > 2) {
    const recentPrior = messages.slice(-6, -1);
    priorHasCode = recentPrior.some((m) => String(m?.content || '').includes('```'));
    const priorChars = recentPrior.reduce((sum, m) => sum + String(m?.content || '').length, 0);
    if (priorHasCode || priorChars > 1800) {
      score += 2;
    }
  }

  const intrinsicScore = score;

  // 7. Gentle bias from user's depth preference & model family without hard-locking
  if (depth === 'deep') {
    score += 2;
  } else if (depth === 'fast') {
    score -= 2;
  }

  const isUltraCode = publicModel === 'longclaw-ultracode-1';
  if (isUltraCode) {
    score += 3;
  } else if (publicModel.includes('ultra')) {
    score += 1;
  } else if (publicModel.includes('low')) {
    score -= 1;
  }

  let tier: EffortTier;
  if (score <= 1) {
    tier = 'instant';
  } else if (score <= 3) {
    tier = 'light';
  } else if (score <= 6) {
    tier = 'balanced';
  } else {
    tier = 'deep';
  }

  // Safety floors:
  // - LongClaw UltraCode 1 is purpose-built for coding and always routes to balanced or deep on our flagship model
  // - Any real coding/debugging/multimodal/workspace prompt never downgrades below balanced
  if (isUltraCode) {
    if (tier === 'instant' || tier === 'light') {
      tier = 'balanced';
    }
    if ((hasCodingCue || deepHits > 0 || priorHasCode) && depth !== 'fast' && score >= 6) {
      tier = 'deep';
    }
  } else if (
    (hasAttachedImages || hasWorkspaceContext || hasCodingCue || intrinsicScore >= 7) &&
    (tier === 'instant' || tier === 'light')
  ) {
    tier = 'balanced';
  }

  return buildSilentRoutePlan(tier, depth);
}

function buildSilentRoutePlan(tier: EffortTier, depth: string): SilentRoutePlan {
  switch (tier) {
    case 'instant':
      return {
        tier,
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModels: ['gemini-4-hydrogen'],
        includeThoughts: false,
      };
    case 'light':
      return {
        tier,
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModels: ['gemini-4-hydrogen'],
        includeThoughts: false,
      };
    case 'balanced':
      return {
        tier,
        primaryModel: 'gemini-4-hydrogen',
        fallbackModels: ['gemini-3.1-flash-lite'],
        includeThoughts: depth !== 'fast',
      };
    case 'deep':
      return {
        tier,
        primaryModel: 'gemini-4-hydrogen',
        fallbackModels: ['gemini-3.1-flash-lite'],
        includeThoughts: true,
      };
  }
}

function resolveThinkingForModel(
  backendModel: string,
  tier: EffortTier,
  includeThoughts: boolean
): { level: ThinkingLevel; includeThoughts: boolean } | null {
  const isLiteModel = backendModel.includes('flash-lite');

  // gemini-3.1-flash-lite stalls under ThinkingLevel.MINIMAL or includeThoughts: true in streaming;
  // omit thinkingConfig for instant/light tiers and keep includeThoughts false for balanced/deep.
  if (isLiteModel) {
    if (tier === 'instant' || tier === 'light') {
      return null;
    }
    return {
      level: tier === 'deep' ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
      includeThoughts: false,
    };
  }

  if (tier === 'instant' || tier === 'light') {
    return {
      level: ThinkingLevel.LOW,
      includeThoughts: false,
    };
  }

  if (tier === 'balanced') {
    return {
      level: includeThoughts ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
      includeThoughts,
    };
  }

  // Deep tier: maximize reasoning effort on flagship model
  return {
    level: ThinkingLevel.HIGH,
    includeThoughts,
  };
}

function resolveUiLang(body: any): 'en' | 'tr' {
  const raw = body?.lang ?? body?.language ?? body?.uiLang;
  return raw === 'en' ? 'en' : 'tr';
}


function formatGeminiError(err: any, lang: 'en' | 'tr' = 'tr'): { status: number; message: string } {
  const isEn = lang === 'en';
  const rawMsg =
    err?.message || String(err || (isEn ? 'An unknown error occurred.' : 'Bilinmeyen bir hata oluştu.'));
  const status = Number(err?.status || err?.code) || 500;
  const upper = rawMsg.toUpperCase();

  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('QUOTA')) {
    return {
      status: 429,
      message: isEn
        ? 'Longclaw is seeing high demand right now. Please wait a few seconds and try again.'
        : 'Longclaw şu anda yüksek talep görüyor. Lütfen birkaç saniye bekleyip tekrar dene.',
    };
  }

  if (status === 503 || status === 504 || upper.includes('UNAVAILABLE') || upper.includes('OVERLOADED')) {
    return {
      status: status === 504 ? 504 : 503,
      message: isEn
        ? 'The AI service is temporarily busy. Please try again in a few seconds.'
        : 'Yapay zekâ servisi şu anda geçici olarak yoğun. Lütfen birkaç saniye sonra tekrar dene.',
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('PERMISSION_DENIED') ||
    (status === 400 && (upper.includes('API KEY') || upper.includes('API_KEY')))
  ) {
    return {
      status: status === 400 ? 400 : 403,
      message: isEn
        ? 'The AI backend credentials are currently unavailable. Please try again shortly.'
        : 'Yapay zekâ servisi kimlik doğrulaması şu an kullanılamıyor. Lütfen kısa süre sonra tekrar dene.',
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: isEn
      ? 'Something went wrong while generating a reply. Please try again.'
      : 'Yanıt oluşturulurken beklenmeyen bir sorun oluştu. Lütfen tekrar dene.',
  };
}

const FALLBACK_UNPAID_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL_CHAIN = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
];

function buildModelAttemptParams(
  params: any,
  targetModel: string,
  tier: EffortTier,
  includeThoughts: boolean
) {
  const thinking = resolveThinkingForModel(targetModel, tier, includeThoughts);
  const nextConfig: any = { ...(params?.config || {}) };
  if (params?.config?.thinkingConfig) {
    if (thinking) {
      nextConfig.thinkingConfig = {
        thinkingLevel: thinking.level,
        includeThoughts: thinking.includeThoughts,
      };
    } else {
      delete nextConfig.thinkingConfig;
    }
  }
  return {
    ...params,
    model: targetModel,
    config: nextConfig,
  };
}

function buildFailoverAttempts(
  params: any,
  tier: EffortTier = 'instant',
  includeThoughts = false,
  customFallbacks?: string[]
): any[] {
  const primaryModel = String(params?.model || DEFAULT_BACKEND_MODEL);
  const attempts: any[] = [params];
  const seen = new Set<string>([primaryModel]);
  const chain = customFallbacks && customFallbacks.length > 0 ? customFallbacks : FALLBACK_MODEL_CHAIN;

  for (const fallbackModel of chain) {
    if (seen.has(fallbackModel)) continue;
    seen.add(fallbackModel);
    attempts.push(buildModelAttemptParams(params, fallbackModel, tier, includeThoughts));
  }
  return attempts;
}

function isRetryableUpstreamError(err: any): boolean {
  const status = Number(err?.status || err?.code) || 500;
  const upper = String(err?.message || '').toUpperCase();
  return (
    status === 404 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    upper.includes('NOT_FOUND') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVERLOADED')
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  // Prevent unhandled rejection if the underlying promise rejects after timeout
  promise.catch(() => {});
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err: any = new Error(`${label} zaman aşımına uğradı`);
      err.status = 504;
      reject(err);
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function chunkHasAnyText(chunk: any): boolean {
  if (!chunk) return false;
  if (typeof chunk.text === 'string' && chunk.text.length > 0) return true;
  const parts = chunk?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.some((p: any) => typeof p?.text === 'string' && p.text.length > 0);
  }
  return false;
}

function parseRetryAfterMs(err: any, fallbackMs: number): number {
  const msg = String(err?.message || '');
  const secMatch = msg.match(/retry\s*(?:in|after)\s*(\d+(?:\.\d+)?)\s*s/i);
  if (secMatch) {
    const parsed = Math.ceil(Number(secMatch[1]) * 1000);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(4_500, Math.max(800, parsed));
    }
  }
  return fallbackMs;
}

function hasInlineDataInContents(contents: any): boolean {
  if (!Array.isArray(contents)) return false;
  return contents.some(
    (entry: any) =>
      Array.isArray(entry?.parts) &&
      entry.parts.some((part: any) => Boolean(part?.inlineData?.data))
  );
}

async function executeStreamAttempt(client: GoogleGenAI, attemptParams: any) {
  const modelName = String(attemptParams?.model || '');
  if (modelName.includes('flash-lite') && hasInlineDataInContents(attemptParams?.contents)) {
    // gemini-3.1-flash-lite stalls on generateContentStream with inlineData images,
    // whereas generateContent returns the full multimodal response in ~1.2s.
    const nextConfig = { ...(attemptParams?.config || {}) };
    delete nextConfig.thinkingConfig;
    const response = await client.models.generateContent({
      ...attemptParams,
      config: nextConfig,
    });
    if (!chunkHasAnyText(response)) {
      const emptyErr: any = new Error('Model returned an empty response.');
      emptyErr.status = 502;
      throw emptyErr;
    }
    const emptyIterator: AsyncIterator<any> = {
      async next() {
        return { value: undefined, done: true };
      },
    };
    return {
      iterator: emptyIterator,
      initialChunks: [response],
    };
  }

  const stream = await client.models.generateContentStream(attemptParams);
  const iterator = stream[Symbol.asyncIterator]();
  const firstResult = await iterator.next();
  if (firstResult.done || !chunkHasAnyText(firstResult.value)) {
    // Peek once more in case the first chunk was metadata-only
    const secondResult = firstResult.done ? firstResult : await iterator.next();
    if (secondResult.done && !chunkHasAnyText(firstResult.value)) {
      const emptyErr: any = new Error('Model returned an empty stream.');
      emptyErr.status = 502;
      throw emptyErr;
    }
    return {
      iterator,
      initialChunks: [firstResult.value, secondResult.done ? null : secondResult.value].filter(Boolean),
    };
  }
  return { iterator, initialChunks: [firstResult.value] };
}

async function generateStreamWithFailover(params: any, routePlan: SilentRoutePlan) {
  const configuredKeys = getConfiguredApiKeys();
  if (configuredKeys.length === 0) {
    throw new Error('AI backend service is not configured.');
  }

  const attempts = buildFailoverAttempts(
    params,
    routePlan.tier,
    routePlan.includeThoughts,
    routePlan.fallbackModels
  );

  let lastError: any = null;

  for (let pass = 0; pass < attempts.length; pass++) {
    const attemptParams = attempts[pass];
    const hasNextModelPass = pass < attempts.length - 1;
    const { healthy, all } = getOrderedApiKeys(attemptParams.model);

    // If all keys are already cooling down for the primary model and a fast fallback model exists, skip straight to fallback
    if (hasNextModelPass && healthy.length === 0) {
      continue;
    }

    const passKeys = hasNextModelPass ? healthy : all;

    for (let i = 0; i < passKeys.length; i++) {
      const apiKey = passKeys[i];
      const client = getGeminiClient(apiKey);
      const hasFallbackRemaining = hasNextModelPass || i < passKeys.length - 1;
      const firstChunkTimeoutMs = hasNextModelPass
        ? routePlan.tier === 'deep'
          ? 18_000
          : 12_000
        : hasFallbackRemaining
          ? 16_000
          : 30_000;

      const maxKeyTries = !hasNextModelPass ? 3 : pass === 0 && passKeys.length === 1 ? 2 : 1;
      for (let retry = 0; retry < maxKeyTries; retry++) {
        try {
          const result = await withTimeout(
            executeStreamAttempt(client, attemptParams),
            firstChunkTimeoutMs,
            `Stream (${attemptParams.model})`
          );
          markKeySuccess(apiKey, attemptParams.model);
          return result;
        } catch (err: any) {
          lastError = err;
          const status = Number(err?.status || err?.code) || 500;
          const upperMsg = String(err?.message || '').toUpperCase();
          const isRateLimitErr = status === 429 || upperMsg.includes('RESOURCE_EXHAUSTED');
          const isTransientErr = status === 503 || status === 502;
          if (retry + 1 < maxKeyTries) {
            if (isTransientErr) {
              await new Promise((r) => setTimeout(r, 450 + Math.floor(Math.random() * 250)));
              continue;
            }
            if (isRateLimitErr && !hasNextModelPass) {
              const defaultBackoff = (retry + 1) * 1400 + Math.floor(Math.random() * 500);
              const backoffMs = parseRetryAfterMs(err, defaultBackoff);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
          }
          markKeyFailure(apiKey, attemptParams.model, err);
          console.log(
            `[Longclaw] Key slot #${i + 1} (${attemptParams.model}) returned ${err?.status || err?.code || 'ERR'}, trying next fallback...`
          );
          break;
        }
      }

      if (hasNextModelPass && Number(lastError?.status) === 504) {
        break;
      }
    }

    if (lastError && !isRetryableUpstreamError(lastError)) {
      break;
    }
  }

  // Final cross-model 429 recovery: if primary was skipped due to cooldown and fallback hit 429, try primary once after a brief pause
  const lastStatus = Number(lastError?.status || lastError?.code) || 500;
  const lastUpper = String(lastError?.message || '').toUpperCase();
  if (
    attempts.length > 1 &&
    (lastStatus === 429 || lastUpper.includes('RESOURCE_EXHAUSTED'))
  ) {
    const recoveryParams = attempts[0];
    const recoveryKey = getConfiguredApiKeys()[0];
    if (recoveryKey) {
      await new Promise((r) => setTimeout(r, parseRetryAfterMs(lastError, 2_000)));
      try {
        const client = getGeminiClient(recoveryKey);
        const recovered = await withTimeout(
          executeStreamAttempt(client, recoveryParams),
          20_000,
          `Stream recovery (${recoveryParams.model})`
        );
        markKeySuccess(recoveryKey, recoveryParams.model);
        return recovered;
      } catch (recoveryErr: any) {
        lastError = recoveryErr;
      }
    }
  }

  throw lastError || new Error('AI backend request failed.');
}

async function generateContentWithFailover(params: any, timeoutMs = 15_000) {
  const configuredKeys = getConfiguredApiKeys();
  if (configuredKeys.length === 0) {
    throw new Error('AI backend service is not configured.');
  }

  const attempts = buildFailoverAttempts(params, 'instant', false);

  let lastError: any = null;

  for (let pass = 0; pass < attempts.length; pass++) {
    const attemptParams = attempts[pass];
    const hasNextModelPass = pass < attempts.length - 1;
    const { healthy, all } = getOrderedApiKeys(attemptParams.model);

    if (hasNextModelPass && healthy.length === 0) {
      continue;
    }

    const passKeys = hasNextModelPass ? healthy : all;
    const effectiveTimeoutMs = hasNextModelPass ? Math.min(timeoutMs, 15_000) : timeoutMs;

    for (let i = 0; i < passKeys.length; i++) {
      const apiKey = passKeys[i];
      const client = getGeminiClient(apiKey);
      const maxKeyTries = !hasNextModelPass ? 3 : pass === 0 && passKeys.length === 1 ? 2 : 1;

      for (let retry = 0; retry < maxKeyTries; retry++) {
        try {
          const response = await withTimeout(
            client.models.generateContent(attemptParams),
            effectiveTimeoutMs,
            `Generate (${attemptParams.model})`
          );
          markKeySuccess(apiKey, attemptParams.model);
          return response;
        } catch (err: any) {
          lastError = err;
          const status = Number(err?.status || err?.code) || 500;
          const upperMsg = String(err?.message || '').toUpperCase();
          const isRateLimitErr = status === 429 || upperMsg.includes('RESOURCE_EXHAUSTED');
          if (retry + 1 < maxKeyTries) {
            if (status === 503 || status === 502) {
              await new Promise((r) => setTimeout(r, 450 + Math.floor(Math.random() * 250)));
              continue;
            }
            if (isRateLimitErr && !hasNextModelPass) {
              const backoffMs = (retry + 1) * 1250 + Math.floor(Math.random() * 450);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
          }
          markKeyFailure(apiKey, attemptParams.model, err);
          break;
        }
      }

      if (hasNextModelPass && Number(lastError?.status) === 504) {
        break;
      }
    }

    if (lastError && !isRetryableUpstreamError(lastError)) {
      break;
    }
  }

  throw lastError || new Error('AI backend request failed.');
}

// Minimal healthcheck endpoint (omits internal backend configuration details)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    appName: 'Longclaw',
    uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000),
  });
});

// Stream Gemini Chat completion
app.post('/api/chat', chatRateLimit, async (req: Request, res: Response) => {
  const uiLang = resolveUiLang(req.body);
  try {
    const {
      messages,
      depth = 'mid',
      mode = 'chat',
      model,
      nowIso,
      timeZone,
      gmailConnected = false,
      gmailContext = [],
      workspaceContext = {},
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error:
          uiLang === 'en'
            ? 'Messages must be a non-empty list.'
            : 'Mesaj listesi geçerli ve dolu olmalıdır.',
      });
    }

    const trimmedMessages = messages.slice(-60);
    const calEvents = Array.isArray(workspaceContext?.calendar) ? workspaceContext.calendar : [];
    const driveFiles = Array.isArray(workspaceContext?.drive) ? workspaceContext.drive : [];
    const docItems = Array.isArray(workspaceContext?.docs) ? workspaceContext.docs : [];
    const taskItems = Array.isArray(workspaceContext?.tasks) ? workspaceContext.tasks : [];

    const hasGmailContext = Array.isArray(gmailContext) && gmailContext.length > 0;
    const hasAttachedImages = trimmedMessages.some(
      (m: any) => Array.isArray(m?.images) && m.images.length > 0
    );
    const hasWorkspaceContext =
      hasGmailContext ||
      calEvents.length > 0 ||
      driveFiles.length > 0 ||
      docItems.length > 0 ||
      taskItems.length > 0;
    const publicModel = resolvePublicModel(model);
    const routePlan = assessSilentRoutePlan({
      messages: trimmedMessages,
      depth,
      publicModel,
      hasAttachedImages,
      hasWorkspaceContext,
    });
    const selectedModel = routePlan.primaryModel;

    if (getConfiguredApiKeys().length === 0) {
      return res.status(503).json({
        error:
          uiLang === 'en'
            ? 'The AI service is not configured right now. Please try again later.'
            : 'Yapay zekâ servisi şu anda yapılandırılmamış. Lütfen daha sonra tekrar dene.',
      });
    }

    let workspaceContextBlock = '';
    if (hasGmailContext) {
      const formattedEmails = gmailContext
        .slice(0, 10)
        .map((m: any, idx: number) => {
          const from = String(m?.from || '').slice(0, 160);
          const subject = String(m?.subject || '(No subject)').slice(0, 200);
          const date = String(m?.date || '').slice(0, 80);
          const status = m?.unread ? '[UNREAD] ' : '';
          const bodyText = String(m?.body || m?.snippet || '').slice(0, 1200);
          return `${idx + 1}. ${status}From: ${from}\n   Date: ${date}\n   Subject: ${subject}\n   Body: ${bodyText}`;
        })
        .join('\n\n');
      workspaceContextBlock += `Recent emails fetched with user permission from Gmail:\n${formattedEmails}\n\nBase your answer strictly on this real email data; never invent email details.`;
    }
    if (calEvents.length > 0) {
      const formattedEvents = calEvents
        .slice(0, 10)
        .map((ev: any, idx: number) => {
          const summary = String(ev?.summary || '(Untitled)').slice(0, 180);
          const start = String(ev?.start || '').slice(0, 60);
          const end = String(ev?.end || '').slice(0, 60);
          const loc = ev?.location ? ` · Location: ${String(ev.location).slice(0, 120)}` : '';
          const desc = ev?.description ? `\n   Notes: ${String(ev.description).slice(0, 300)}` : '';
          return `${idx + 1}. ${summary} (${start}${end ? ` → ${end}` : ''})${loc}${desc}`;
        })
        .join('\n');
      workspaceContextBlock += `\n\nUpcoming Google Calendar events fetched with user permission:\n${formattedEvents}`;
    }
    if (driveFiles.length > 0) {
      const formattedDrive = driveFiles
        .slice(0, 12)
        .map((f: any, idx: number) => {
          const name = String(f?.name || 'File').slice(0, 160);
          const type = String(f?.mimeType || '').slice(0, 80);
          const mod = String(f?.modifiedTime || '').slice(0, 40);
          return `${idx + 1}. ${name} (${type}, modified: ${mod})`;
        })
        .join('\n');
      workspaceContextBlock += `\n\nRecent Google Drive files fetched with user permission:\n${formattedDrive}`;
    }
    if (docItems.length > 0) {
      const formattedDocs = docItems
        .slice(0, 5)
        .map((d: any, idx: number) => {
          const name = String(d?.name || 'Document').slice(0, 160);
          const excerpt = String(d?.excerpt || d?.content || '').slice(0, 1500);
          return `${idx + 1}. ${name}${excerpt ? `\n   Content:\n   ${excerpt}` : ''}`;
        })
        .join('\n\n');
      workspaceContextBlock += `\n\nGoogle Docs fetched with user permission:\n${formattedDocs}`;
    }
    if (taskItems.length > 0) {
      const formattedTasks = taskItems
        .slice(0, 15)
        .map((tk: any, idx: number) => {
          const done = tk?.status === 'completed' ? '[DONE]' : '[OPEN]';
          const title = String(tk?.title || '').slice(0, 180);
          const due = tk?.due ? ` · Due: ${String(tk.due).slice(0, 30)}` : '';
          const notes = tk?.notes ? ` — ${String(tk.notes).slice(0, 200)}` : '';
          return `${idx + 1}. ${done} ${title}${due}${notes}`;
        })
        .join('\n');
      workspaceContextBlock += `\n\nGoogle Tasks fetched with user permission:\n${formattedTasks}`;
    }

    const systemPrompt = buildTrainedChatSystemPrompt({
      publicModel,
      lang: uiLang,
      depth,
      mode,
      tier: routePlan.tier,
      nowIso,
      timeZone,
      gmailConnected: Boolean(gmailConnected),
      workspaceContextBlock: workspaceContextBlock.trim(),
    });

    // Format and sanitize multimodal contents (text + inline image data) for @google/genai.
    // Enforces strictly alternating user/model roles starting with 'user' and drops synthetic client error bubbles.
    const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
    const rawContents: Array<{ role: 'user' | 'model'; parts: ContentPart[] }> = [];

    for (const m of trimmedMessages as Array<{
      role?: string;
      content?: string;
      images?: Array<{ mimeType?: string; dataUrl?: string }>;
    }>) {
      const role: 'user' | 'model' = m?.role === 'assistant' || m?.role === 'model' ? 'model' : 'user';
      const parts: ContentPart[] = [];

      if (Array.isArray(m?.images) && m.images.length > 0) {
        for (const img of m.images.slice(0, 4)) {
          const raw = typeof img === 'string' ? img : String(img?.dataUrl || '');
          const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
          if (match) {
            const mimeType = match[1].toLowerCase();
            const data = match[2];
            if (ALLOWED_IMAGE_MIMES.has(mimeType) && data.length > 32) {
              parts.push({ inlineData: { mimeType, data } });
            }
          }
        }
      }

      const textContent = String(m?.content || '').trim().slice(0, 32_000);
      // Skip synthetic error bubbles from prior failed requests so they never pollute multi-turn context
      if (role === 'model' && parts.length === 0 && /^(?:⚠️|\[?(?:Hata|Error)\]?:)/i.test(textContent)) {
        continue;
      }

      if (textContent) {
        parts.push({ text: textContent });
      } else if (parts.length > 0) {
        parts.push({
          text:
            uiLang === 'en'
              ? 'Please examine this image and help me with it.'
              : 'Lütfen bu görseli incele ve açıkla.',
        });
      } else {
        continue;
      }

      rawContents.push({ role, parts });
    }

    // Strip any leading model turns and merge adjacent same-role turns so Gemini never rejects role ordering
    const contents: Array<{ role: 'user' | 'model'; parts: ContentPart[] }> = [];
    for (const item of rawContents) {
      if (contents.length === 0 && item.role === 'model') {
        continue;
      }
      const prev = contents[contents.length - 1];
      if (prev && prev.role === item.role) {
        prev.parts = [...prev.parts, ...item.parts];
      } else {
        contents.push({ role: item.role, parts: [...item.parts] });
      }
    }

    if (contents.length === 0) {
      return res.status(400).json({
        error:
          uiLang === 'en'
            ? 'Please enter a message before sending.'
            : 'Göndermeden önce bir mesaj yaz.',
      });
    }

    // Silently apply model-appropriate thinking effort for the routed tier
    const effort = resolveThinkingForModel(
      selectedModel,
      routePlan.tier,
      routePlan.includeThoughts
    );

    const config: any = {
      systemInstruction: systemPrompt,
      ...(effort
        ? {
            thinkingConfig: {
              thinkingLevel: effort.level,
              includeThoughts: effort.includeThoughts,
            },
          }
        : {}),
    };

    const { iterator, initialChunks } = await generateStreamWithFailover(
      {
        model: selectedModel,
        contents,
        config,
      },
      routePlan
    );

    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
    });

    // Set streaming headers (JSON Lines / ndjson) only after stream starts cleanly
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (!process.env.VERCEL) {
      res.setHeader('Connection', 'keep-alive');
    }
    res.flushHeaders?.();

    let emittedAnyAnswerText = false;

    const writeChunk = (chunk: any) => {
      if (clientClosed || res.writableEnded) return;
      const candidate = chunk?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      let emittedFromParts = false;

      for (const part of parts) {
        if (!part.text) continue;
        if ((part as any).thought) {
          res.write(JSON.stringify({ t: 'th', x: part.text }) + '\n');
        } else {
          emittedFromParts = true;
          emittedAnyAnswerText = true;
          res.write(JSON.stringify({ t: 'tx', x: part.text }) + '\n');
        }
      }

      // Fallback if chunk.text is populated outside parts
      if (!emittedFromParts && chunk?.text) {
        emittedAnyAnswerText = true;
        res.write(JSON.stringify({ t: 'tx', x: chunk.text }) + '\n');
      }
    };

    // Lightweight keep-alive heartbeat prevents idle proxy drops during long deep-thinking intervals
    const heartbeatTimer = setInterval(() => {
      if (!clientClosed && !res.writableEnded) {
        try {
          res.write(JSON.stringify({ t: 'hb' }) + '\n');
        } catch {}
      }
    }, 12_000);

    try {
      for (const initialChunk of initialChunks) {
        if (clientClosed || res.writableEnded) break;
        writeChunk(initialChunk);
      }

      while (!clientClosed && !res.writableEnded) {
        const next = await withTimeout(
          iterator.next(),
          35_000,
          `Stream chunk (${selectedModel})`
        );
        if (next.done || clientClosed || res.writableEnded) {
          break;
        }
        if (next.value) writeChunk(next.value);
      }

      if (!clientClosed && !res.writableEnded && !emittedAnyAnswerText) {
        res.write(
          JSON.stringify({
            t: 'err',
            x:
              uiLang === 'en'
                ? 'The model returned an empty reply. Please try sending your message again.'
                : 'Model boş bir yanıt döndürdü. Lütfen mesajını tekrar gönder.',
          }) + '\n'
        );
      }
    } finally {
      clearInterval(heartbeatTimer);
    }

    if (clientClosed) {
      await iterator.return?.(undefined).catch(() => {});
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (err: any) {
    console.error('Gemini Chat error:', sanitizeForLog(err));
    const formatted = formatGeminiError(err, uiLang);
    if (res.writableEnded) return;
    if (res.headersSent) {
      res.write(JSON.stringify({ t: 'err', x: formatted.message }) + '\n');
      res.end();
    } else {
      res.status(formatted.status).json({ error: formatted.message });
    }
  }
});

function buildLocalFallbackTitle(raw: string, fallbackDefault: string): string {
  const cleaned = String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^["'“”’.\s]+|["'“”’.\s]+$/g, '')
    .trim();
  if (!cleaned) return fallbackDefault;
  if (cleaned.length <= 36) return cleaned;
  const sliced = cleaned.slice(0, 36);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > 14 ? sliced.slice(0, lastSpace) : sliced).trim();
}

// Auto-title chat endpoint (uses fast unpaid model with multi-key failover and silent title fallback)
app.post('/api/name-chat', titleRateLimit, async (req: Request, res: Response) => {
  const uiLang = resolveUiLang(req.body);
  const fallbackDefault = uiLang === 'en' ? 'New chat' : 'Yeni sohbet';
  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const resolvedUserMessage = String(
    req.body?.userMessage ??
      rawMessages.find((m: any) => m?.role !== 'assistant')?.content ??
      ''
  ).trim();
  const resolvedAssistantMessage = String(
    req.body?.assistantMessage ??
      rawMessages.find((m: any) => m?.role === 'assistant')?.content ??
      ''
  ).trim();
  const localTitle = buildLocalFallbackTitle(resolvedUserMessage, fallbackDefault);
  try {
    if ((!resolvedUserMessage && !resolvedAssistantMessage) || getConfiguredApiKeys().length === 0) {
      return res.json({ title: localTitle });
    }

    const prompt =
      uiLang === 'en'
        ? `Give this conversation a crisp 2-4 word title in the same language as the user's message. Output ONLY the title — no quotes, periods, emojis, or extra text.

User: ${resolvedUserMessage.slice(0, 500)}
Assistant: ${resolvedAssistantMessage.slice(0, 500)}`
        : `Aşağıdaki konuşmaya kullanıcının mesaj diliyle aynı dilde 2-4 kelimelik kısa, net bir başlık ver. Tırnak, nokta, emoji ve fazladan açıklama olmadan SADECE başlığı yaz.

Kullanıcı: ${resolvedUserMessage.slice(0, 500)}
Asistan: ${resolvedAssistantMessage.slice(0, 500)}`;

    const response = await generateContentWithFailover(
      {
        model: FALLBACK_UNPAID_MODEL,
        contents: prompt,
        config: {
          maxOutputTokens: 24,
        },
      },
      8_000
    );

    const cleanTitle = (response.text || '')
      .trim()
      .split('\n')[0]
      .replace(/^["'“”’.\s]+|["'“”’.\s]+$/g, '')
      .slice(0, 40);

    res.json({ title: cleanTitle || localTitle });
  } catch {
    res.json({ title: localTitle });
  }
});

const serverImageCache = new Map<string, { buffer: Buffer; contentType: string }>();

function cacheServerImage(url: string, data: { buffer: Buffer; contentType: string }) {
  serverImageCache.set(url, data);
  if (serverImageCache.size > 40) {
    const oldest = serverImageCache.keys().next().value;
    if (oldest) serverImageCache.delete(oldest);
  }
}

const MAX_PROXY_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB cap

function isAllowedPollinationsUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'image.pollinations.ai' &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname.startsWith('/prompt/') &&
      !parsed.pathname.includes('..')
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

class PollinationsRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'PollinationsRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function fetchPollinationsImage(
  imageUrl: string,
  timeoutMs = 35_000
): Promise<{ buffer: Buffer; contentType: string }> {
  const validatedInitial = isAllowedPollinationsUrl(imageUrl);
  if (!validatedInitial) {
    throw new Error('Disallowed image URL');
  }

  const normalizedInitial = validatedInitial.toString();
  const cached = serverImageCache.get(normalizedInitial);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let currentUrl = normalizedInitial;
    let res: globalThis.Response | null = null;

    // Manually validate every redirect hop against the strict host allowlist (blocks redirect SSRF)
    for (let hop = 0; hop < 3; hop++) {
      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'image/jpeg,image/png,image/webp,image/*',
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error('Image service redirect missing target.');
        }
        const nextResolved = new URL(location, currentUrl).toString();
        const validatedNext = isAllowedPollinationsUrl(nextResolved);
        if (!validatedNext) {
          throw new Error('Blocked disallowed image redirect target.');
        }
        currentUrl = validatedNext.toString();
        continue;
      }
      break;
    }

    if (!res) {
      throw new Error('Image service returned no response.');
    }
    if (res.status === 402 || res.status === 429) {
      const headerRetryRaw = res.headers.get('retry-after');
      let retryAfterSeconds = 0;
      if (headerRetryRaw) {
        const asNum = Number(headerRetryRaw);
        if (Number.isFinite(asNum) && asNum > 0) {
          retryAfterSeconds = Math.ceil(asNum);
        } else {
          const asDate = Date.parse(headerRetryRaw);
          if (Number.isFinite(asDate)) {
            retryAfterSeconds = Math.max(1, Math.ceil((asDate - Date.now()) / 1000));
          }
        }
      }
      if (!retryAfterSeconds) {
        const bodyText = await res.text().catch(() => '');
        const retryMatch = bodyText.match(/retry\s+after\s+(\d+)\s*s/i);
        retryAfterSeconds = retryMatch ? Math.max(1, Number(retryMatch[1])) : 12;
      }
      throw new PollinationsRateLimitError(
        `Rate limit reached; retry after ${retryAfterSeconds}s`,
        retryAfterSeconds
      );
    }
    if (!res.ok) {
      throw new Error(`Image service returned HTTP ${res.status}`);
    }
    const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!contentType.startsWith('image/')) {
      throw new Error(`Unexpected response type from image service: ${contentType}`);
    }
    const declaredLength = Number(res.headers.get('content-length') || 0);
    if (declaredLength > MAX_PROXY_IMAGE_BYTES) {
      throw new Error('Generated image exceeded maximum allowed size.');
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_PROXY_IMAGE_BYTES) {
      throw new Error('Generated image exceeded maximum allowed size.');
    }
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 1024) {
      throw new Error('Generated image payload was unexpectedly small.');
    }
    const result = { buffer, contentType };
    cacheServerImage(normalizedInitial, result);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

// Same-origin proxy strictly limited to Pollinations generated image URLs (with in-memory LRU cache)
app.get('/api/image-proxy', proxyRateLimit, async (req: Request, res: Response) => {
  const rawUrl = String(req.query.url || '').trim();
  const parsed = isAllowedPollinationsUrl(rawUrl);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid image URL' });
  }
  try {
    const { buffer, contentType } = await fetchPollinationsImage(parsed.toString(), 35_000);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err: any) {
    console.error('Image proxy error:', sanitizeForLog(err));
    return res.status(err instanceof PollinationsRateLimitError ? 429 : 502).json({
      error: 'Could not load generated image.',
    });
  }
});

// Two-stage real raster image generation without a paid image API:
// 1) Free-tier Gemini (gemini-4-hydrogen) art-directs & translates the user's request into a vivid English diffusion prompt + localized title/caption.
// 2) Free zero-key Pollinations.ai diffusion engine renders the actual pixel image.
app.post('/api/generate-image', imageRateLimit, async (req: Request, res: Response) => {
  const uiLang = resolveUiLang(req.body);
  try {
    const prompt = String(req.body?.prompt || '').trim().slice(0, 2000);
    const rawRatio = String(req.body?.aspectRatio || '1:1');
    const aspectRatio: '1:1' | '16:9' | '4:3' | '9:16' =
      rawRatio === '16:9' || rawRatio === '4:3' || rawRatio === '9:16' ? rawRatio : '1:1';

    if (!prompt) {
      return res.status(400).json({
        error:
          uiLang === 'en'
            ? 'Please describe the image you want.'
            : 'Lütfen oluşturmak istediğin görseli tarif et.',
      });
    }

    const dims =
      aspectRatio === '16:9'
        ? { w: 1024, h: 576 }
        : aspectRatio === '4:3'
          ? { w: 896, h: 672 }
          : aspectRatio === '9:16'
            ? { w: 576, h: 1024 }
            : { w: 896, h: 896 };

    let title = buildLocalFallbackTitle(
      prompt,
      uiLang === 'en' ? 'Generated Image' : 'Oluşturulan Görsel'
    );
    let caption =
      uiLang === 'en'
        ? 'Here is the generated image for your request.'
        : 'İstediğin tarife göre görseli oluşturdum.';
    let enhancedPrompt = prompt;

    // Stage 1: Ask free-tier Gemini to craft a rich English visual prompt + localized title & caption
    if (getConfiguredApiKeys().length > 0) {
      try {
        const promptSystemInstruction = `You are an expert visual art director and diffusion prompt engineer.
Given a user's image request in any language, output ONLY a JSON object with:
- "title": a crisp 2-5 word title in ${uiLang === 'en' ? 'English' : 'Turkish'}.
- "caption": 1 short, natural, friendly sentence in ${uiLang === 'en' ? 'English' : 'Turkish'} presenting the image.
- "enhancedPrompt": a vivid, detailed English image-generation prompt (30-55 words, single paragraph, under 320 characters) faithfully capturing the user's exact subject with rich lighting, composition, textures, lens/art style, and atmosphere. Do not add watermarks, logos, or unwanted text.`;

        const geminiRes = await generateContentWithFailover(
          {
            model: FALLBACK_UNPAID_MODEL,
            contents: `User image request: "${prompt}"\nAspect ratio: ${aspectRatio}`,
            config: {
              systemInstruction: promptSystemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  caption: { type: Type.STRING },
                  enhancedPrompt: { type: Type.STRING },
                },
                required: ['title', 'caption', 'enhancedPrompt'],
              },
            },
          },
          8_000
        );

        const rawText = (geminiRes.text || '').trim();
        let parsed: { title?: string; caption?: string; enhancedPrompt?: string } = {};
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const cleaned = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
          parsed = JSON.parse(cleaned);
        }

        if (parsed.title && typeof parsed.title === 'string') {
          title = parsed.title.trim().slice(0, 60);
        }
        if (parsed.caption && typeof parsed.caption === 'string') {
          caption = parsed.caption.trim().slice(0, 240);
        }
        if (parsed.enhancedPrompt && typeof parsed.enhancedPrompt === 'string') {
          enhancedPrompt = parsed.enhancedPrompt.trim().replace(/\s+/g, ' ').slice(0, 340);
        }
      } catch (geminiErr: any) {
        console.log(
          '[Longclaw] Gemini prompt enhancement skipped, using direct prompt:',
          geminiErr?.message || 'err'
        );
      }
    }

    // Stage 2: Render the real pixel image via Pollinations.ai (no API key required)
    const buildPollinationsUrl = () => {
      const seed = Math.floor(Math.random() * 900_000_000) + 100_000;
      return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${dims.w}&height=${dims.h}&nologo=true&seed=${seed}`;
    };
    let finalUrl = buildPollinationsUrl();

    let fetched: { buffer: Buffer; contentType: string };
    try {
      fetched = await fetchPollinationsImage(finalUrl, 28_000);
    } catch (firstErr: any) {
      if (firstErr instanceof PollinationsRateLimitError) {
        // If only a short cooldown remains (<= 14s), wait smoothly and succeed automatically
        if (firstErr.retryAfterSeconds <= 14) {
          await new Promise((resolve) =>
            setTimeout(resolve, (firstErr.retryAfterSeconds + 1) * 1000)
          );
          fetched = await fetchPollinationsImage(finalUrl, 28_000);
        } else {
          return res.status(429).json({
            error:
              uiLang === 'en'
                ? `Please wait ${firstErr.retryAfterSeconds} seconds before creating another image.`
                : `Yeni bir görsel oluşturmadan önce lütfen ${firstErr.retryAfterSeconds} saniye bekle.`,
          });
        }
      } else {
        // Retry once with a fresh seed on transient upstream 5xx/network hiccups
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        finalUrl = buildPollinationsUrl();
        fetched = await fetchPollinationsImage(finalUrl, 28_000);
      }
    }

    const imageDataUrl = `data:${fetched.contentType};base64,${fetched.buffer.toString('base64')}`;

    return res.json({
      title,
      caption,
      enhancedPrompt,
      imageUrl: finalUrl,
      imageDataUrl,
      aspectRatio,
    });
  } catch (err: any) {
    if (err instanceof PollinationsRateLimitError) {
      return res.status(429).json({
        error:
          uiLang === 'en'
            ? `Please wait ${err.retryAfterSeconds} seconds before creating another image.`
            : `Yeni bir görsel oluşturmadan önce lütfen ${err.retryAfterSeconds} saniye bekle.`,
      });
    }
    console.error('Image generation error:', sanitizeForLog(err));
    return res.status(502).json({
      error:
        uiLang === 'en'
          ? 'Could not create the image right now. Please try again in a few seconds.'
          : 'Görsel şu an oluşturulamadı. Birkaç saniye sonra tekrar dene.',
    });
  }
});

// Direct Google Workspace connector command planner (/gmail, /takvim, /drive, /döküman, /görev)
// Plans an immediate, zero-question action payload in strict JSON so the client executes it directly.
app.post('/api/workspace-command', workspaceRateLimit, async (req: Request, res: Response) => {
  const uiLang = resolveUiLang(req.body);
  try {
    const connector = String(req.body?.connector || '').trim() as
      | 'gmail'
      | 'calendar'
      | 'drive'
      | 'docs'
      | 'tasks';
    const instruction = String(req.body?.instruction || '').trim().slice(0, 4000);
    const nowIso = String(req.body?.nowIso || new Date().toISOString());
    const timeZone = String(req.body?.timeZone || 'UTC');
    const context = req.body?.context || {};

    if (!['gmail', 'calendar', 'drive', 'docs', 'tasks'].includes(connector)) {
      return res.status(400).json({ error: 'Invalid connector.' });
    }

    if (getConfiguredApiKeys().length === 0) {
      return res.status(503).json({
        error:
          uiLang === 'en'
            ? 'Workspace assistant is currently unavailable.'
            : 'Workspace asistanı şu anda kullanılamıyor.',
      });
    }

    const connectorSchemas: Record<string, string> = {
      gmail: `Connector: Gmail
Allowed operations:
1) "create_draft": Save a real draft directly in Gmail.
   payload: { "to": string (email if known, else ""), "subject": string, "body": string }
2) "send_email": Only when the user explicitly says send/gönder/yolla AND provides or implies a valid recipient email address (or matches one in context).
   payload: { "to": string (valid email address), "subject": string, "body": string }
3) "read_summary": When the user wants to read, search, check, or summarize their inbox/emails (or gave an empty instruction).
   payload: {}
   reply: detailed, helpful markdown answer based ONLY on the provided Gmail context.`,

      calendar: `Connector: Google Calendar
Allowed operations:
1) "create_event": Create a new event on the user's primary calendar right away.
   payload: { "summary": string, "startIso": string (full ISO-8601 with timezone offset or Z), "endIso": string (default 1 hour after startIso if not specified), "location": string, "description": string }
2) "update_event": Update an existing event from context when the user explicitly asks to move/reschedule/rename an existing event.
   payload: { "eventId": string (exact id from context), "existingSummary": string, "summary": string, "startIso": string, "endIso": string, "location": string, "description": string }
3) "delete_event": Delete an existing event from context when the user explicitly asks to delete/cancel/remove an event.
   payload: { "eventId": string (exact id from context), "existingSummary": string }
4) "read_summary": When the user asks to view/check/summarize their schedule or gave an empty instruction.
   payload: {}
   reply: clear markdown answer based ONLY on the provided Calendar events.`,

      drive: `Connector: Google Drive
Allowed operations:
1) "create_folder": Create a new folder in Google Drive when the user asks to make/create a folder/klasör.
   payload: { "name": string }
2) "create_file": Create a new text/markdown/csv/json file with full ready-to-use content in Google Drive.
   payload: { "name": string (include extension like .txt or .md), "content": string (write complete, high-quality content), "mimeType": "text/plain" | "text/markdown" | "text/csv" | "application/json" }
3) "read_summary": When the user wants to find, list, check, or summarize their Drive files (or gave an empty instruction).
   payload: {}
   reply: clear markdown answer based ONLY on the provided Drive files.`,

      docs: `Connector: Google Docs
Allowed operations:
1) "create_doc": Create a brand-new Google Doc and write full, polished, well-structured content inside it immediately.
   payload: { "title": string, "content": string (write rich, ready-to-use document body text with clean headings/paragraphs; no markdown code fences) }
2) "append_doc": Append new text to an existing Google Doc from context when the user explicitly names an existing doc to add/append to.
   payload: { "documentId": string (exact id from context), "existingTitle": string, "content": string }
3) "read_summary": When the user wants to read, inspect, or summarize their existing Google Docs (or gave an empty instruction).
   payload: {}
   reply: clear markdown answer based ONLY on the provided Docs context.`,

      tasks: `Connector: Google Tasks
Allowed operations:
1) "create_task": Add a new task immediately.
   payload: { "title": string, "notes": string, "dueDate": string (YYYY-MM-DD or empty string if no due date) }
2) "complete_task": Mark an existing task from context as completed/done.
   payload: { "taskId": string (exact id from context), "taskTitle": string, "completed": boolean }
3) "delete_task": Delete an existing task from context when explicitly requested.
   payload: { "taskId": string (exact id from context), "taskTitle": string }
4) "read_summary": When the user wants to view/list/summarize their tasks (or gave an empty instruction).
   payload: {}
   reply: clear markdown answer based ONLY on the provided Tasks context.`,
    };

    const systemInstruction = `You are Longclaw's direct Google Workspace action planner.
Current user local time: ${nowIso}
User timezone: ${timeZone}
Preferred response language: ${uiLang === 'en' ? 'English' : 'Turkish'} (always match the user's instruction language if they wrote in another language).

CRITICAL RULES:
- NEVER ask clarifying follow-up questions. Always infer sensible, complete defaults and immediately produce an executable action.
- If the user asks to create a document, write the full, thoughtful document content right away — do not leave placeholders.
- If the user asks to schedule a meeting/event without specifying duration, default to 1 hour. If no time of day is specified for a date, default to 10:00 local time. Always output valid ISO-8601 timestamps with the correct offset for ${timeZone}.
- If the user asks to write an email without saying "send/gönder", or without providing an email address, use "create_draft" so it saves straight to Gmail Drafts immediately.
- If the user explicitly asks to send an email AND an email address is known (in instruction or context), use "send_email".
- Output ONLY a single valid JSON object matching:
{
  "operation": string,
  "payload": object,
  "reply": string
}
- "reply" should be a concise, natural, human-sounding confirmation (or full summary for read_summary) written in the user's language.

${connectorSchemas[connector]}`;

    const compactContext = JSON.stringify(context).slice(0, 12_000);
    const userPrompt = `User command instruction: ${instruction || '(List / summarize current items)'}\n\nLive connector context:\n${compactContext}`;

    const aiRes = await generateContentWithFailover(
      {
        model: DEFAULT_BACKEND_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      },
      14_000
    );

    const rawText = (aiRes.text || '').trim();
    let parsed: { operation?: string; payload?: Record<string, any>; reply?: string } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed || typeof parsed.operation !== 'string') {
      throw new Error('Could not plan Workspace action.');
    }

    return res.json({
      connector,
      operation: parsed.operation,
      payload: parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : {},
      reply: typeof parsed.reply === 'string' ? parsed.reply.trim() : '',
    });
  } catch (err: any) {
    console.error('Workspace command planner error:', sanitizeForLog(err));
    const formatted = formatGeminiError(err, uiLang);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// Audio transcription endpoint for voice prompt dictation in the chat composer
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/aac',
  'audio/flac',
]);

function normalizeAudioMimeType(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const base = raw.split(';')[0].trim().toLowerCase();
  if (base === 'audio/x-m4a') return 'audio/mp4';
  if (base === 'audio/x-wav' || base === 'audio/wave') return 'audio/wav';
  return ALLOWED_AUDIO_MIMES.has(base) ? base : null;
}

async function transcribeAudioWithFailover(
  audioBase64: string,
  mimeType: string,
  uiLang: 'en' | 'tr'
): Promise<string> {
  const configuredKeys = getConfiguredApiKeys();
  if (configuredKeys.length === 0) {
    throw new Error('Transcription service is not configured.');
  }

  const promptText =
    uiLang === 'en'
      ? 'Transcribe the spoken words accurately in the exact language spoken (preserving natural punctuation). Output ONLY the transcribed text with no preamble, labels, timestamps, or commentary. If there is only silence or background noise with no speech, return an empty string.'
      : 'Konuşulan sözleri konuşulduğu dilde (Türkçe veya başka bir dilse aynen o dilde) doğru noktalama ile metne dök. Başlık, zaman damgası, ön söz veya açıklama eklemeden SADECE konuşulan metni yaz. Konuşma yoksa yalnızca sessizlik veya arka plan gürültüsü varsa boş metin döndür.';

  const audioPart = {
    inlineData: {
      mimeType,
      data: audioBase64,
    },
  };

  const transcribeModels = [
    'gemini-3.5-transcribe',
    'gemini-3.1-flash-lite',
    'gemini-4-hydrogen',
  ];

  let lastError: any = null;

  for (let pass = 0; pass < transcribeModels.length; pass++) {
    const model = transcribeModels[pass];
    const hasNextModel = pass < transcribeModels.length - 1;
    const { healthy, all } = getOrderedApiKeys(model);

    if (hasNextModel && healthy.length === 0) {
      continue;
    }

    const passKeys = hasNextModel ? healthy : all;
    const timeoutMs = hasNextModel ? 12_000 : 20_000;

    for (let i = 0; i < passKeys.length; i++) {
      const apiKey = passKeys[i];
      const client = getGeminiClient(apiKey);
      try {
        const response = await withTimeout(
          client.models.generateContent({
            model,
            contents: {
              parts: [audioPart, { text: promptText }],
            },
          }),
          timeoutMs,
          `Transcribe (${model})`
        );
        markKeySuccess(apiKey, model);
        return (response.text || '').trim();
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status || err?.code) || 500;
        markKeyFailure(apiKey, model, err);
        console.log(
          `[Longclaw] Transcribe (${model}) returned ${err?.status || err?.code || 'ERR'}, trying next fallback...`
        );
        if (hasNextModel && (status === 404 || status === 400 || status === 504)) {
          break;
        }
      }
    }
  }

  throw lastError || new Error('Ses yazıya çevrilemedi.');
}

app.post('/api/transcribe', transcribeRateLimit, async (req: Request, res: Response) => {
  const uiLang = resolveUiLang(req.body);
  try {
    const rawAudio = typeof req.body?.audioData === 'string' ? req.body.audioData.trim() : '';
    let mimeType = normalizeAudioMimeType(req.body?.mimeType);
    let base64Payload = rawAudio;

    // Allow optional data URL format while validating MIME strictly
    const dataUrlMatch = rawAudio.match(/^data:(audio\/[a-zA-Z0-9.+-]+)(?:;[^,]+)*;base64,(.+)$/s);
    if (dataUrlMatch) {
      const extractedMime = normalizeAudioMimeType(dataUrlMatch[1]);
      if (extractedMime) mimeType = extractedMime;
      base64Payload = dataUrlMatch[2];
    }

    base64Payload = base64Payload.replace(/\s+/g, '');

    if (!mimeType) {
      return res.status(400).json({
        error:
          uiLang === 'en'
            ? 'Unsupported audio format.'
            : 'Desteklenmeyen ses biçimi.',
      });
    }

    if (
      base64Payload.length < 100 ||
      base64Payload.length > 14_000_000 ||
      !/^[A-Za-z0-9+/=]+$/.test(base64Payload)
    ) {
      return res.status(400).json({
        error:
          uiLang === 'en'
            ? 'Invalid or empty audio recording.'
            : 'Geçersiz veya boş ses kaydı.',
      });
    }

    if (getConfiguredApiKeys().length === 0) {
      return res.status(503).json({
        error:
          uiLang === 'en'
            ? 'Voice transcription is currently unavailable.'
            : 'Ses yazıya çevirme servisi şu anda kullanılamıyor.',
      });
    }

    const rawTranscript = await transcribeAudioWithFailover(base64Payload, mimeType, uiLang);
    const cleaned = rawTranscript
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .replace(
        /^\s*(?:\[|\()?\d{1,2}:\d{2}(?::\d{2})?(?:\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?)?(?:\]|\))?\s*/gm,
        ''
      )
      .replace(/^\s*\[(silence|no speech|inaudible|music|blank_audio|sessizlik|konuşma yok)\]\s*$/i, '')
      .trim();

    return res.json({ text: cleaned });
  } catch (err: any) {
    console.error('Audio transcription error:', sanitizeForLog(err));
    const formatted = formatGeminiError(err, uiLang);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

const VOICE_EYE_SHAPES = new Set(['round', 'oval', 'square']);
const VOICE_MOODS = new Set([
  'calm',
  'happy',
  'coding',
  'curious',
  'sleepy',
  'surprised',
  'love',
  'serious',
  'playful',
]);
const ALLOWED_TTS_VOICES = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);

app.post('/api/voice-chat', voiceChatRateLimit, async (req: Request, res: Response) => {
  const uiLang = resolveUiLang(req.body);
  try {
    const rawTranscript =
      typeof req.body?.transcript === 'string' ? req.body.transcript.trim() : '';
    if (!rawTranscript || rawTranscript.length > 4000) {
      return res.status(400).json({
        error:
          uiLang === 'en'
            ? 'Please provide a valid voice message.'
            : 'Lütfen geçerli bir sesli mesaj gönder.',
      });
    }

    if (getConfiguredApiKeys().length === 0) {
      return res.status(503).json({
        error:
          uiLang === 'en'
            ? 'Voice chat is currently unavailable.'
            : 'Sesli sohbet şu anda kullanılamıyor.',
      });
    }

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const item of rawHistory) {
      if (!item || typeof item !== 'object') continue;
      const role: 'user' | 'model' =
        item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
      const content =
        typeof item.content === 'string' ? item.content.trim().slice(0, 2000) : '';
      if (!content) continue;
      if (contents.length === 0 && role === 'model') continue;
      const prev = contents[contents.length - 1];
      if (prev && prev.role === role) {
        prev.parts.push({ text: content });
      } else {
        contents.push({ role, parts: [{ text: content }] });
      }
    }
    const lastEntry = contents[contents.length - 1];
    if (lastEntry && lastEntry.role === 'user') {
      lastEntry.parts.push({ text: rawTranscript });
    } else {
      contents.push({ role: 'user', parts: [{ text: rawTranscript }] });
    }

    const voiceSystemInstruction = buildTrainedVoiceSystemPrompt(
      uiLang,
      req.body?.nowIso,
      req.body?.timeZone
    );

    const aiResponse = await generateContentWithFailover(
      {
        model: FALLBACK_UNPAID_MODEL,
        contents,
        config: {
          systemInstruction: voiceSystemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              eyeShape: { type: Type.STRING },
              mood: { type: Type.STRING },
            },
            required: ['reply', 'eyeShape', 'mood'],
          },
        },
      },
      14_000
    );

    const rawText = (aiResponse.text || '').trim();
    let parsed: { reply?: unknown; eyeShape?: unknown; mood?: unknown } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      try {
        const cleaned = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { reply: rawText };
      }
    }

    const reply =
      typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.replace(/[*_`#]/g, '').trim()
        : uiLang === 'en'
          ? 'I heard you clearly. What would you like to do next?'
          : 'Seni net duydum. Şimdi ne yapmamı istersin?';

    const eyeShape =
      typeof parsed.eyeShape === 'string' && VOICE_EYE_SHAPES.has(parsed.eyeShape.toLowerCase())
        ? parsed.eyeShape.toLowerCase()
        : 'round';

    const mood =
      typeof parsed.mood === 'string' && VOICE_MOODS.has(parsed.mood.toLowerCase())
        ? parsed.mood.toLowerCase()
        : 'calm';

    return res.json({ reply, eyeShape, mood });
  } catch (err: any) {
    console.error('Voice chat error:', sanitizeForLog(err));
    const formatted = formatGeminiError(err, uiLang);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

async function synthesizeSpeechWithFailover(
  text: string,
  voiceName: string,
  style: string
): Promise<{ audioBase64: string; mimeType: string }> {
  const configuredKeys = getConfiguredApiKeys();
  if (configuredKeys.length === 0) {
    throw new Error('Speech synthesis service is not configured.');
  }

  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
  let lastError: any = null;

  for (let mIdx = 0; mIdx < ttsModels.length; mIdx++) {
    const model = ttsModels[mIdx];
    const hasNextModel = mIdx < ttsModels.length - 1;
    const { healthy, all } = getOrderedApiKeys(model);
    if (hasNextModel && healthy.length === 0) continue;
    const passKeys = hasNextModel ? healthy : all;

    for (let i = 0; i < passKeys.length; i++) {
      const apiKey = passKeys[i];
      const client = getGeminiTtsClient(apiKey);
      try {
        const part: any = style
          ? { text, speechMetadata: { style } }
          : { text };
        const response = await withTimeout(
          client.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [part] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          }),
          hasNextModel ? 10_000 : 14_000,
          `TTS (${model})`
        );

        const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        const base64Audio = typeof inlineData?.data === 'string' ? inlineData.data : '';
        if (!base64Audio) {
          throw new Error('Empty audio payload from TTS model.');
        }

        // Ensure browser-playable RIFF/WAVE output: Gemini 3.8 unary returns complete WAV,
        // while raw PCM (audio/l16 or audio/pcm without RIFF header) is safely wrapped.
        const rawMime =
          typeof inlineData?.mimeType === 'string' && inlineData.mimeType
            ? inlineData.mimeType.toLowerCase()
            : 'audio/wav';
        let finalBase64 = base64Audio;
        let finalMime = rawMime;

        const decoded = Buffer.from(base64Audio, 'base64');
        const hasRiffHeader =
          decoded.length >= 12 &&
          decoded.toString('ascii', 0, 4) === 'RIFF' &&
          decoded.toString('ascii', 8, 12) === 'WAVE';

        if (!hasRiffHeader && (rawMime.includes('l16') || rawMime.includes('pcm'))) {
          const rateMatch = rawMime.match(/rate=(\d+)/);
          const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
          const numChannels = 1;
          const bitsPerSample = 16;
          const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
          const blockAlign = (numChannels * bitsPerSample) / 8;
          const wavHeader = Buffer.alloc(44);
          wavHeader.write('RIFF', 0);
          wavHeader.writeUInt32LE(36 + decoded.length, 4);
          wavHeader.write('WAVE', 8);
          wavHeader.write('fmt ', 12);
          wavHeader.writeUInt32LE(16, 16);
          wavHeader.writeUInt16LE(1, 20);
          wavHeader.writeUInt16LE(numChannels, 22);
          wavHeader.writeUInt32LE(sampleRate, 24);
          wavHeader.writeUInt32LE(byteRate, 28);
          wavHeader.writeUInt16LE(blockAlign, 32);
          wavHeader.writeUInt16LE(bitsPerSample, 34);
          wavHeader.write('data', 36);
          wavHeader.writeUInt32LE(decoded.length, 40);
          finalBase64 = Buffer.concat([wavHeader, decoded]).toString('base64');
          finalMime = 'audio/wav';
        } else if (hasRiffHeader) {
          finalMime = 'audio/wav';
        }

        markKeySuccess(apiKey, model);
        return {
          audioBase64: finalBase64,
          mimeType: finalMime,
        };
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status || err?.code) || 500;
        markKeyFailure(apiKey, model, err);
        if (hasNextModel && (status === 404 || status === 400 || status === 504)) {
          break;
        }
      }
    }
  }

  throw lastError || new Error('Ses oluşturulamadı.');
}

app.post('/api/tts', ttsRateLimit, async (req: Request, res: Response) => {
  const uiLang = resolveUiLang(req.body);
  try {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!rawText || rawText.length > 1200) {
      return res.status(400).json({
        error:
          uiLang === 'en'
            ? 'Invalid text for speech synthesis.'
            : 'Seslendirme için geçersiz metin.',
      });
    }

    const requestedVoice =
      typeof req.body?.voiceName === 'string' && ALLOWED_TTS_VOICES.has(req.body.voiceName)
        ? req.body.voiceName
        : 'Kore';

    const style =
      typeof req.body?.style === 'string'
        ? req.body.style.replace(/[\r\n]+/g, ' ').trim().slice(0, 120)
        : '';

    if (getConfiguredApiKeys().length === 0) {
      return res.status(503).json({
        error:
          uiLang === 'en'
            ? 'Speech synthesis is currently unavailable.'
            : 'Seslendirme servisi şu anda kullanılamıyor.',
      });
    }

    const result = await synthesizeSpeechWithFailover(rawText, requestedVoice, style);
    return res.json(result);
  } catch (err: any) {
    console.error('TTS synthesis error:', sanitizeForLog(err));
    const formatted = formatGeminiError(err, uiLang);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

// JSON 404 fallback for unknown API routes (never return index.html for /api/*)
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Clean JSON error handler for malformed request bodies & unexpected server errors (never leak stack traces)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }
  console.error('Unhandled server error:', sanitizeForLog(err));
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
  return res.status(500).send('Internal server error');
});

// Vercel Serverless Function configuration (allows up to 60s for AI streaming & image generation)
export const config = {
  maxDuration: 60,
};

export { app, sanitizeForLog };
export default app;
