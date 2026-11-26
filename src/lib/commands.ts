import { CustomSlashCommand } from './firebase';
import { Language } from './i18n';
import { ConnectorId } from './workspace';

export type SlashActionType =
  | 'new'
  | 'connectors'
  | 'settings'
  | 'depth_fast'
  | 'depth_mid'
  | 'depth_deep';

export interface SlashCommandItem {
  id: string;
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  isCustom: boolean;
  kind: 'custom' | 'prompt' | 'image' | 'action' | 'connector';
  actionType?: SlashActionType;
  connectorId?: ConnectorId;
  prompt?: string;
  /** Whether selecting this command should fill `/name ` so the user can type arguments first */
  expectsArgs: boolean;
}

export interface ParsedSlashExecution {
  command: SlashCommandItem;
  args: string;
  /** Cleaned display text shown in the user message bubble */
  displayContent: string;
  /** Expanded prompt sent to the model (when kind is 'prompt' or 'custom') */
  expandedPrompt?: string;
  /** Optional depth override when running /fast, /mid, or /deep with inline text */
  overrideDepth?: 'fast' | 'mid' | 'deep';
}

export function normalizeCommandName(raw: string): string {
  return raw
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 32);
}

function normalizeLookupToken(token: string): string {
  return token.trim().toLocaleLowerCase('tr-TR');
}

export function getBuiltInCommands(lang: Language): SlashCommandItem[] {
  const isTr = lang === 'tr';
  return [
    {
      id: 'builtin-gmail',
      name: 'gmail',
      aliases: ['mail', 'eposta'],
      description: isTr
        ? 'Gmail’de e-posta taslağı oluştur, gönder veya gelen kutunu oku'
        : 'Draft or send emails and check Gmail directly',
      usage: isTr ? '/gmail <istek>' : '/gmail <request>',
      isCustom: false,
      kind: 'connector',
      connectorId: 'gmail',
      expectsArgs: true,
    },
    {
      id: 'builtin-takvim',
      name: isTr ? 'takvim' : 'calendar',
      aliases: isTr ? ['calendar', 'etkinlik'] : ['takvim', 'event', 'etkinlik'],
      description: isTr
        ? 'Google Takvim’e doğrudan etkinlik ekle, güncelle veya programını gör'
        : 'Create or manage Google Calendar events directly',
      usage: isTr ? '/takvim <istek>' : '/calendar <request>',
      isCustom: false,
      kind: 'connector',
      connectorId: 'calendar',
      expectsArgs: true,
    },
    {
      id: 'builtin-drive',
      name: 'drive',
      aliases: ['dosya', 'files'],
      description: isTr
        ? 'Google Drive’da klasör/dosya oluştur veya dosyalarını bul'
        : 'Create Drive folders/files or search your Drive directly',
      usage: isTr ? '/drive <istek>' : '/drive <request>',
      isCustom: false,
      kind: 'connector',
      connectorId: 'drive',
      expectsArgs: true,
    },
    {
      id: 'builtin-dokuman',
      name: isTr ? 'döküman' : 'docs',
      aliases: isTr ? ['dokuman', 'docs', 'doc', 'belge'] : ['döküman', 'dokuman', 'doc', 'belge'],
      description: isTr
        ? 'Google Dokümanlar’da doğrudan yeni belge yaz veya mevcut belgeyi oku'
        : 'Create and write a Google Doc or read existing docs directly',
      usage: isTr ? '/döküman <istek>' : '/docs <request>',
      isCustom: false,
      kind: 'connector',
      connectorId: 'docs',
      expectsArgs: true,
    },
    {
      id: 'builtin-gorev',
      name: isTr ? 'görev' : 'tasks',
      aliases: isTr ? ['gorev', 'tasks', 'task'] : ['görev', 'gorev', 'task'],
      description: isTr
        ? 'Google Görevler’e doğrudan görev ekle, tamamla veya listele'
        : 'Add, complete, or list Google Tasks directly',
      usage: isTr ? '/görev <istek>' : '/tasks <request>',
      isCustom: false,
      kind: 'connector',
      connectorId: 'tasks',
      expectsArgs: true,
    },
    {
      id: 'builtin-image',
      name: 'image',
      aliases: ['görsel', 'gorsel'],
      description: isTr
        ? 'Yazdığın açıklamadan görsel oluştur'
        : 'Create an image from a description',
      usage: isTr ? '/image <açıklama>' : '/image <description>',
      isCustom: false,
      kind: 'image',
      expectsArgs: true,
    },
    {
      id: 'builtin-summarize',
      name: 'summarize',
      aliases: ['özet', 'ozet'],
      description: isTr
        ? 'Uzun bir metni veya notları kısaca özetle'
        : 'Distill notes or long text into key takeaways',
      usage: isTr ? '/summarize <metin>' : '/summarize <text>',
      isCustom: false,
      kind: 'prompt',
      expectsArgs: true,
      prompt: isTr
        ? 'Aşağıdaki metni net, gereksiz dolgu olmadan kısa maddeler ve tek cümlelik bir özetle toparla:\n\n{input}'
        : 'Summarize the following clearly and concisely with key takeaways and no filler:\n\n{input}',
    },
    {
      id: 'builtin-translate',
      name: 'translate',
      aliases: ['çevir', 'cevir'],
      description: isTr
        ? 'Metni doğal bir dille İngilizce veya Türkçeye çevir'
        : 'Translate text naturally into another language',
      usage: isTr ? '/translate <metin>' : '/translate <text>',
      isCustom: false,
      kind: 'prompt',
      expectsArgs: true,
      prompt: isTr
        ? 'Aşağıdaki metni doğal, akıcı ve anlamını koruyarak çevir. Belirli bir hedef dil yazılmamışsa Türkçe ise İngilizceye, başka bir dildeyse Türkçeye çevir:\n\n{input}'
        : 'Translate the following naturally while preserving tone and meaning. If no target language is specified, translate non-English text into English or English text into Turkish:\n\n{input}',
    },
    {
      id: 'builtin-polish',
      name: 'polish',
      aliases: ['düzelt', 'duzelt'],
      description: isTr
        ? 'Yazım, akış ve tonu doğallığını bozmadan düzelt'
        : 'Tighten grammar, clarity, and flow naturally',
      usage: isTr ? '/polish <metin>' : '/polish <text>',
      isCustom: false,
      kind: 'prompt',
      expectsArgs: true,
      prompt: isTr
        ? 'Aşağıdaki metnin dilbilgisini, akıcılığını ve netliğini geliştir. Yapay veya abartılı ifadeler ekleme, doğal bir insan sesi koru:\n\n{input}'
        : 'Edit the following for clarity, grammar, and natural flow without making it sound stiff or overly formal:\n\n{input}',
    },
    {
      id: 'builtin-bullets',
      name: 'bullets',
      description: isTr
        ? 'Dağınık notları düzenli maddelere ve aksiyonlara çevir'
        : 'Turn rough notes into clean bullet points and next steps',
      usage: isTr ? '/bullets <notlar>' : '/bullets <notes>',
      isCustom: false,
      kind: 'prompt',
      expectsArgs: true,
      prompt: isTr
        ? 'Aşağıdaki dağınık notları düzenli başlıklar, net maddeler ve varsa yapılacaklar listesi hâline getir:\n\n{input}'
        : 'Organize the following notes into clean bullet points with clear action items where relevant:\n\n{input}',
    },
    {
      id: 'builtin-code',
      name: 'code',
      description: isTr
        ? 'Temiz kod yaz veya bir hatayı adım adım çöz'
        : 'Write clean code or debug a snippet',
      usage: isTr ? '/code <istek>' : '/code <request>',
      isCustom: false,
      kind: 'prompt',
      expectsArgs: true,
      prompt: isTr
        ? 'Aşağıdaki geliştirme isteği için temiz, doğrudan çalışabilir kod yaz ve kritik kararları kısaca açıkla:\n\n{input}'
        : 'Write clean, well-structured code for the following request and briefly explain the key decisions:\n\n{input}',
    },
    {
      id: 'builtin-fast',
      name: 'fast',
      description: isTr
        ? 'Hızlı moda geç (istersen mesajla birlikte gönder)'
        : 'Switch to Fast depth (optionally with a message)',
      usage: isTr ? '/fast [mesaj]' : '/fast [message]',
      isCustom: false,
      kind: 'action',
      actionType: 'depth_fast',
      expectsArgs: false,
    },
    {
      id: 'builtin-mid',
      name: 'mid',
      description: isTr
        ? 'Dengeli moda geç (istersen mesajla birlikte gönder)'
        : 'Switch to Balanced depth (optionally with a message)',
      usage: isTr ? '/mid [mesaj]' : '/mid [message]',
      isCustom: false,
      kind: 'action',
      actionType: 'depth_mid',
      expectsArgs: false,
    },
    {
      id: 'builtin-deep',
      name: 'deep',
      description: isTr
        ? 'Derin düşünme moduna geç (istersen mesajla birlikte gönder)'
        : 'Switch to Deep depth (optionally with a message)',
      usage: isTr ? '/deep [mesaj]' : '/deep [message]',
      isCustom: false,
      kind: 'action',
      actionType: 'depth_deep',
      expectsArgs: false,
    },
    {
      id: 'builtin-new',
      name: 'new',
      description: isTr ? 'Yeni bir sohbet başlat' : 'Start a fresh conversation',
      usage: '/new',
      isCustom: false,
      kind: 'action',
      actionType: 'new',
      expectsArgs: false,
    },
    {
      id: 'builtin-connectors',
      name: 'connectors',
      description: isTr
        ? 'Google Workspace bağlayıcılarını aç'
        : 'Open Google Workspace connectors',
      usage: '/connectors',
      isCustom: false,
      kind: 'action',
      actionType: 'connectors',
      expectsArgs: false,
    },
    {
      id: 'builtin-settings',
      name: 'settings',
      description: isTr
        ? 'Ayarları ve özel komutları aç'
        : 'Open Settings and manage custom commands',
      usage: '/settings',
      isCustom: false,
      kind: 'action',
      actionType: 'settings',
      expectsArgs: false,
    },
  ];
}

export function getAllSlashCommands(
  customCommands: CustomSlashCommand[],
  lang: Language
): SlashCommandItem[] {
  const customItems: SlashCommandItem[] = customCommands.map((cmd) => {
    const hasPlaceholder = /\{input\}/i.test(cmd.prompt);
    return {
      id: cmd.id,
      name: cmd.name,
      description:
        cmd.description ||
        (lang === 'tr' ? 'Özel komut şablonu' : 'Custom command prompt'),
      usage: hasPlaceholder
        ? `/${cmd.name} ${lang === 'tr' ? '<metin>' : '<input>'}`
        : `/${cmd.name}`,
      isCustom: true,
      kind: 'custom',
      prompt: cmd.prompt,
      expectsArgs: hasPlaceholder,
    };
  });

  const customNameSet = new Set(customItems.map((c) => normalizeLookupToken(c.name)));
  const builtIns = getBuiltInCommands(lang).filter(
    (b) => !customNameSet.has(normalizeLookupToken(b.name))
  );

  return [...customItems, ...builtIns];
}

export function filterSlashCommands(
  allCommands: SlashCommandItem[],
  queryToken: string
): SlashCommandItem[] {
  const q = normalizeLookupToken(queryToken);
  if (!q) return allCommands;

  return allCommands
    .filter((cmd) => {
      const nameNorm = normalizeLookupToken(cmd.name);
      const descNorm = normalizeLookupToken(cmd.description);
      const aliasMatch = (cmd.aliases || []).some((a) => normalizeLookupToken(a).includes(q));
      return nameNorm.includes(q) || descNorm.includes(q) || aliasMatch;
    })
    .sort((a, b) => {
      const aName = normalizeLookupToken(a.name);
      const bName = normalizeLookupToken(b.name);
      const aStarts =
        aName.startsWith(q) || (a.aliases || []).some((al) => normalizeLookupToken(al).startsWith(q))
          ? 0
          : 1;
      const bStarts =
        bName.startsWith(q) || (b.aliases || []).some((al) => normalizeLookupToken(al).startsWith(q))
          ? 0
          : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function expandPromptTemplate(template: string, args: string): string {
  const trimmedArgs = args.trim();
  if (/\{input\}/i.test(template)) {
    return template.replace(/\{input\}/gi, trimmedArgs).trim();
  }
  if (!trimmedArgs) return template.trim();
  return `${template.trim()}\n\n${trimmedArgs}`;
}

export function parseSlashCommandInput(
  rawInput: string,
  customCommands: CustomSlashCommand[],
  lang: Language
): ParsedSlashExecution | null {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith('/')) return null;

  const match = trimmed.match(/^\/([\p{L}\p{N}_-]+)(?:\s+([\s\S]*))?$/u);
  if (!match) return null;

  const cmdToken = normalizeLookupToken(match[1]);
  const args = (match[2] || '').trim();

  const allCommands = getAllSlashCommands(customCommands, lang);
  const found = allCommands.find(
    (c) =>
      normalizeLookupToken(c.name) === cmdToken ||
      (c.aliases || []).some((a) => normalizeLookupToken(a) === cmdToken)
  );
  if (!found) return null;

  if (found.kind === 'connector') {
    return {
      command: found,
      args,
      displayContent: trimmed,
    };
  }

  if (found.kind === 'custom' || found.kind === 'prompt') {
    const expandedPrompt = expandPromptTemplate(found.prompt || '', args);
    return {
      command: found,
      args,
      displayContent: trimmed,
      expandedPrompt,
    };
  }

  if (found.kind === 'image') {
    return {
      command: found,
      args,
      displayContent: trimmed,
    };
  }

  if (found.kind === 'action') {
    let overrideDepth: 'fast' | 'mid' | 'deep' | undefined;
    if (found.actionType === 'depth_fast') overrideDepth = 'fast';
    if (found.actionType === 'depth_mid') overrideDepth = 'mid';
    if (found.actionType === 'depth_deep') overrideDepth = 'deep';

    return {
      command: found,
      args,
      displayContent: args || trimmed,
      overrideDepth,
    };
  }

  return null;
}

export interface StarterCommandTemplate {
  name: string;
  description: string;
  prompt: string;
}

export function getStarterCommandTemplates(lang: Language): StarterCommandTemplate[] {
  if (lang === 'tr') {
    return [
      {
        name: 'email',
        description: 'Kısa ve nazik bir e-posta yanıtı taslağı hazırla',
        prompt: 'Şu notlara göre kısa, net ve samimi bir e-posta taslağı yaz:\n\n{input}',
      },
      {
        name: 'standup',
        description: 'Günlük kısa durum güncellemesi oluştur',
        prompt:
          'Aşağıdaki notları Dün / Bugün / Engeller şeklinde kısa bir ekip güncellemesine çevir:\n\n{input}',
      },
      {
        name: 'basit',
        description: 'Karmaşık bir konuyu sade bir dille anlat',
        prompt: 'Şu konuyu teknik jargona boğmadan, gündelik bir örnekle sade biçimde anlat:\n\n{input}',
      },
    ];
  }
  return [
    {
      name: 'email',
      description: 'Draft a short, warm email reply from quick notes',
      prompt: 'Write a concise, natural email reply based on these notes:\n\n{input}',
    },
    {
      name: 'standup',
      description: 'Format rough notes into a quick team update',
      prompt:
        'Turn these notes into a short Yesterday / Today / Blockers update for my team:\n\n{input}',
    },
    {
      name: 'eli5',
      description: 'Explain a dense concept plainly with an example',
      prompt: 'Explain this plainly in everyday language with one concrete example:\n\n{input}',
    },
  ];
}
