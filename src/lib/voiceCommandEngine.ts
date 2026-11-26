import { Language } from './i18n';

export type EyeShape = 'round' | 'oval' | 'square';
export type EyeShapePreference = 'auto' | EyeShape;

export type VoiceMood =
  | 'calm'
  | 'happy'
  | 'coding'
  | 'curious'
  | 'sleepy'
  | 'surprised'
  | 'love'
  | 'serious'
  | 'playful';

export type VoicePhase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

export type VoicePersonaName = 'Kore' | 'Zephyr' | 'Puck' | 'Fenrir' | 'Charon';

export const VOICE_PERSONAS: Array<{ id: VoicePersonaName; label: string }> = [
  { id: 'Kore', label: 'Kore' },
  { id: 'Zephyr', label: 'Zephyr' },
  { id: 'Puck', label: 'Puck' },
  { id: 'Fenrir', label: 'Fenrir' },
  { id: 'Charon', label: 'Charon' },
];

export interface CommandVisualCue {
  eyeShape?: EyeShape;
  mood?: VoiceMood;
  explicitShape?: boolean;
}

/**
 * Instant bilingual (EN & TR) command parser so the eyes begin morphing
 * immediately when the user issues a voice command—even before the AI reply completes.
 */
export function detectCommandVisualCue(rawTranscript: string): CommandVisualCue {
  const text = rawTranscript.toLowerCase().trim();
  if (!text) return {};

  const cue: CommandVisualCue = {};

  // Explicit eye shape voice commands
  if (/\b(square|boxy|blocky|robot|pixel|kare|dörtgen|kutu)\b/i.test(text)) {
    cue.eyeShape = 'square';
    cue.explicitShape = true;
  } else if (/\b(oval|tall|egg|pill|elips|uzun\s+göz|oval\s+göz)\b/i.test(text)) {
    cue.eyeShape = 'oval';
    cue.explicitShape = true;
  } else if (/\b(round|circle|circular|big\s+eyes|yuvarlak|daire|kocaman\s+göz)\b/i.test(text)) {
    cue.eyeShape = 'round';
    cue.explicitShape = true;
  }

  // Command-driven emotional & functional animation modes
  if (
    /\b(code|coding|python|javascript|typescript|react|html|css|sql|debug|bug|algorithm|math|calculate|solve|function|api|script|kod|yazılım|algoritma|hesapla|hata\s*ayıkla|matematik|planla|takvim|görev)\b/i.test(
      text
    )
  ) {
    cue.mood = 'coding';
    if (!cue.eyeShape) cue.eyeShape = 'square';
  } else if (
    /\b(dance|sing|music|party|play|groove|rhythm|beat|dans|şarkı|müzik|eğlen|oyna|parti)\b/i.test(
      text
    )
  ) {
    cue.mood = 'playful';
    if (!cue.eyeShape) cue.eyeShape = 'round';
  } else if (
    /\b(sleep|sleepy|tired|good\s*night|relax|breathe|meditate|calm|lullaby|uyku|uykulu|yorgun|iyi\s*geceler|rahatla|sakinleş|nefes)\b/i.test(
      text
    )
  ) {
    cue.mood = 'sleepy';
    if (!cue.eyeShape) cue.eyeShape = 'oval';
  } else if (
    /\b(angry|mad|serious|strict|intense|furious|stern|grumpy|sinirli|kızgın|ciddi|sert|öfkeli)\b/i.test(
      text
    )
  ) {
    cue.mood = 'serious';
    if (!cue.eyeShape) cue.eyeShape = 'square';
  } else if (
    /\b(wow|whoa|surprise|surprised|shocked|amazing|incredible|unbelievable|mind\s*blown|şaşır|şaşırt|sürpriz|inanılmaz|vay|harika\s*haber)\b/i.test(
      text
    )
  ) {
    cue.mood = 'surprised';
    if (!cue.eyeShape) cue.eyeShape = 'round';
  } else if (
    /\b(love|thank|thanks|grateful|sweet|cute|heart|awesome|best|teşekkür|seviyorum|tatlı|canım|harikasın|sağ\s*ol)\b/i.test(
      text
    )
  ) {
    cue.mood = 'love';
    if (!cue.eyeShape) cue.eyeShape = 'oval';
  } else if (
    /\b(joke|funny|laugh|haha|smile|happy|hi|hello|hey|good\s*morning|cheer|şaka|fıkra|komik|gül|mutlu|merhaba|selam|günaydın)\b/i.test(
      text
    )
  ) {
    cue.mood = 'happy';
    if (!cue.eyeShape) cue.eyeShape = 'oval';
  } else if (
    /\?|^(why|how|what|who|where|when|explain|tell\s+me\s+about|neden|nasıl|nedir|kim|nerede|ne\s+zaman|açıkla|anlat)\b/i.test(
      text
    )
  ) {
    cue.mood = 'curious';
    if (!cue.eyeShape) cue.eyeShape = 'round';
  }

  return cue;
}

export function getVoiceTtsStyle(mood: VoiceMood, lang: Language): string {
  const isTr = lang === 'tr';
  switch (mood) {
    case 'happy':
      return isTr ? 'Sıcak, neşeli ve doğal konuşma tonu' : 'Warm, bright, and cheerful conversational tone';
    case 'coding':
      return isTr ? 'Net, sakin ve odaklı teknik asistan tonu' : 'Clear, crisp, and focused helpful tone';
    case 'sleepy':
      return isTr ? 'Yumuşak, yavaş ve huzurlu fısıltıya yakın ton' : 'Soft, gentle, calm and soothing tone';
    case 'surprised':
      return isTr ? 'Enerjik, şaşkın ve heyecanlı ton' : 'Lively, amazed, and enthusiastic tone';
    case 'love':
      return isTr ? 'İçten, samimi ve nazik ton' : 'Warm, kind, and affectionate tone';
    case 'serious':
      return isTr ? 'Ciddi, kararlı ve tok ses tonu' : 'Composed, serious, and firm tone';
    case 'playful':
      return isTr ? 'Eğlenceli, ritmik ve enerjik ton' : 'Playful, upbeat, and expressive tone';
    case 'curious':
      return isTr ? 'Meraklı, ilgili ve canlı ton' : 'Curious, engaged, and thoughtful tone';
    default:
      return isTr ? 'Doğal, akıcı ve sakin sesli asistan tonu' : 'Natural, warm, and clear conversational voice';
  }
}

export function getMoodDisplayLabel(mood: VoiceMood, lang: Language): string {
  const isTr = lang === 'tr';
  switch (mood) {
    case 'happy':
      return isTr ? 'Neşeli' : 'Happy';
    case 'coding':
      return isTr ? 'Kod & Odak' : 'Code & Focus';
    case 'curious':
      return isTr ? 'Meraklı' : 'Curious';
    case 'sleepy':
      return isTr ? 'Sakin & Uyku' : 'Calm & Sleepy';
    case 'surprised':
      return isTr ? 'Şaşkın' : 'Surprised';
    case 'love':
      return isTr ? 'Sıcak' : 'Warm';
    case 'serious':
      return isTr ? 'Ciddi' : 'Serious';
    case 'playful':
      return isTr ? 'Eğlenceli' : 'Playful';
    default:
      return isTr ? 'Hazır' : 'Calm';
  }
}
