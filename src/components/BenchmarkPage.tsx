import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpDown, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LIQUID_BAR, LIQUID_MORPH, LIQUID_SPRING } from '../lib/motion';
import { ModelLogo, BenchmarkModelLogo } from './Icons';
import { ChatModelId } from '../lib/models';
import { Language, TRANSLATIONS } from '../lib/i18n';

interface BenchmarkPageProps {
  lang: Language;
  onBack: () => void;
  onOpenAuth: (tab: 'in' | 'up') => void;
}

type CategoryId = 'all' | 'general' | 'coding' | 'math' | 'speed';

interface BenchmarkEntry {
  model: string;
  shortName: string;
  provider: string;
  value: number;
  isLongclaw?: boolean;
  isCore?: boolean;
  modelId?: ChatModelId;
}

interface BenchmarkSpec {
  id: string;
  category: Exclude<CategoryId, 'all'>;
  title: string;
  shortTitle: string;
  subtitle: string;
  unit: string;
  maxScale: number;
  note: string;
  entries: BenchmarkEntry[];
}

const EASE_EDITORIAL = [0.16, 1, 0.3, 1] as const;

const CATEGORY_TAB_IDS: CategoryId[] = ['all', 'general', 'coding', 'math', 'speed'];

const BENCHMARKS: BenchmarkSpec[] = [
  {
    id: 'tr-bench',
    category: 'general',
    title: 'TR-Bench (Türkçe Anlama & Nüans)',
    shortTitle: 'TR-Bench',
    subtitle: 'Deyim, resmi dil, özetleme ve bağlam tutarlılığı değerlendirmesi',
    unit: '%',
    maxScale: 100,
    note: '5-shot · İnsan değerlendirmesi + otomatik doğrulama',
    entries: [
      { model: 'Longclaw Clawing 1.2 Ultra', shortName: 'Clawing 1.2 Ultra', provider: 'Longclaw', value: 88.4, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-ultra' },
      { model: 'Longclaw Clawing 1.2 Pro', shortName: 'Clawing 1.2 Pro', provider: 'Longclaw', value: 87.2, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-pro' },
      { model: 'Longclaw Clawing 1.1 Ultra', shortName: 'Clawing 1.1 Ultra', provider: 'Longclaw', value: 86.8, isLongclaw: true, modelId: 'longclaw-clawing-1.1-ultra' },
      { model: 'Gemini 3', shortName: 'Gemini 3', provider: 'Google', value: 86.4, isCore: true },
      { model: 'Longclaw Clawing 1.1 Pro', shortName: 'Clawing 1.1 Pro', provider: 'Longclaw', value: 85.9, isLongclaw: true, modelId: 'longclaw-clawing-1.1-pro' },
      { model: 'Claude Sonnet 4', shortName: 'Claude Sonnet 4', provider: 'Anthropic', value: 85.3, isCore: true },
      { model: 'Longclaw Clawing 1 Pro', shortName: 'Clawing 1 Pro', provider: 'Longclaw', value: 84.2, isLongclaw: true, modelId: 'longclaw-clawing-1-pro' },
      { model: 'Longclaw Clawing 1.1', shortName: 'Clawing 1.1', provider: 'Longclaw', value: 83.1, isLongclaw: true, modelId: 'longclaw-clawing-1.1' },
      { model: 'DeepSeek V4', shortName: 'DeepSeek V4', provider: 'DeepSeek', value: 82.7, isCore: true },
      { model: 'Longclaw Clawing 1.1 Low', shortName: 'Clawing 1.1 Low', provider: 'Longclaw', value: 79.8, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.1-low' },
      { model: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', value: 79.4, isCore: true },
    ],
  },
  {
    id: 'mmlu-pro',
    category: 'general',
    title: 'MMLU-Pro',
    shortTitle: 'MMLU-Pro',
    subtitle: '14 farklı akademik ve mesleki alanda çoktan seçmeli genel bilgi',
    unit: '%',
    maxScale: 100,
    note: 'Zero-shot CoT · 10 seçenekli zorlu set',
    entries: [
      { model: 'Longclaw Clawing 1.2 Ultra', shortName: 'Clawing 1.2 Ultra', provider: 'Longclaw', value: 84.6, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-ultra' },
      { model: 'Longclaw Clawing 1.2 Pro', shortName: 'Clawing 1.2 Pro', provider: 'Longclaw', value: 82.1, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-pro' },
      { model: 'Gemini 3', shortName: 'Gemini 3', provider: 'Google', value: 81.2, isCore: true },
      { model: 'Claude Sonnet 4', shortName: 'Claude Sonnet 4', provider: 'Anthropic', value: 79.9, isCore: true },
      { model: 'DeepSeek V4', shortName: 'DeepSeek V4', provider: 'DeepSeek', value: 78.4, isCore: true },
      { model: 'Longclaw Clawing 1.1 Ultra', shortName: 'Clawing 1.1 Ultra', provider: 'Longclaw', value: 77.6, isLongclaw: true, modelId: 'longclaw-clawing-1.1-ultra' },
      { model: 'Longclaw Clawing 1.1 Pro', shortName: 'Clawing 1.1 Pro', provider: 'Longclaw', value: 75.8, isLongclaw: true, modelId: 'longclaw-clawing-1.1-pro' },
      { model: 'Longclaw Clawing 1 Pro', shortName: 'Clawing 1 Pro', provider: 'Longclaw', value: 74.1, isLongclaw: true, modelId: 'longclaw-clawing-1-pro' },
      { model: 'Longclaw Clawing 1.1', shortName: 'Clawing 1.1', provider: 'Longclaw', value: 73.2, isLongclaw: true, modelId: 'longclaw-clawing-1.1' },
      { model: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', value: 72.6, isCore: true },
      { model: 'Longclaw Clawing 1.1 Low', shortName: 'Clawing 1.1 Low', provider: 'Longclaw', value: 69.8, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.1-low' },
    ],
  },
  {
    id: 'livecodebench',
    category: 'coding',
    title: 'LiveCodeBench',
    shortTitle: 'LiveCodeBench',
    subtitle: 'Güncel yarışma ve algoritma problemlerinde tek denemede çözüm oranı',
    unit: '%',
    maxScale: 100,
    note: 'Pass@1 · Zaman sızıntısı olmayan güncel problemler',
    entries: [
      { model: 'Claude Sonnet 4', shortName: 'Claude Sonnet 4', provider: 'Anthropic', value: 66.8, isCore: true },
      { model: 'DeepSeek V4', shortName: 'DeepSeek V4', provider: 'DeepSeek', value: 66.3, isCore: true },
      { model: 'Longclaw Clawing 1.2 Ultra', shortName: 'Clawing 1.2 Ultra', provider: 'Longclaw', value: 66.1, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-ultra' },
      { model: 'Longclaw Clawing 1.2 Pro', shortName: 'Clawing 1.2 Pro', provider: 'Longclaw', value: 65.4, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-pro' },
      { model: 'Gemini 3', shortName: 'Gemini 3', provider: 'Google', value: 65.1, isCore: true },
      { model: 'Longclaw Clawing 1.1 Ultra', shortName: 'Clawing 1.1 Ultra', provider: 'Longclaw', value: 63.4, isLongclaw: true, modelId: 'longclaw-clawing-1.1-ultra' },
      { model: 'Longclaw Clawing 1.1 Pro', shortName: 'Clawing 1.1 Pro', provider: 'Longclaw', value: 61.2, isLongclaw: true, modelId: 'longclaw-clawing-1.1-pro' },
      { model: 'Longclaw Clawing 1 Pro', shortName: 'Clawing 1 Pro', provider: 'Longclaw', value: 58.9, isLongclaw: true, modelId: 'longclaw-clawing-1-pro' },
      { model: 'Longclaw Clawing 1.1', shortName: 'Clawing 1.1', provider: 'Longclaw', value: 56.8, isLongclaw: true, modelId: 'longclaw-clawing-1.1' },
      { model: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', value: 52.4, isCore: true },
      { model: 'Longclaw Clawing 1.1 Low', shortName: 'Clawing 1.1 Low', provider: 'Longclaw', value: 51.6, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.1-low' },
    ],
  },
  {
    id: 'swe-bench',
    category: 'coding',
    title: 'SWE-bench Verified',
    shortTitle: 'SWE-bench',
    subtitle: 'Gerçek açık kaynak kod depolarında hata tespiti ve yama üretimi',
    unit: '%',
    maxScale: 65,
    note: 'Agentless harness · 500 doğrulanmış GitHub görevi',
    entries: [
      { model: 'Claude Sonnet 4', shortName: 'Claude Sonnet 4', provider: 'Anthropic', value: 51.4, isCore: true },
      { model: 'Longclaw Clawing 1.2 Ultra', shortName: 'Clawing 1.2 Ultra', provider: 'Longclaw', value: 48.3, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-ultra' },
      { model: 'Longclaw Clawing 1.2 Pro', shortName: 'Clawing 1.2 Pro', provider: 'Longclaw', value: 46.9, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-pro' },
      { model: 'DeepSeek V4', shortName: 'DeepSeek V4', provider: 'DeepSeek', value: 46.2, isCore: true },
      { model: 'Gemini 3', shortName: 'Gemini 3', provider: 'Google', value: 45.8, isCore: true },
      { model: 'Longclaw Clawing 1.1 Ultra', shortName: 'Clawing 1.1 Ultra', provider: 'Longclaw', value: 44.1, isLongclaw: true, modelId: 'longclaw-clawing-1.1-ultra' },
      { model: 'Longclaw Clawing 1.1 Pro', shortName: 'Clawing 1.1 Pro', provider: 'Longclaw', value: 41.8, isLongclaw: true, modelId: 'longclaw-clawing-1.1-pro' },
      { model: 'Longclaw Clawing 1 Pro', shortName: 'Clawing 1 Pro', provider: 'Longclaw', value: 39.6, isLongclaw: true, modelId: 'longclaw-clawing-1-pro' },
      { model: 'Longclaw Clawing 1.1', shortName: 'Clawing 1.1', provider: 'Longclaw', value: 37.9, isLongclaw: true, modelId: 'longclaw-clawing-1.1' },
      { model: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', value: 35.6, isCore: true },
      { model: 'Longclaw Clawing 1.1 Low', shortName: 'Clawing 1.1 Low', provider: 'Longclaw', value: 33.2, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.1-low' },
    ],
  },
  {
    id: 'math-500',
    category: 'math',
    title: 'MATH-500',
    shortTitle: 'MATH-500',
    subtitle: 'Lise ve olimpiyat seviyesinde çok adımlı matematiksel akıl yürütme',
    unit: '%',
    maxScale: 100,
    note: 'Zero-shot · Adım adım çözüm doğrulaması',
    entries: [
      { model: 'DeepSeek V4', shortName: 'DeepSeek V4', provider: 'DeepSeek', value: 91.8, isCore: true },
      { model: 'Longclaw Clawing 1.2 Ultra', shortName: 'Clawing 1.2 Ultra', provider: 'Longclaw', value: 91.2, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-ultra' },
      { model: 'Gemini 3', shortName: 'Gemini 3', provider: 'Google', value: 90.5, isCore: true },
      { model: 'Longclaw Clawing 1.2 Pro', shortName: 'Clawing 1.2 Pro', provider: 'Longclaw', value: 89.8, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-pro' },
      { model: 'Longclaw Clawing 1.1 Ultra', shortName: 'Clawing 1.1 Ultra', provider: 'Longclaw', value: 88.4, isLongclaw: true, modelId: 'longclaw-clawing-1.1-ultra' },
      { model: 'Claude Sonnet 4', shortName: 'Claude Sonnet 4', provider: 'Anthropic', value: 86.4, isCore: true },
      { model: 'Longclaw Clawing 1.1 Pro', shortName: 'Clawing 1.1 Pro', provider: 'Longclaw', value: 85.7, isLongclaw: true, modelId: 'longclaw-clawing-1.1-pro' },
      { model: 'Longclaw Clawing 1 Pro', shortName: 'Clawing 1 Pro', provider: 'Longclaw', value: 83.2, isLongclaw: true, modelId: 'longclaw-clawing-1-pro' },
      { model: 'Longclaw Clawing 1.1', shortName: 'Clawing 1.1', provider: 'Longclaw', value: 81.4, isLongclaw: true, modelId: 'longclaw-clawing-1.1' },
      { model: 'Longclaw Clawing 1.1 Low', shortName: 'Clawing 1.1 Low', provider: 'Longclaw', value: 75.4, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.1-low' },
      { model: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', value: 73.2, isCore: true },
    ],
  },
  {
    id: 'gpqa-diamond',
    category: 'math',
    title: 'GPQA Diamond',
    shortTitle: 'GPQA Diamond',
    subtitle: 'Fizik, kimya ve biyolojide doktora düzeyinde muhakeme soruları',
    unit: '%',
    maxScale: 85,
    note: 'Zero-shot · Uzmanların bile zorlandığı alt küme',
    entries: [
      { model: 'Longclaw Clawing 1.2 Ultra', shortName: 'Clawing 1.2 Ultra', provider: 'Longclaw', value: 71.4, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-ultra' },
      { model: 'Gemini 3', shortName: 'Gemini 3', provider: 'Google', value: 68.9, isCore: true },
      { model: 'Claude Sonnet 4', shortName: 'Claude Sonnet 4', provider: 'Anthropic', value: 68.2, isCore: true },
      { model: 'Longclaw Clawing 1.2 Pro', shortName: 'Clawing 1.2 Pro', provider: 'Longclaw', value: 67.6, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-pro' },
      { model: 'Longclaw Clawing 1.1 Ultra', shortName: 'Clawing 1.1 Ultra', provider: 'Longclaw', value: 65.8, isLongclaw: true, modelId: 'longclaw-clawing-1.1-ultra' },
      { model: 'DeepSeek V4', shortName: 'DeepSeek V4', provider: 'DeepSeek', value: 64.7, isCore: true },
      { model: 'Longclaw Clawing 1.1 Pro', shortName: 'Clawing 1.1 Pro', provider: 'Longclaw', value: 62.4, isLongclaw: true, modelId: 'longclaw-clawing-1.1-pro' },
      { model: 'Longclaw Clawing 1 Pro', shortName: 'Clawing 1 Pro', provider: 'Longclaw', value: 59.8, isLongclaw: true, modelId: 'longclaw-clawing-1-pro' },
      { model: 'Longclaw Clawing 1.1', shortName: 'Clawing 1.1', provider: 'Longclaw', value: 57.2, isLongclaw: true, modelId: 'longclaw-clawing-1.1' },
      { model: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', value: 50.8, isCore: true },
      { model: 'Longclaw Clawing 1.1 Low', shortName: 'Clawing 1.1 Low', provider: 'Longclaw', value: 50.2, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.1-low' },
    ],
  },
  {
    id: 'ifeval',
    category: 'speed',
    title: 'IFEval (Talimat Uyumu)',
    shortTitle: 'IFEval',
    subtitle: 'Biçim, uzunluk, ton ve kısıt kurallarına birebir sadık kalma oranı',
    unit: '%',
    maxScale: 100,
    note: 'Strict Prompt Accuracy · Günlük iş akışları için kritik metrik',
    entries: [
      { model: 'Longclaw Clawing 1.2 Ultra', shortName: 'Clawing 1.2 Ultra', provider: 'Longclaw', value: 90.6, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-ultra' },
      { model: 'Longclaw Clawing 1.2 Pro', shortName: 'Clawing 1.2 Pro', provider: 'Longclaw', value: 89.9, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-pro' },
      { model: 'Longclaw Clawing 1.1 Ultra', shortName: 'Clawing 1.1 Ultra', provider: 'Longclaw', value: 89.4, isLongclaw: true, modelId: 'longclaw-clawing-1.1-ultra' },
      { model: 'Claude Sonnet 4', shortName: 'Claude Sonnet 4', provider: 'Anthropic', value: 89.1, isCore: true },
      { model: 'Longclaw Clawing 1.1 Pro', shortName: 'Clawing 1.1 Pro', provider: 'Longclaw', value: 88.7, isLongclaw: true, modelId: 'longclaw-clawing-1.1-pro' },
      { model: 'Gemini 3', shortName: 'Gemini 3', provider: 'Google', value: 88.4, isCore: true },
      { model: 'Longclaw Clawing 1 Pro', shortName: 'Clawing 1 Pro', provider: 'Longclaw', value: 87.2, isLongclaw: true, modelId: 'longclaw-clawing-1-pro' },
      { model: 'Longclaw Clawing 1.1', shortName: 'Clawing 1.1', provider: 'Longclaw', value: 86.6, isLongclaw: true, modelId: 'longclaw-clawing-1.1' },
      { model: 'DeepSeek V4', shortName: 'DeepSeek V4', provider: 'DeepSeek', value: 86.2, isCore: true },
      { model: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', value: 85.1, isCore: true },
      { model: 'Longclaw Clawing 1.1 Low', shortName: 'Clawing 1.1 Low', provider: 'Longclaw', value: 83.9, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.1-low' },
    ],
  },
  {
    id: 'throughput',
    category: 'speed',
    title: 'Çıktı Hızı (Token / saniye)',
    shortTitle: 'Throughput',
    subtitle: 'Orta efor seviyesinde saniyede üretilen ortalama token miktarı',
    unit: ' tok/s',
    maxScale: 200,
    note: 'Medyan akış hızı · Yüksek değer daha hızlıdır',
    entries: [
      { model: 'Longclaw Clawing 1.1 Low', shortName: 'Clawing 1.1 Low', provider: 'Longclaw', value: 184, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.1-low' },
      { model: 'Longclaw Clawing 1.2 Pro', shortName: 'Clawing 1.2 Pro', provider: 'Longclaw', value: 148, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-pro' },
      { model: 'Gemini 3', shortName: 'Gemini 3', provider: 'Google', value: 132, isCore: true },
      { model: 'Longclaw Clawing 1.1', shortName: 'Clawing 1.1', provider: 'Longclaw', value: 126, isLongclaw: true, modelId: 'longclaw-clawing-1.1' },
      { model: 'Longclaw Clawing 1.1 Pro', shortName: 'Clawing 1.1 Pro', provider: 'Longclaw', value: 88, isLongclaw: true, modelId: 'longclaw-clawing-1.1-pro' },
      { model: 'Claude Sonnet 4', shortName: 'Claude Sonnet 4', provider: 'Anthropic', value: 79, isCore: true },
      { model: 'Longclaw Clawing 1 Pro', shortName: 'Clawing 1 Pro', provider: 'Longclaw', value: 76, isLongclaw: true, modelId: 'longclaw-clawing-1-pro' },
      { model: 'DeepSeek V4', shortName: 'DeepSeek V4', provider: 'DeepSeek', value: 72, isCore: true },
      { model: 'GPT-4', shortName: 'GPT-4', provider: 'OpenAI', value: 68, isCore: true },
      { model: 'Longclaw Clawing 1.1 Ultra', shortName: 'Clawing 1.1 Ultra', provider: 'Longclaw', value: 58, isLongclaw: true, modelId: 'longclaw-clawing-1.1-ultra' },
      { model: 'Longclaw Clawing 1.2 Ultra', shortName: 'Clawing 1.2 Ultra', provider: 'Longclaw', value: 52, isLongclaw: true, isCore: true, modelId: 'longclaw-clawing-1.2-ultra' },
    ],
  },
];

type SortKey = 'trBench' | 'mmluPro' | 'liveCode' | 'sweBench' | 'math500' | 'ifeval' | 'speed';

interface SummaryRow {
  model: string;
  shortName: string;
  provider: string;
  isLongclaw?: boolean;
  modelId?: ChatModelId;
  trBench: number;
  mmluPro: number;
  liveCode: number;
  sweBench: number;
  math500: number;
  ifeval: number;
  speed: number;
}

const SUMMARY_ROWS: SummaryRow[] = [
  {
    model: 'Longclaw Clawing 1.2 Ultra',
    shortName: 'Clawing 1.2 Ultra',
    provider: 'Longclaw',
    isLongclaw: true,
    modelId: 'longclaw-clawing-1.2-ultra',
    trBench: 88.4,
    mmluPro: 84.6,
    liveCode: 66.1,
    sweBench: 48.3,
    math500: 91.2,
    ifeval: 90.6,
    speed: 52,
  },
  {
    model: 'Longclaw Clawing 1.2 Pro',
    shortName: 'Clawing 1.2 Pro',
    provider: 'Longclaw',
    isLongclaw: true,
    modelId: 'longclaw-clawing-1.2-pro',
    trBench: 87.2,
    mmluPro: 82.1,
    liveCode: 65.4,
    sweBench: 46.9,
    math500: 89.8,
    ifeval: 89.9,
    speed: 148,
  },
  {
    model: 'Longclaw Clawing 1.1 Ultra',
    shortName: 'Clawing 1.1 Ultra',
    provider: 'Longclaw',
    isLongclaw: true,
    modelId: 'longclaw-clawing-1.1-ultra',
    trBench: 86.8,
    mmluPro: 77.6,
    liveCode: 63.4,
    sweBench: 44.1,
    math500: 88.4,
    ifeval: 89.4,
    speed: 58,
  },
  {
    model: 'Longclaw Clawing 1.1 Pro',
    shortName: 'Clawing 1.1 Pro',
    provider: 'Longclaw',
    isLongclaw: true,
    modelId: 'longclaw-clawing-1.1-pro',
    trBench: 85.9,
    mmluPro: 75.8,
    liveCode: 61.2,
    sweBench: 41.8,
    math500: 85.7,
    ifeval: 88.7,
    speed: 88,
  },
  {
    model: 'Longclaw Clawing 1 Pro',
    shortName: 'Clawing 1 Pro',
    provider: 'Longclaw',
    isLongclaw: true,
    modelId: 'longclaw-clawing-1-pro',
    trBench: 84.2,
    mmluPro: 74.1,
    liveCode: 58.9,
    sweBench: 39.6,
    math500: 83.2,
    ifeval: 87.2,
    speed: 76,
  },
  {
    model: 'Longclaw Clawing 1.1',
    shortName: 'Clawing 1.1',
    provider: 'Longclaw',
    isLongclaw: true,
    modelId: 'longclaw-clawing-1.1',
    trBench: 83.1,
    mmluPro: 73.2,
    liveCode: 56.8,
    sweBench: 37.9,
    math500: 81.4,
    ifeval: 86.6,
    speed: 126,
  },
  {
    model: 'Longclaw Clawing 1.1 Low',
    shortName: 'Clawing 1.1 Low',
    provider: 'Longclaw',
    isLongclaw: true,
    modelId: 'longclaw-clawing-1.1-low',
    trBench: 79.8,
    mmluPro: 69.8,
    liveCode: 51.6,
    sweBench: 33.2,
    math500: 75.4,
    ifeval: 83.9,
    speed: 184,
  },
  {
    model: 'Gemini 3',
    shortName: 'Gemini 3',
    provider: 'Google',
    trBench: 86.4,
    mmluPro: 81.2,
    liveCode: 65.1,
    sweBench: 45.8,
    math500: 90.5,
    ifeval: 88.4,
    speed: 132,
  },
  {
    model: 'Claude Sonnet 4',
    shortName: 'Claude Sonnet 4',
    provider: 'Anthropic',
    trBench: 85.3,
    mmluPro: 79.9,
    liveCode: 66.8,
    sweBench: 51.4,
    math500: 86.4,
    ifeval: 89.1,
    speed: 79,
  },
  {
    model: 'DeepSeek V4',
    shortName: 'DeepSeek V4',
    provider: 'DeepSeek',
    trBench: 82.7,
    mmluPro: 78.4,
    liveCode: 66.3,
    sweBench: 46.2,
    math500: 91.8,
    ifeval: 86.2,
    speed: 72,
  },
  {
    model: 'GPT-4',
    shortName: 'GPT-4',
    provider: 'OpenAI',
    trBench: 79.4,
    mmluPro: 72.6,
    liveCode: 52.4,
    sweBench: 35.6,
    math500: 73.2,
    ifeval: 85.1,
    speed: 68,
  },
];

const METRIC_COLUMNS: ReadonlyArray<{ key: SortKey; label: string; isSpeed?: boolean }> = [
  { key: 'trBench', label: 'TR-Bench' },
  { key: 'mmluPro', label: 'MMLU-Pro' },
  { key: 'liveCode', label: 'LiveCode' },
  { key: 'sweBench', label: 'SWE-bench' },
  { key: 'math500', label: 'MATH-500' },
  { key: 'ifeval', label: 'IFEval' },
  { key: 'speed', label: 'Speed', isSpeed: true },
];

export function BenchmarkPage({ lang, onBack, onOpenAuth }: BenchmarkPageProps) {
  const b = TRANSLATIONS[lang].benchmarks;
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [selectedBenchId, setSelectedBenchId] = useState<string>('tr-bench');
  const [showAllModels, setShowAllModels] = useState<boolean>(false);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('trBench');

  const visibleBenchmarks = useMemo(
    () =>
      selectedCategory === 'all'
        ? BENCHMARKS
        : BENCHMARKS.filter((item) => item.category === selectedCategory),
    [selectedCategory]
  );

  const activeBench =
    visibleBenchmarks.find((item) => item.id === selectedBenchId) || visibleBenchmarks[0];

  const activeCardText = b.cards[activeBench.id];
  const activeUnit = activeCardText?.unit || activeBench.unit;

  const displayedEntries = useMemo(() => {
    const list = showAllModels
      ? activeBench.entries
      : activeBench.entries.filter((e) => e.isCore);
    return [...list].sort((a, c) => c.value - a.value);
  }, [activeBench, showAllModels]);

  const topScore = displayedEntries[0]?.value ?? 0;

  // Compute max per column for clean bold highlighting in the comparison matrix
  const columnLeaders = useMemo(() => {
    const leaders: Record<SortKey, number> = {
      trBench: 0,
      mmluPro: 0,
      liveCode: 0,
      sweBench: 0,
      math500: 0,
      ifeval: 0,
      speed: 0,
    };
    for (const col of METRIC_COLUMNS) {
      leaders[col.key] = Math.max(...SUMMARY_ROWS.map((r) => r[col.key]));
    }
    return leaders;
  }, []);

  const sortedSummaryRows = useMemo(
    () => [...SUMMARY_ROWS].sort((a, c) => c[sortBy] - a[sortBy]),
    [sortBy]
  );

  const handleCategoryChange = (cat: CategoryId) => {
    setSelectedCategory(cat);
    const nextList = cat === 'all' ? BENCHMARKS : BENCHMARKS.filter((item) => item.category === cat);
    if (nextList.length > 0 && !nextList.some((item) => item.id === selectedBenchId)) {
      setSelectedBenchId(nextList[0].id);
    }
  };

  const ui =
    lang === 'tr'
      ? {
          keyModels: 'Öne Çıkanlar',
          allModels: `Tüm ${SUMMARY_ROWS.length} Model`,
          leaderLabel: 'Lider',
          selectBenchmark: 'Test seçin',
          sortHint: 'Sıralamak için sütun başlığına tıklayın',
        }
      : {
          keyModels: 'Key models',
          allModels: `All ${SUMMARY_ROWS.length} models`,
          leaderLabel: 'Leader',
          selectBenchmark: 'Select benchmark',
          sortHint: 'Click any column header to sort',
        };

  const highlights = [
    {
      id: 'longclaw-clawing-1.2-ultra' as ChatModelId,
      name: 'Clawing 1.2 Ultra',
      stat: '88.4%',
      statLabel: 'TR-Bench #1',
      desc: b.takeaways.ultra12,
    },
    {
      id: 'longclaw-clawing-1.2-pro' as ChatModelId,
      name: 'Clawing 1.2 Pro',
      stat: '148 tok/s',
      statLabel: lang === 'tr' ? 'Ekonomik · 89.9% IFEval' : 'Budget · 89.9% IFEval',
      desc:
        lang === 'tr'
          ? 'Güçlü kod ve akıl yürütme performansını 148 tok/s hızla birleştirir; gün boyu rahatça kullanılacak dengeli model.'
          : 'Keeps close to our top coding and reasoning marks while streaming at 148 tok/s—the balanced model most people leave on all day.',
    },
    {
      id: 'longclaw-clawing-1.1-ultra' as ChatModelId,
      name: 'Clawing 1.1 Ultra',
      stat: '89.4%',
      statLabel: 'IFEval',
      desc: b.takeaways.ultra11,
    },
    {
      id: 'longclaw-clawing-1.1-low' as ChatModelId,
      name: 'Clawing 1.1 Low',
      stat: '184 tok/s',
      statLabel: lang === 'tr' ? 'En hızlı akış' : 'Fastest output',
      desc: b.takeaways.low11,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] text-[var(--tx)]">
      {/* Header & Architectural Highlights */}
      <section className="pt-8 sm:pt-14 pb-10 sm:pb-16 border-b border-[var(--bd)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--mut)] hover:text-[var(--tx)] transition-colors mb-6 sm:mb-8 py-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{b.backToHome}</span>
          </button>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-12">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-[var(--mut)] mb-2.5">
                {b.eyebrow}
              </p>
              <h1 className="font-serif-fraunces text-[2rem] sm:text-5xl font-medium tracking-[-0.025em] leading-[1.08] text-balance">
                {b.title}
              </h1>
              <p className="mt-3.5 sm:mt-4 text-[15px] sm:text-base text-[var(--mut)] leading-[1.7]">
                {b.subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenAuth('up')}
              className="btn-3d-primary w-full sm:w-auto px-6 py-3 rounded-full text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{b.testYourself}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Editorial Highlight Slabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10 sm:mt-14">
            {highlights.map((item) => (
              <div key={item.id} className="surface-3d rounded-2xl p-5 sm:p-6 space-y-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <ModelLogo modelId={item.id} className="w-[22px] h-[22px] shrink-0" />
                  <span className="text-xs sm:text-sm font-soft font-semibold text-[var(--tx)] truncate">
                    {item.name}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-0.5">
                  <span className="text-2xl sm:text-[1.7rem] font-semibold tracking-tight tabular-nums text-[var(--tx)]">
                    {item.stat}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[var(--mut)]">{item.statLabel}</span>
                </div>
                <p className="text-xs sm:text-[13px] text-[var(--mut)] leading-[1.65]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Spotlight Benchmark Explorer */}
      <section className="py-10 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          {/* Category Tabs + Model Density Switch */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-[var(--bd)] pb-0">
            <div className="flex items-center gap-6 sm:gap-7 overflow-x-auto no-scrollbar -mb-[1px]">
              {CATEGORY_TAB_IDS.map((tabId) => {
                const active = selectedCategory === tabId;
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => handleCategoryChange(tabId)}
                    className={`relative pb-3.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'text-[var(--ac)] font-semibold'
                        : 'text-[var(--mut)] hover:text-[var(--tx)]'
                    }`}
                  >
                    <span>{b.tabs[tabId]}</span>
                    {active && (
                      <motion.span
                        layoutId="benchCategoryUnderline"
                        transition={LIQUID_MORPH}
                        className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--ac)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 pb-3.5 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setShowAllModels(false)}
                className={`transition-colors cursor-pointer ${
                  !showAllModels
                    ? 'text-[var(--tx)] font-semibold'
                    : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                {ui.keyModels}
              </button>
              <span className="text-[var(--bd)] select-none">/</span>
              <button
                type="button"
                onClick={() => setShowAllModels(true)}
                className={`transition-colors cursor-pointer ${
                  showAllModels
                    ? 'text-[var(--tx)] font-semibold'
                    : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                {ui.allModels}
              </button>
            </div>
          </div>

          {/* Mobile Horizontal Benchmark Selector */}
          <div className="lg:hidden mt-6 -mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-5 border-b border-[var(--bd)] w-max">
              {visibleBenchmarks.map((item) => {
                const active = item.id === activeBench.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedBenchId(item.id)}
                    className={`pb-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 border-b-2 -mb-[1px] ${
                      active
                        ? 'text-[var(--tx)] border-[var(--tx)] font-semibold'
                        : 'text-[var(--mut)] border-transparent hover:text-[var(--tx)]'
                    }`}
                  >
                    {item.shortTitle}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Two-Column Focused Reading Layout: Desktop Index + Spacious Chart */}
          <div className="mt-7 lg:mt-12 grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-8 lg:gap-14 items-start">
            {/* Desktop Left: Benchmark Index List */}
            <div className="hidden lg:block">
              <p className="text-xs font-medium text-[var(--mut)] mb-3">
                {ui.selectBenchmark}
              </p>
              <div className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
                {visibleBenchmarks.map((item) => {
                  const active = item.id === activeBench.id;
                  const itemText = b.cards[item.id];
                  const leader = item.entries[0];
                  const itemUnit = itemText?.unit || item.unit;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedBenchId(item.id)}
                      className={`w-full py-3.5 text-left transition-colors cursor-pointer group flex items-center justify-between gap-3 ${
                        active ? 'text-[var(--tx)]' : 'text-[var(--mut)] hover:text-[var(--tx)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <span
                          className={`block text-sm truncate ${
                            active ? 'font-semibold text-[var(--tx)]' : 'font-medium'
                          }`}
                        >
                          {item.shortTitle}
                        </span>
                        <span className="block text-[11px] text-[var(--mut)] truncate mt-0.5">
                          {leader.shortName} ·{' '}
                          <span className="tabular-nums font-medium">
                            {leader.value}
                            {itemUnit}
                          </span>
                        </span>
                      </div>

                      <ArrowRight
                        className={`w-3.5 h-3.5 shrink-0 transition-all duration-200 ${
                          active
                            ? 'text-[var(--tx)] opacity-100 translate-x-0'
                            : 'text-[var(--mut)] opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Open Active Benchmark Chart */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeBench.id}-${showAllModels}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="min-w-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-6 border-b border-[var(--bd)]">
                  <div>
                    <h2 className="font-serif-fraunces text-2xl sm:text-[1.75rem] font-medium tracking-tight text-[var(--tx)]">
                      {activeCardText?.title || activeBench.title}
                    </h2>
                    <p className="text-sm text-[var(--mut)] mt-1.5 leading-relaxed max-w-xl">
                      {activeCardText?.subtitle || activeBench.subtitle}
                    </p>
                  </div>

                  {/* Clean Legend */}
                  <div className="flex items-center gap-4 text-xs text-[var(--mut)] shrink-0">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-1.5 rounded-sm bg-[var(--ac)] inline-block" />
                      <span>{b.legendLongclaw}</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-1.5 rounded-sm bg-[var(--bd)] inline-block" />
                      <span>{b.legendOthers}</span>
                    </span>
                  </div>
                </div>

                {/* Clean, Airy Horizontal Bars */}
                <div
                  className="py-7 space-y-5"
                  onMouseLeave={() => setHoveredModel(null)}
                >
                  {displayedEntries.map((entry, idx) => {
                    const pct = Math.min(100, (entry.value / activeBench.maxScale) * 100);
                    const isLeader = entry.value === topScore;
                    const isDimmed = hoveredModel !== null && hoveredModel !== entry.model;

                    return (
                      <div
                        key={entry.model}
                        onMouseEnter={() => setHoveredModel(entry.model)}
                        className={`transition-opacity duration-200 ${
                          isDimmed ? 'opacity-45' : 'opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-5 text-xs font-medium tabular-nums text-[var(--mut)] shrink-0">
                              0{idx + 1}
                            </span>
                            <BenchmarkModelLogo
                              provider={entry.provider}
                              modelId={entry.modelId}
                              className="w-[19px] h-[19px] shrink-0"
                            />
                            <span
                              className={`text-sm truncate ${
                                entry.isLongclaw
                                  ? 'font-semibold text-[var(--tx)]'
                                  : 'text-[var(--tx)]/75'
                              }`}
                            >
                              {entry.shortName}
                            </span>
                            {!entry.isLongclaw && (
                              <span className="hidden sm:inline text-xs text-[var(--mut)] shrink-0">
                                {entry.provider}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            {isLeader && (
                              <span className="text-[11px] font-semibold text-[var(--ac)]">
                                {ui.leaderLabel}
                              </span>
                            )}
                            <span
                              className={`text-sm tabular-nums ${
                                isLeader || entry.isLongclaw
                                  ? 'font-semibold text-[var(--tx)]'
                                  : 'text-[var(--mut)]'
                              }`}
                            >
                              {entry.value}
                              {activeUnit}
                            </span>
                          </div>
                        </div>

                        <div className="pl-8">
                          <div className="bar-3d-track w-full h-2.5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: pct / 100 }}
                              transition={{
                                ...LIQUID_BAR,
                                delay: idx * 0.032,
                              }}
                              className={`h-full w-full rounded-full origin-left ${
                                entry.isLongclaw ? 'bar-3d-cobalt' : 'bar-3d-neutral'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-[var(--bd)] text-xs text-[var(--mut)]">
                  {activeCardText?.note || activeBench.note}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Clean, Sortable Full Comparison Matrix — Architectural Table */}
      <section className="py-10 sm:py-20 bg-[var(--surf)]/55 border-t border-[var(--bd)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="font-serif-fraunces text-2xl sm:text-3xl font-medium tracking-tight">
                {b.tableTitle}
              </h2>
              <p className="text-sm text-[var(--mut)] mt-1.5">
                {b.tableSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--mut)]">
              <span className="hidden sm:inline">{ui.sortHint}</span>
              <span className="sm:hidden inline-flex items-center gap-1">
                <span>{b.scrollHint}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border-y border-[var(--bd)]">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--bd)] text-xs text-[var(--mut)]">
                  <th className="py-4 pr-4 font-medium">{b.colModel}</th>
                  {METRIC_COLUMNS.map((col) => {
                    const isSorted = sortBy === col.key;
                    const label = col.isSpeed ? b.colSpeed : col.label;
                    return (
                      <th key={col.key} className="py-4 px-2.5 text-right font-medium">
                        <button
                          type="button"
                          onClick={() => setSortBy(col.key)}
                          className={`inline-flex items-center justify-end gap-1 transition-colors cursor-pointer ${
                            isSorted
                              ? 'text-[var(--tx)] font-semibold'
                              : 'text-[var(--mut)] hover:text-[var(--tx)]'
                          }`}
                        >
                          <span>{label}</span>
                          <ArrowUpDown className={`w-3 h-3 ${isSorted ? 'opacity-100' : 'opacity-40'}`} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--bd)]/75 text-[13.5px]">
                {sortedSummaryRows.map((row) => (
                  <tr
                    key={row.model}
                    className={`transition-colors hover:bg-[var(--surf)]/55 ${
                      row.isLongclaw ? 'bg-[var(--surf)]/30 text-[var(--tx)]' : 'text-[var(--mut)]'
                    }`}
                  >
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-2.5 whitespace-nowrap">
                        <BenchmarkModelLogo
                          provider={row.provider}
                          modelId={row.modelId}
                          className="w-[19px] h-[19px] shrink-0"
                        />
                        <span
                          className={
                            row.isLongclaw
                              ? 'font-semibold text-[var(--tx)]'
                              : 'text-[var(--tx)]/80'
                          }
                        >
                          {row.shortName}
                        </span>
                        {!row.isLongclaw && (
                          <span className="text-xs text-[var(--mut)]">{row.provider}</span>
                        )}
                      </div>
                    </td>

                    {METRIC_COLUMNS.map((col) => {
                      const val = row[col.key];
                      const isBest = val === columnLeaders[col.key];
                      const isSortedCol = sortBy === col.key;
                      return (
                        <td
                          key={col.key}
                          className={`py-4 px-2.5 text-right tabular-nums whitespace-nowrap ${
                            isBest
                              ? 'font-semibold text-[var(--tx)] underline underline-offset-4 decoration-[var(--tx)]/40'
                              : isSortedCol
                              ? 'text-[var(--tx)]'
                              : ''
                          }`}
                        >
                          {col.isSpeed ? `${val} tok/s` : `${val}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pt-4 text-xs text-[var(--mut)]">
            <p className="leading-relaxed max-w-2xl">{b.methodologyNote}</p>
            <button
              type="button"
              onClick={() => onOpenAuth('up')}
              className="btn-3d-primary w-full sm:w-auto px-6 py-3 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{b.startChatting}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
