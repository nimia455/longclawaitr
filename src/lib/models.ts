export type ChatModelId =
  | 'longclaw-clawing-1.2-ultra'
  | 'longclaw-clawing-1.2-pro'
  | 'longclaw-clawing-1.1-ultra'
  | 'longclaw-clawing-1.1-pro'
  | 'longclaw-clawing-1-pro'
  | 'longclaw-clawing-1.1-low'
  | 'longclaw-clawing-1.1';

export interface ChatModelOption {
  id: ChatModelId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  inFamily: boolean;
}

export const DEFAULT_CHAT_MODEL: ChatModelId = 'longclaw-clawing-1.2-pro';

export const CHAT_MODELS: ChatModelOption[] = [
  {
    id: 'longclaw-clawing-1.2-ultra',
    name: 'Longclaw Clawing 1.2 Ultra',
    shortName: 'Clawing 1.2 Ultra',
    tagline: 'En kapsamlı',
    description: 'Uzun metinler, teknik incelemeler ve çok adımlı kararlar için en derin model.',
    inFamily: true,
  },
  {
    id: 'longclaw-clawing-1.2-pro',
    name: 'Longclaw Clawing 1.2 Pro',
    shortName: 'Clawing 1.2 Pro',
    tagline: 'Günlük denge',
    description: 'Kod, yazı ve günlük işlerde hız ile doğruluğu dengede tutan ana çalışma modeli.',
    inFamily: true,
  },
  {
    id: 'longclaw-clawing-1.1-ultra',
    name: 'Longclaw Clawing 1.1 Ultra',
    shortName: 'Clawing 1.1 Ultra',
    tagline: 'Derin analiz',
    description: 'Mimari tasarım, uzun araştırma notları ve aşamalı akıl yürütme için sakin ve titiz model.',
    inFamily: true,
  },
  {
    id: 'longclaw-clawing-1.1-pro',
    name: 'Longclaw Clawing 1.1 Pro',
    shortName: 'Clawing 1.1 Pro',
    tagline: 'Önceki Pro',
    description: 'Clawing 1.1 tabanlı Pro sürümü; düzenli kod çıktısı ve uzun konuşmalarda tutarlı takip.',
    inFamily: false,
  },
  {
    id: 'longclaw-clawing-1-pro',
    name: 'Longclaw Clawing 1 Pro',
    shortName: 'Clawing 1 Pro',
    tagline: 'Klasik Pro',
    description: 'İlk nesil Pro sürümü; alıştığı tonda devam etmek isteyenler için.',
    inFamily: false,
  },
  {
    id: 'longclaw-clawing-1.1-low',
    name: 'Longclaw Clawing 1.1 Low',
    shortName: 'Clawing 1.1 Low',
    tagline: 'Hızlı yanıt',
    description: 'Kısa sorular, hızlı çeviriler ve taslak düzeltmeleri için bekletmeden yanıt verir.',
    inFamily: true,
  },
  {
    id: 'longclaw-clawing-1.1',
    name: 'Longclaw Clawing 1.1',
    shortName: 'Clawing 1.1',
    tagline: 'Standart',
    description: 'Doğal Türkçe, sade anlatım ve rahat günlük sohbetler için standart sürüm.',
    inFamily: false,
  },
];

export const FAMILY_MODELS: ChatModelOption[] = CHAT_MODELS.filter((m) => m.inFamily);
export const OTHER_MODELS: ChatModelOption[] = CHAT_MODELS.filter((m) => !m.inFamily);

export function isValidChatModel(value: unknown): value is ChatModelId {
  return typeof value === 'string' && CHAT_MODELS.some((m) => m.id === value);
}

export function getChatModelOption(id: ChatModelId): ChatModelOption {
  return CHAT_MODELS.find((m) => m.id === id) || CHAT_MODELS[1];
}
