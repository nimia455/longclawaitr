import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
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

// Safe CORS for GitHub Pages (*.github.io) and explicitly allowed origins calling /api/*
const configuredAllowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

function isAllowedCorsOrigin(origin: string): boolean {
  const normalized = origin.trim().replace(/\/+$/, '');
  if (!normalized) return false;
  if (configuredAllowedOrigins.has(normalized)) return true;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.github.io')) {
      return true;
    }
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
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
  const isQuotaOrAuth =
    status === 429 ||
    status === 401 ||
    status === 403 ||
    rawMsg.includes('RESOURCE_EXHAUSTED') ||
    rawMsg.includes('QUOTA') ||
    rawMsg.includes('API_KEY_INVALID');
  const cooldownMs = isQuotaOrAuth ? 300_000 : status === 503 || status === 504 ? 60_000 : 15_000;
  keyModelCooldownUntil.set(cooldownKey(apiKey, model), Date.now() + cooldownMs);
}

// Supported Longclaw model aliases -> underlying Gemini models
const DEFAULT_PUBLIC_MODEL = 'longclaw-clawing-1.2-pro';
const DEFAULT_BACKEND_MODEL = 'gemini-4-hydrogen';

const PUBLIC_TO_BACKEND_MODEL: Record<string, string> = {
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
];

const CODING_EFFORT_PATTERN =
  /\b(typescript|javascript|python|rust|golang|java|c\+\+|react|nextjs|vue|svelte|html|css|svg|api|json|yaml|bash|shell|function|component|class|hook|script|kod|code|app|uygulama|website|web\s*sitesi|game|oyun|timer|kronometre|calculator|hesap\s*makinesi|shader|canvas|mermaid)\b/i;

const BUILD_ACTION_PATTERN =
  /\b(write|build|create|design|implement|fix|generate|make|yaz|oluştur|tasarla|yap|düzelt|geliştir)\b/i;

const MEDIUM_EFFORT_PATTERN =
  /\b(explain|açıkla|anlat|why|neden|niçin|how|nasıl|summarize|özetle|translate|çevir|email|e-posta|mail|draft|taslak|rewrite|yeniden\s+yaz|improve|plan|strateji|strategy|essay|makale|article|report|rapor|ideas|fikir|brainstorm|difference|fark|calculate|hesapla|solve|çöz)\b/i;

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

  // Trivial greetings / acknowledgments / identity checks always switch silently to the fastest model
  if (!hasAttachedImages && !hasWorkspaceContext && (!text || TRIVIAL_CHAT_PATTERN.test(text))) {
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
  if (CODING_EFFORT_PATTERN.test(text)) {
    score += BUILD_ACTION_PATTERN.test(text) ? 3 : 2;
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
  if (messages.length > 2) {
    const recentPrior = messages.slice(-6, -1);
    const priorHasCode = recentPrior.some((m) => String(m?.content || '').includes('```'));
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

  if (publicModel.includes('ultra')) {
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

  // Safety floors: multimodal, workspace synthesis, or genuinely complex prompts never downgrade below balanced
  if ((hasAttachedImages || hasWorkspaceContext || intrinsicScore >= 7) && (tier === 'instant' || tier === 'light')) {
    tier = 'balanced';
  }

  return buildSilentRoutePlan(tier, depth);
}

function buildSilentRoutePlan(tier: EffortTier, depth: string): SilentRoutePlan {
  switch (tier) {
    case 'instant':
      return {
        tier,
        primaryModel: 'gemini-3.5-flash-lite',
        fallbackModels: ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-4-hydrogen'],
        includeThoughts: false,
      };
    case 'light':
      return {
        tier,
        primaryModel: 'gemini-3.5-flash-lite',
        fallbackModels: ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-4-hydrogen'],
        includeThoughts: false,
      };
    case 'balanced':
      return {
        tier,
        primaryModel: 'gemini-4-hydrogen',
        fallbackModels: [
          'gemini-3.5-flash-lite',
          'gemini-3.6-flash',
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite',
        ],
        includeThoughts: depth !== 'fast',
      };
    case 'deep':
      return {
        tier,
        primaryModel: 'gemini-4-hydrogen',
        fallbackModels: [
          'gemini-3.8-flash',
          'gemini-3.5-flash-lite',
          'gemini-3.6-flash',
          'gemini-3.1-flash-lite',
        ],
        includeThoughts: true,
      };
  }
}

function resolveThinkingForModel(
  backendModel: string,
  tier: EffortTier,
  includeThoughts: boolean
): { level: ThinkingLevel; includeThoughts: boolean } {
  const isLiteModel = backendModel.includes('flash-lite');

  if (tier === 'instant') {
    return {
      level: isLiteModel ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
      includeThoughts: false,
    };
  }

  if (tier === 'light') {
    return {
      level: ThinkingLevel.LOW,
      includeThoughts: false,
    };
  }

  if (tier === 'balanced') {
    return {
      level: ThinkingLevel.LOW,
      includeThoughts,
    };
  }

  // Deep tier: maximize reasoning effort supported cleanly by each model
  return {
    level: backendModel === 'gemini-4-hydrogen' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM,
    includeThoughts,
  };
}

const PUBLIC_MODEL_DISPLAY_NAMES: Record<string, string> = {
  'longclaw-clawing-1.2-ultra': 'Longclaw Clawing 1.2 Ultra',
  'longclaw-clawing-1.2-pro': 'Longclaw Clawing 1.2 Pro',
  'longclaw-clawing-1.1-ultra': 'Longclaw Clawing 1.1 Ultra',
  'longclaw-clawing-1.1-pro': 'Longclaw Clawing 1.1 Pro',
  'longclaw-clawing-1-pro': 'Longclaw Clawing 1 Pro',
  'longclaw-clawing-1.1-low': 'Longclaw Clawing 1.1 Low',
  'longclaw-clawing-1.1': 'Longclaw Clawing 1.1',
};

function resolveUiLang(body: any): 'en' | 'tr' {
  const raw = body?.lang ?? body?.language ?? body?.uiLang;
  return raw === 'en' ? 'en' : 'tr';
}

function buildSystemIdentity(publicModel: string, lang: 'en' | 'tr'): string {
  const modelDisplayName =
    PUBLIC_MODEL_DISPLAY_NAMES[publicModel] || 'Longclaw Clawing 1.2 Pro';
  if (lang === 'en') {
    return `You are Longclaw, a crisp, warm, concise, and genuinely helpful AI assistant. Never volunteer your name or model unprompted — go straight to helping with the user's request. Only if the user explicitly asks who you are or which model you are (e.g., "who are you?", "what model are you?"), identify yourself as ${modelDisplayName} (part of the Longclaw Clawing family) without mentioning underlying APIs or infrastructure providers. CRITICAL LANGUAGE RULE: Always write your reply in the exact same language as the user's latest message, with natural human warmth, clarity, and zero filler.`;
  }
  return `Sen Longclaw adlı net, sıcak, öz ve gerçekten yardımsever bir yapay zekâ asistanısın. Normal yanıtlarda adını veya hangi model olduğunu durduk yere söyleme — kullanıcı sormadıkça kendini tanıtma ve doğrudan yardımcı olmaya odaklan. Yalnızca kullanıcı açıkça kim olduğunu veya hangi model olduğunu sorarsa ("hangi modelsin?", "sen kimsin?" gibi), o zaman ${modelDisplayName} (Longclaw Clawing ailesi) olduğunu belirt; dahili API veya altyapı sağlayıcı ayrıntılarını paylaşma. KRİTİK DİL KURALI: Sistem yönergelerinin dilinden bağımsız olarak, yanıtını HER ZAMAN kullanıcının son mesajını yazdığı dille aynı dilde (örneğin İngilizce yazdıysa İngilizce, Türkçe yazdıysa Türkçe), doğal, sıcak ve gereksiz dolgu olmadan yaz.`;
}

const DEPTH_INSTRUCTIONS: Record<'en' | 'tr', Record<string, string>> = {
  en: {
    fast: 'Fast mode: Keep the answer brief, crisp, and direct with no preamble.',
    mid: 'Balanced mode: Give a clear, warm, well-structured answer without unnecessary padding.',
    deep: 'Deep mode: Think carefully and walk through the topic thoroughly with concrete structure and practical examples.',
  },
  tr: {
    fast: 'Hızlı mod: Yanıtı kısa, net ve doğrudan tut; gereksiz giriş yapma.',
    mid: 'Orta mod: Net, sıcak, akıcı ve düzenli yanıt ver; gereksiz uzatmalardan kaçın.',
    deep: 'Derin mod: Konuyu adım adım, düzenli ve somut örneklerle kapsamlı biçimde işle.',
  },
};

const MODE_INSTRUCTIONS: Record<'en' | 'tr', Record<string, string>> = {
  en: {
    chat: 'Be a crisp, warm, concise, and helpful collaborator.',
    sum: 'When given text, summarize cleanly with clear key takeaways; when asked to translate, keep it natural and faithful.',
    write: 'Draft clear, human-sounding emails, messages, and copy tailored to the requested tone.',
  },
  tr: {
    chat: 'Sıcak, net, öz ve gerçekten yardımsever bir yol arkadaşı gibi yanıt ver.',
    sum: 'Kullanıcı bir metin yapıştırırsa kısa ve düzenli özetle; çeviri istenirse istenen dile doğal biçimde çevir.',
    write: 'E-posta, mesaj ve metin taslaklarını istenen tona (resmi, samimi, kısa) uygun, doğal bir dille yaz.',
  },
};


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

const FALLBACK_UNPAID_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];

function buildModelAttemptParams(
  params: any,
  targetModel: string,
  tier: EffortTier,
  includeThoughts: boolean
) {
  const thinking = resolveThinkingForModel(targetModel, tier, includeThoughts);
  return {
    ...params,
    model: targetModel,
    config: {
      ...(params?.config || {}),
      ...(params?.config?.thinkingConfig
        ? {
            thinkingConfig: {
              thinkingLevel: thinking.level,
              includeThoughts: thinking.includeThoughts,
            },
          }
        : {}),
    },
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
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
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
        ? 6_500
        : hasFallbackRemaining
          ? 9_000
          : 25_000;

      try {
        const startAndFirstChunk = (async () => {
          const stream = await client.models.generateContentStream(attemptParams);
          const iterator = stream[Symbol.asyncIterator]();
          const firstResult = await iterator.next();
          return { iterator, firstResult };
        })();

        const result = await withTimeout(
          startAndFirstChunk,
          firstChunkTimeoutMs,
          `Stream (${attemptParams.model})`
        );
        markKeySuccess(apiKey, attemptParams.model);
        return result;
      } catch (err: any) {
        lastError = err;
        markKeyFailure(apiKey, attemptParams.model, err);
        console.log(
          `[Longclaw] Key slot #${i + 1} (${attemptParams.model}) returned ${err?.status || err?.code || 'ERR'}, trying next fallback...`
        );
        // If the primary model timed out (504), switch immediately to the fallback model instead of stalling on every key
        if (hasNextModelPass && Number(err?.status) === 504) {
          break;
        }
      }
    }

    if (lastError && !isRetryableUpstreamError(lastError)) {
      break;
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
    const effectiveTimeoutMs = hasNextModelPass ? Math.min(timeoutMs, 7_000) : timeoutMs;

    for (let i = 0; i < passKeys.length; i++) {
      const apiKey = passKeys[i];
      const client = getGeminiClient(apiKey);

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
        markKeyFailure(apiKey, attemptParams.model, err);
        if (hasNextModelPass && status === 504) {
          break;
        }
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
    const isLightRoute = routePlan.tier === 'instant' || routePlan.tier === 'light';

    if (getConfiguredApiKeys().length === 0) {
      return res.status(503).json({
        error:
          uiLang === 'en'
            ? 'The AI service is not configured right now. Please try again later.'
            : 'Yapay zekâ servisi şu anda yapılandırılmamış. Lütfen daha sonra tekrar dene.',
      });
    }

    const depthMap = DEPTH_INSTRUCTIONS[uiLang];
    const modeMap = MODE_INSTRUCTIONS[uiLang];
    const depthInstruction =
      routePlan.tier === 'instant'
        ? uiLang === 'en'
          ? 'Quick reply: This is a straightforward prompt — answer directly, warmly, and concisely.'
          : 'Hızlı yanıt: Soru doğrudan olduğu için uzatmadan, sıcak ve net cevap ver.'
        : routePlan.tier === 'deep'
          ? depthMap.deep
          : depthMap[depth] || depthMap.mid;
    const ultraSpecialty =
      !isLightRoute && (routePlan.tier === 'deep' || publicModel === 'longclaw-clawing-1.2-ultra')
        ? uiLang === 'en'
          ? '\nStrength: For complex academic, scientific, legal, technical, or multi-step reasoning prompts, compare trade-offs rigorously before arriving at the cleanest conclusion.'
          : '\nUzmanlık: Karmaşık akademik, bilimsel, hukuki, teknik ve çok adımlı sorularda seçenekleri titizlikle karşılaştırıp en doğru sonuca ulaş.'
        : !isLightRoute && publicModel === 'longclaw-clawing-1.2-pro'
          ? uiLang === 'en'
            ? '\nStrength: For coding, writing, and technical workflows, produce clean, directly usable results without filler.'
            : '\nUzmanlık: Kodlama, yazı ve günlük üretkenlik işlerinde gereksiz uzatma olmadan yüksek kaliteli, temiz ve doğrudan uygulanabilir çözümler üret.'
          : '';

    let gmailInstruction = '';
    if (gmailConnected) {
      gmailInstruction +=
        uiLang === 'en'
          ? '\n\nGmail Connector: The user has connected Gmail. If they ask you to draft or send an email, append a single code block at the end of your reply in this exact JSON format (never claim the email was already sent; it is sent only when the user clicks confirm):\n```gmail-draft\n{"to":"recipient@example.com","subject":"Subject","body":"Email body"}\n```'
          : '\n\nGmail Bağlayıcısı: Kullanıcının Gmail hesabı bağlıdır. Kullanıcı bir e-posta yazmanı, yanıt taslağı hazırlamanı veya e-posta göndermeni isterse, cevabının sonunda aşağıdaki tam JSON formatında tek bir kod bloğu ekle (asla e-postayı otomatik gönderdiğini iddia etme; kullanıcı onay butonuna tıklayınca gönderilecek):\n```gmail-draft\n{"to":"alici@ornek.com","subject":"Konu","body":"E-posta metni"}\n```';
    }
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
      gmailInstruction += `\n\nRecent emails fetched with user permission from Gmail:\n${formattedEmails}\n\nBase your answer strictly on this real email data; never invent email details.`;
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
      gmailInstruction += `\n\nUpcoming Google Calendar events fetched with user permission:\n${formattedEvents}`;
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
      gmailInstruction += `\n\nRecent Google Drive files fetched with user permission:\n${formattedDrive}`;
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
      gmailInstruction += `\n\nGoogle Docs fetched with user permission:\n${formattedDocs}`;
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
      gmailInstruction += `\n\nGoogle Tasks fetched with user permission:\n${formattedTasks}`;
    }

    const systemIdentity = buildSystemIdentity(publicModel, uiLang);
    const systemPrompt = `${systemIdentity}${ultraSpecialty}${gmailInstruction}\n\n${uiLang === 'en' ? 'Mode' : 'Mod'}: ${modeMap[mode] || modeMap.chat}\n${uiLang === 'en' ? 'Depth' : 'Derinlik'}: ${depthInstruction}`;

    // Format multimodal contents (text + inline image data) for @google/genai
    const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const contents = trimmedMessages.map(
      (m: { role: string; content: string; images?: Array<{ mimeType?: string; dataUrl?: string }> }) => {
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> =
          [];

        if (Array.isArray(m.images) && m.images.length > 0) {
          for (const img of m.images.slice(0, 4)) {
            const raw = String(img?.dataUrl || '');
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
          parts.push({ text: '' });
        }

        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      }
    );

    // Silently apply model-appropriate thinking effort for the routed tier
    const effort = resolveThinkingForModel(
      selectedModel,
      routePlan.tier,
      routePlan.includeThoughts
    );

    const config: any = {
      systemInstruction: systemPrompt,
      thinkingConfig: {
        thinkingLevel: effort.level,
        includeThoughts: effort.includeThoughts,
      },
    };

    const { iterator, firstResult } = await generateStreamWithFailover(
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
    res.setHeader('Connection', 'keep-alive');

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
          res.write(JSON.stringify({ t: 'tx', x: part.text }) + '\n');
        }
      }

      // Fallback if chunk.text is populated outside parts
      if (!emittedFromParts && chunk?.text) {
        res.write(JSON.stringify({ t: 'tx', x: chunk.text }) + '\n');
      }
    };

    if (!clientClosed && !firstResult.done && firstResult.value) {
      writeChunk(firstResult.value);
    }

    while (!clientClosed && !res.writableEnded) {
      const next = await iterator.next();
      if (next.done || clientClosed || res.writableEnded) {
        break;
      }
      if (next.value) writeChunk(next.value);
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
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
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
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL,
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
    const seed = Math.floor(Math.random() * 900_000_000) + 100_000;
    const finalUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${dims.w}&height=${dims.h}&nologo=true&seed=${seed}`;

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
        throw firstErr;
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
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
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
      const role = item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
      const content =
        typeof item.content === 'string' ? item.content.trim().slice(0, 2000) : '';
      if (content) {
        contents.push({ role, parts: [{ text: content }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: rawTranscript }] });

    const voiceSystemInstruction =
      uiLang === 'en'
        ? `You are Longclaw in Live Voice Chat mode — a warm, witty, ultra-expressive voice companion with big animated eyes that morph between "round", "oval", and "square" shapes.
Respond concisely in natural spoken English (1 to 3 short sentences, plain conversational text with NO markdown, NO bullet lists, NO asterisks, and NO emojis) so it sounds great spoken aloud.
Always choose the best "eyeShape" ("round", "oval", or "square") and "mood" ("calm", "happy", "coding", "curious", "sleepy", "surprised", "love", "serious", or "playful") matching the user's command or tone:
- If the user explicitly asks for round, oval, or square eyes, always select that exact eyeShape and acknowledge it naturally.
- Coding, math, logic, planning, schedules, debugging, or technical commands -> eyeShape: "square", mood: "coding".
- Jokes, greetings, praise, celebration, fun chat -> eyeShape: "round" or "oval", mood: "happy".
- Dancing, singing, games, playful commands -> eyeShape: "round", mood: "playful".
- Questions, curiosity, explanations, "why/how" -> eyeShape: "round", mood: "curious".
- Sleep, goodnight, relax, breathe, calm down -> eyeShape: "oval", mood: "sleepy".
- Amazement, surprises, "wow", exciting news -> eyeShape: "round", mood: "surprised".
- Gratitude, affection, warmth -> eyeShape: "oval", mood: "love".
- Serious, focused, strict, dramatic, angry commands -> eyeShape: "square", mood: "serious".`
        : `Sen Canlı Sesli Sohbet modundaki Longclaw’sun — kullanıcının komutuna göre "round" (yuvarlak), "oval" ve "square" (kare) şekillerine dönüşen kocaman animasyonlu gözlere sahip sıcak, zeki ve ifadeli bir sesli asistansın.
Doğal, akıcı konuşma Türkçesiyle 1 ila 3 kısa cümlelik net bir yanıt ver (markdown, yıldız işareti, madde listesi veya emoji KULLANMA) ki sesli okunduğunda kulağa harika gelsin.
Her zaman kullanıcının komutuna ve tonuna en uygun "eyeShape" ("round", "oval", "square") ve "mood" ("calm", "happy", "coding", "curious", "sleepy", "surprised", "love", "serious", "playful") seçimini yap:
- Kullanıcı açıkça yuvarlak, oval veya kare göz isterse tam olarak o eyeShape değerini seç ve doğal şekilde karşılık ver.
- Kodlama, matematik, analiz, planlama, hata ayıklama, teknik komutlar -> eyeShape: "square", mood: "coding".
- Şaka, selamlaşma, tebrik, keyifli sohbet -> eyeShape: "round" veya "oval", mood: "happy".
- Dans, şarkı, oyun, eğlenceli komutlar -> eyeShape: "round", mood: "playful".
- Sorular, merak, "neden/nasıl" açıklamaları -> eyeShape: "round", mood: "curious".
- Uyku, iyi geceler, rahatlama, nefes -> eyeShape: "oval", mood: "sleepy".
- Şaşkınlık, heyecan, sürpriz -> eyeShape: "round", mood: "surprised".
- Teşekkür, sevgi, sıcak sözler -> eyeShape: "oval", mood: "love".
- Ciddi, kararlı, sert veya sinirli rol komutları -> eyeShape: "square", mood: "serious".`;

    const aiResponse = await generateContentWithFailover(
      {
        model: 'gemini-3.5-flash-lite',
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
      parsed = { reply: rawText };
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

        markKeySuccess(apiKey, model);
        return {
          audioBase64: base64Audio,
          mimeType:
            typeof inlineData?.mimeType === 'string' && inlineData.mimeType
              ? inlineData.mimeType
              : 'audio/wav',
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

// Start server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist'), { dotfiles: 'deny' }));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[Longclaw] Server listening on http://0.0.0.0:${port}`);
  });

  const gracefulShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5_000).unref();
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', sanitizeForLog(err));
});
