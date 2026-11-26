import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  SquarePen,
  Search,
  Pin,
  Trash2,
  Pencil,
  Check,
  X,
  Send,
  ArrowUp,
  Square,
  Paperclip,
  Globe,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronUp,
  Copy,
  Menu,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  FileText,
  ArrowUpRight,
  Image as ImageIcon,
  Settings,
  Terminal,
  User as UserIcon,
  Mic,
  AudioLines,
  Loader2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LIQUID_MORPH, LIQUID_SPRING, LIQUID_TAP } from '../lib/motion';
import {
  AttachedImage,
  ChatSession,
  ChatMessage,
  CustomSlashCommand,
  GeneratedImageData,
  deleteUserCommand,
  saveUserCommand,
  sendEmailVerification,
  subscribeToUserCommands,
  syncUserProfile,
} from '../lib/firebase';
import {
  BalancedDepthIcon,
  ConnectorsIcon,
  DeepDepthIcon,
  FastDepthIcon,
  GmailIcon,
  GoogleCalendarIcon,
  GoogleDocsIcon,
  GoogleDriveIcon,
  GoogleTasksIcon,
  LongclawLogo,
  ModelLogo,
  ReasoningIcon,
} from './Icons';
import { CodePreviewPanel } from './CodePreviewPanel';
import { GeneratedImageCard, cacheGeneratedImageDataUrl } from './GeneratedImageCard';
import {
  ConnectorsModal,
  GmailConfirmActionDialog,
  PendingGmailAction,
} from './ConnectorsModal';
import { FontPreference, SettingsModal, SettingsTab } from './SettingsModal';
import { VoiceChatOverlay } from './VoiceChatOverlay';
import {
  SlashCommandItem,
  filterSlashCommands,
  getAllSlashCommands,
  parseSlashCommandInput,
} from '../lib/commands';
import {
  apiUrl,
  getStaticHostNotice,
  isStaticHostErrorResponse,
  isStaticHostWithoutBackend,
} from '../lib/api';
import {
  buildGmailSearchQueryFromPrompt,
  createGmailDraft,
  extractGmailDraftBlocks,
  listGmailMessages,
  sendGmailMessage,
  shouldFetchGmailContext,
  stripGmailDraftBlocks,
} from '../lib/gmail';
import {
  ConnectorId,
  DEFAULT_CONNECTOR_TOGGLES,
  WorkspaceConnectorToggles,
  connectWorkspace,
  getCachedWorkspaceEmail,
  getGoogleDocText,
  getWorkspaceAccessToken,
  initWorkspaceSessionCleanup,
  listCalendarEvents,
  listDriveFiles,
  listGoogleDocs,
  listGoogleTasks,
  shouldFetchCalendarContext,
  shouldFetchDocsContext,
  shouldFetchDriveContext,
  shouldFetchTasksContext,
} from '../lib/workspace';
import {
  PendingWorkspaceMutation,
  runWorkspaceSlashCommand,
} from '../lib/workspaceCommandRunner';
import {
  extractCodeBlocks,
  getSiblingWebAssets,
  isPreviewableCode,
  normalizeCodeLanguage,
} from '../lib/codeRunner';
import { renderMarkdown } from '../lib/markdown';
import { useKeyboardShortcuts, formatModKey } from '../hooks/useKeyboardShortcuts';
import { useVoiceInput } from '../hooks/useVoiceInput';
import {
  FAMILY_MODELS,
  OTHER_MODELS,
  ChatModelId,
  DEFAULT_CHAT_MODEL,
  getChatModelOption,
  isValidChatModel,
} from '../lib/models';
import { Language, TRANSLATIONS } from '../lib/i18n';

interface ChatWorkspaceProps {
  user: User | null;
  chats: ChatSession[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onCreateChat: (initialDepth?: 'fast' | 'mid' | 'deep') => ChatSession;
  onDeleteChat: (id: string) => void;
  onTogglePinChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onUpdateChatMessages: (chatId: string, messages: ChatMessage[], newTitle?: string) => Promise<void>;
  onSignOut: () => void;
  onDeleteAccount: () => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  lang: Language;
  onChangeLang: (lang: Language) => void;
  fontPref: FontPreference;
  onChangeFontPref: (pref: FontPreference) => void;
  onBackToLanding: () => void;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
  mobileMenuOpen: boolean;
  onSetMobileMenuOpen: (open: boolean) => void;
  composerFocusTick: number;
  modalsOpen?: boolean;
}

export function ChatWorkspace({
  user,
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onCreateChat,
  onDeleteChat,
  onTogglePinChat,
  onRenameChat,
  onUpdateChatMessages,
  onSignOut,
  onDeleteAccount,
  theme,
  onToggleTheme,
  lang,
  onChangeLang,
  fontPref,
  onChangeFontPref,
  onBackToLanding,
  sidebarOpen,
  onOpenSidebar,
  onToggleSidebar,
  mobileMenuOpen,
  onSetMobileMenuOpen,
  composerFocusTick,
  modalsOpen = false,
}: ChatWorkspaceProps) {
  const t = TRANSLATIONS[lang];
  const cText = t.chat;
  const currentChat = currentChatId ? chats.find((c) => c.id === currentChatId) || null : null;
  const modKey = formatModKey();

  const isDefaultChatTitle = (title?: string | null) =>
    !title || title === 'Yeni sohbet' || title === 'New chat';
  const formatChatTitle = (title?: string | null) =>
    isDefaultChatTitle(title) ? t.common.newChat : title!;

  // Local chat settings
  const [depth, setDepth] = useState<'fast' | 'mid' | 'deep'>(currentChat?.depth || 'mid');
  const [selectedModel, setSelectedModel] = useState<ChatModelId>(() => {
    try {
      const saved = localStorage.getItem('lc_selected_model');
      if (saved === 'longclaw-clawing-1-low') {
        return 'longclaw-clawing-1.1-low';
      }
      if (saved === 'longclaw-clawing-1') {
        return 'longclaw-clawing-1.1';
      }
      return isValidChatModel(saved) ? saved : DEFAULT_CHAT_MODEL;
    } catch {
      return DEFAULT_CHAT_MODEL;
    }
  });
  const activeModel = getChatModelOption(selectedModel);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [otherModelsOpen, setOtherModelsOpen] = useState(() =>
    OTHER_MODELS.some((m) => m.id === selectedModel)
  );
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [deleteArm, setDeleteArm] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [emailVerifyStatus, setEmailVerifyStatus] = useState<string | null>(null);
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [userVersion, setUserVersion] = useState(0);
  const [codePreview, setCodePreview] = useState<{
    code: string;
    language: string;
    siblingCss?: string;
    siblingJs?: string;
  } | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Connectors (Google Workspace — 5 connectors) state; OAuth token lives strictly in memory
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [initialConnector, setInitialConnector] = useState<ConnectorId>('gmail');
  const [workspaceConnected, setWorkspaceConnected] = useState<boolean>(() =>
    Boolean(getWorkspaceAccessToken())
  );
  const [workspaceEmail, setWorkspaceEmail] = useState<string | null>(() =>
    getCachedWorkspaceEmail()
  );
  const [connectorToggles, setConnectorToggles] = useState<WorkspaceConnectorToggles>(
    DEFAULT_CONNECTOR_TOGGLES
  );
  const [checkingWorkspaceLabel, setCheckingWorkspaceLabel] = useState<string | null>(null);
  const [pendingChatGmailAction, setPendingChatGmailAction] = useState<PendingGmailAction | null>(
    null
  );
  const [submittingChatGmailAction, setSubmittingChatGmailAction] = useState(false);
  const [pendingWorkspaceMutation, setPendingWorkspaceMutation] = useState<{
    mutation: PendingWorkspaceMutation;
    chatId: string;
    assistantMsgId: string;
  } | null>(null);
  const [submittingWorkspaceMutation, setSubmittingWorkspaceMutation] = useState(false);
  const [workspaceToast, setWorkspaceToast] = useState<string | null>(null);

  // Image Generation & Image Attachment state
  const [imageMode, setImageMode] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<GeneratedImageData['aspectRatio']>('1:1');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [lightboxImageSrc, setLightboxImageSrc] = useState<string | null>(null);

  // Settings & Slash Commands state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('profile');
  const [sidebarAvatarFailed, setSidebarAvatarFailed] = useState(false);
  const [customCommands, setCustomCommands] = useState<CustomSlashCommand[]>([]);
  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // Input & streaming
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThoughts, setStreamingThoughts] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceErrorTimerRef = useRef<number | null>(null);
  const chatsRef = useRef(chats);
  const currentChatIdRef = useRef(currentChatId);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  const showVoiceError = (msg: string) => {
    setVoiceError(msg);
    if (voiceErrorTimerRef.current !== null) {
      window.clearTimeout(voiceErrorTimerRef.current);
    }
    voiceErrorTimerRef.current = window.setTimeout(() => {
      setVoiceError((curr) => (curr === msg ? null : curr));
      voiceErrorTimerRef.current = null;
    }, 6000);
  };

  useEffect(() => {
    return () => {
      if (voiceErrorTimerRef.current !== null) {
        window.clearTimeout(voiceErrorTimerRef.current);
      }
    };
  }, []);

  const voice = useVoiceInput({
    lang,
    onTranscript: (spokenText) => {
      setVoiceError(null);
      setSlashMenuDismissed(false);
      setInputMessage((prev) => {
        const trimmedPrev = prev.trimEnd();
        return trimmedPrev ? `${trimmedPrev} ${spokenText}` : spokenText;
      });
      window.requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
        const end = el.value.length;
        el.setSelectionRange(end, end);
      });
    },
    onError: showVoiceError,
  });

  const formatVoiceDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Derived slash command autocomplete list
  const slashQuery =
    !slashMenuDismissed && inputMessage.startsWith('/') && !/\s/.test(inputMessage)
      ? inputMessage.slice(1)
      : null;
  const allSlashCommands = getAllSlashCommands(customCommands, lang);
  const filteredSlashCommands =
    slashQuery !== null ? filterSlashCommands(allSlashCommands, slashQuery) : [];
  const slashMenuOpen = slashQuery !== null && filteredSlashCommands.length > 0;

  const enabledConnectorCount = workspaceConnected
    ? Object.values(connectorToggles).filter(Boolean).length
    : 0;

  const openConnectors = (tab: ConnectorId = 'gmail') => {
    setInitialConnector(tab);
    setConnectorsOpen(true);
  };

  const handleToggleConnector = (id: ConnectorId, enabled: boolean) => {
    setConnectorToggles((prev) => ({ ...prev, [id]: enabled }));
  };

  const isImageGenerationPrompt = (prompt: string): boolean => {
    const trimmed = prompt.trim();
    if (!trimmed) return false;
    // Skip if the user is clearly asking for source code
    if (/\b(html|css|react|tsx|jsx|python|javascript|typescript|svg\s+kodu|kod\s+yaz)\b/i.test(trimmed)) {
      return false;
    }
    return /(resim\s*(çiz|oluştur|yap|üret|hazırla)|görsel\s*(çiz|oluştur|yap|üret|hazırla)|resmini\s*(çiz|yap|oluştur)|illüstrasyon\s*(çiz|oluştur|yap)|çizim\s*(yap|oluştur)|bana\s+.*\s+(çiz|resmet)|\b(draw|paint|illustrate)\s+(me\s+)?(a|an|the)\b|\b(generate|create|make)\s+(me\s+)?(a|an)\s+(image|picture|artwork|illustration|poster|wallpaper)\b)/i.test(
      trimmed
    );
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingChatRef = useRef<{ id: string; messages: ChatMessage[] } | null>(null);
  const streamTargetTextRef = useRef<string>('');
  const streamDisplayedLenRef = useRef<number>(0);
  const streamDisplayedTextRef = useRef<string>('');
  const streamDoneRef = useRef<boolean>(false);
  const streamCancelledRef = useRef<boolean>(false);
  const streamRafRef = useRef<number | null>(null);
  const streamDrainResolveRef = useRef<(() => void) | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const stopTypewriterPacer = () => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    if (streamDrainResolveRef.current) {
      const resolve = streamDrainResolveRef.current;
      streamDrainResolveRef.current = null;
      resolve();
    }
  };

  const startTypewriterPacer = () => {
    if (streamRafRef.current !== null || streamCancelledRef.current) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      const full = streamTargetTextRef.current;
      streamDisplayedLenRef.current = full.length;
      streamDisplayedTextRef.current = full;
      setStreamingText(full);
      if (streamDoneRef.current && streamDrainResolveRef.current) {
        const resolve = streamDrainResolveRef.current;
        streamDrainResolveRef.current = null;
        resolve();
      }
      return;
    }

    let lastFrameTime = performance.now();
    let charBudget = 1; // reveal the very first character immediately on frame 1

    const tick = (now: number) => {
      if (streamCancelledRef.current) {
        streamRafRef.current = null;
        return;
      }

      const dt = Math.min(64, Math.max(4, now - lastFrameTime));
      lastFrameTime = now;

      const target = streamTargetTextRef.current;
      const shown = streamDisplayedLenRef.current;
      const remaining = target.length - shown;

      if (remaining > 0) {
        // ChatGPT-like smooth adaptive cadence: crisp 1-by-1 typing normally,
        // smoothly accelerating when a large burst arrives so it never lags behind.
        let charsPerSec: number;
        if (streamDoneRef.current) {
          charsPerSec = Math.min(540, Math.max(72, 54 + remaining * 1.2));
        } else if (remaining <= 36) {
          charsPerSec = 44 + remaining * 0.38;
        } else {
          charsPerSec = Math.min(420, 50 + remaining * 0.75);
        }

        charBudget += (charsPerSec * dt) / 1000;
        const step = Math.floor(charBudget);
        if (step >= 1) {
          charBudget -= step;
          let nextLen = Math.min(target.length, shown + step);
          // Avoid splitting UTF-16 surrogate pairs (emojis)
          if (nextLen < target.length) {
            const code = target.charCodeAt(nextLen - 1);
            if (code >= 0xd800 && code <= 0xdbff) {
              nextLen = Math.min(target.length, nextLen + 1);
            }
          }
          streamDisplayedLenRef.current = nextLen;
          const nextSlice = target.slice(0, nextLen);
          streamDisplayedTextRef.current = nextSlice;
          setStreamingText(nextSlice);
        }
      }

      if (streamDoneRef.current && streamDisplayedLenRef.current >= streamTargetTextRef.current.length) {
        streamRafRef.current = null;
        if (streamDrainResolveRef.current) {
          const resolve = streamDrainResolveRef.current;
          streamDrainResolveRef.current = null;
          resolve();
        }
        return;
      }

      if (!streamDoneRef.current && streamDisplayedLenRef.current >= streamTargetTextRef.current.length) {
        // Caught up to current buffer; pause RAF until the next chunk arrives
        streamRafRef.current = null;
        return;
      }

      streamRafRef.current = requestAnimationFrame(tick);
    };

    streamRafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      streamCancelledRef.current = true;
      stopTypewriterPacer();
    };
  }, []);

  // Persist selected model
  useEffect(() => {
    try {
      localStorage.setItem('lc_selected_model', selectedModel);
    } catch {}
  }, [selectedModel]);

  // Close model selector when clicking outside
  useEffect(() => {
    if (!modelMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [modelMenuOpen]);

  // Close profile menu when clicking outside
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [profileMenuOpen]);

  // Sync depth and reset active code preview when chat changes
  useEffect(() => {
    if (currentChat) {
      setDepth(currentChat.depth || 'mid');
    }
    setCodePreview(null);
    setPreviewExpanded(false);
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    if (voice.isRecording || voice.isTranscribing) {
      voice.cancelRecording();
    }
    setVoiceError(null);
  }, [currentChat?.id]);

  // Reset slash menu highlight when query changes
  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [slashQuery]);

  // Subscribe to custom slash commands (Firestore when authenticated, localStorage when guest)
  useEffect(() => {
    const LOCAL_KEY = 'lc_custom_commands';
    if (!user) {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setCustomCommands(parsed);
        } else {
          setCustomCommands([]);
        }
      } catch {
        setCustomCommands([]);
      }
      return;
    }

    const unsubscribe = subscribeToUserCommands(
      user.uid,
      (fetched) => {
        setCustomCommands(fetched);
      },
      (err) => {
        console.warn('Custom commands subscription notice:', err);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSaveCustomCommand = async (cmd: {
    id?: string;
    name: string;
    description: string;
    prompt: string;
  }) => {
    const isNew = !cmd.id;
    const cmdId = cmd.id || `cmd-${Date.now()}`;
    const entry: CustomSlashCommand = {
      id: cmdId,
      userId: user?.uid || 'guest',
      name: cmd.name,
      description: cmd.description,
      prompt: cmd.prompt,
    };

    if (user) {
      await saveUserCommand(
        user.uid,
        { id: cmdId, name: cmd.name, description: cmd.description, prompt: cmd.prompt },
        isNew
      );
    } else {
      setCustomCommands((prev) => {
        const next = isNew
          ? [...prev, entry]
          : prev.map((c) => (c.id === cmdId ? entry : c));
        next.sort((a, b) => a.name.localeCompare(b.name));
        try {
          localStorage.setItem('lc_custom_commands', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  };

  const handleDeleteCustomCommand = async (commandId: string) => {
    if (user) {
      await deleteUserCommand(user.uid, commandId);
    } else {
      setCustomCommands((prev) => {
        const next = prev.filter((c) => c.id !== commandId);
        try {
          localStorage.setItem('lc_custom_commands', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  };

  const openSettings = (tab: SettingsTab = 'profile') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
    setProfileMenuOpen(false);
  };

  const effectiveDisplayName = (() => {
    void userVersion;
    if (user?.displayName?.trim()) return user.displayName.trim();
    if (!user) {
      try {
        const guest = localStorage.getItem('lc_guest_name')?.trim();
        if (guest) return guest;
      } catch {}
    }
    return t.common.defaultUser;
  })();

  const sanitizeSafePhotoUrl = (raw: string): string => {
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
    } catch {
      return '';
    }
  };

  const effectivePhotoUrl = (() => {
    void userVersion;
    if (user?.photoURL?.trim()) return sanitizeSafePhotoUrl(user.photoURL.trim());
    if (!user) {
      try {
        const guestPhoto = localStorage.getItem('lc_guest_photo')?.trim();
        if (guestPhoto) return sanitizeSafePhotoUrl(guestPhoto);
      } catch {}
    }
    return '';
  })();

  const handleCommitVoiceExchange = (userText: string, assistantText: string) => {
    const existingId = currentChatIdRef.current;
    const existingChat = existingId
      ? chatsRef.current.find((c) => c.id === existingId) || null
      : null;
    const targetChat = existingChat || onCreateChat(depth);
    currentChatIdRef.current = targetChat.id;

    const now = Date.now();
    const userMsg: ChatMessage = {
      id: `m-v-u-${now}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: userText,
      createdAt: now,
    };
    const assistantMsg: ChatMessage = {
      id: `m-v-a-${now + 1}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant',
      content: assistantText,
      createdAt: now + 1,
    };

    const nextMessages = [...targetChat.messages, userMsg, assistantMsg];
    const shouldName =
      targetChat.messages.length === 0 || isDefaultChatTitle(targetChat.title);
    const quickTitle = shouldName
      ? userText.trim().slice(0, 48) + (userText.trim().length > 48 ? '…' : '')
      : undefined;

    chatsRef.current = chatsRef.current.some((c) => c.id === targetChat.id)
      ? chatsRef.current.map((c) =>
          c.id === targetChat.id
            ? { ...c, messages: nextMessages, ...(quickTitle ? { title: quickTitle } : {}) }
            : c
        )
      : [{ ...targetChat, messages: nextMessages, ...(quickTitle ? { title: quickTitle } : {}) }, ...chatsRef.current];

    void onUpdateChatMessages(targetChat.id, nextMessages, quickTitle);
  };

  useEffect(() => {
    setSidebarAvatarFailed(false);
  }, [effectivePhotoUrl]);

  const openCodePreview = (
    messageContent: string,
    code: string,
    rawLanguage: string,
    blockIndex: number
  ) => {
    const normalized = normalizeCodeLanguage(rawLanguage, code) || rawLanguage;
    const assets =
      normalized === 'html'
        ? getSiblingWebAssets(messageContent, blockIndex)
        : { siblingCss: undefined, siblingJs: undefined };
    setCodePreview({
      code,
      language: normalized,
      siblingCss: assets.siblingCss || undefined,
      siblingJs: assets.siblingJs || undefined,
    });
  };

  // Focus composer when a new chat is triggered via shortcut or button
  useEffect(() => {
    if (composerFocusTick > 0) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [composerFocusTick]);

  const focusSidebarSearch = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      onOpenSidebar();
    } else {
      onSetMobileMenuOpen(true);
    }
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  useKeyboardShortcuts([
    {
      key: 'f',
      mod: true,
      shift: true,
      alt: false,
      allowInInput: true,
      enabled: !modalsOpen,
      handler: focusSidebarSearch,
    },
    {
      key: '/',
      mod: false,
      shift: false,
      alt: false,
      allowInInput: false,
      enabled: !modalsOpen && !settingsOpen && !connectorsOpen,
      handler: () => {
        setSlashMenuDismissed(false);
        setInputMessage((prev) => (prev.trim() ? prev : '/'));
        setTimeout(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }, 10);
      },
    },
    {
      key: 'Escape',
      allowInInput: true,
      enabled:
        !modalsOpen &&
        Boolean(
          slashMenuOpen ||
            settingsOpen ||
            editingTitleId ||
            modelMenuOpen ||
            profileMenuOpen ||
            mobileMenuOpen ||
            codePreview ||
            connectorsOpen ||
            pendingChatGmailAction ||
            pendingWorkspaceMutation ||
            lightboxImageSrc ||
            voice.isRecording ||
            voice.isTranscribing
        ),
      handler: () => {
        if (voice.isRecording || voice.isTranscribing) {
          voice.cancelRecording();
        } else if (slashMenuOpen) {
          setSlashMenuDismissed(true);
        } else if (lightboxImageSrc) {
          setLightboxImageSrc(null);
        } else if (pendingWorkspaceMutation && !submittingWorkspaceMutation) {
          setPendingWorkspaceMutation(null);
        } else if (pendingChatGmailAction && !submittingChatGmailAction) {
          setPendingChatGmailAction(null);
        } else if (settingsOpen) {
          setSettingsOpen(false);
        } else if (connectorsOpen) {
          setConnectorsOpen(false);
        } else if (editingTitleId) {
          setEditingTitleId(null);
        } else if (modelMenuOpen) {
          setModelMenuOpen(false);
        } else if (profileMenuOpen) {
          setProfileMenuOpen(false);
        } else if (mobileMenuOpen) {
          onSetMobileMenuOpen(false);
        } else if (codePreview) {
          setCodePreview(null);
          setPreviewExpanded(false);
        }
      },
    },
  ]);

  // Clear in-memory Workspace session on Firebase sign-out
  useEffect(() => {
    return initWorkspaceSessionCleanup(() => {
      setWorkspaceConnected(false);
      setWorkspaceEmail(null);
    });
  }, []);

  const showWorkspaceToast = (message: string) => {
    setWorkspaceToast(message);
    setTimeout(() => {
      setWorkspaceToast((curr) => (curr === message ? null : curr));
    }, 3500);
  };

  const handleAttachContextToChat = (formattedSnippet: string) => {
    setInputMessage((prev) => `${formattedSnippet}\n\n${prev}`);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleConfirmChatGmailAction = async () => {
    if (!pendingChatGmailAction) return;
    setSubmittingChatGmailAction(true);
    try {
      if (pendingChatGmailAction.mode === 'send') {
        await sendGmailMessage(pendingChatGmailAction.payload);
        showWorkspaceToast(cText.connectors.sentSuccess);
      } else {
        await createGmailDraft(pendingChatGmailAction.payload);
        showWorkspaceToast(cText.connectors.draftSavedSuccess);
      }
      setPendingChatGmailAction(null);
    } catch (err: any) {
      if (
        err?.code === 'GMAIL_TOKEN_EXPIRED' ||
        err?.code === 'GMAIL_AUTH_REQUIRED' ||
        err?.code === 'WORKSPACE_TOKEN_EXPIRED' ||
        err?.code === 'WORKSPACE_AUTH_REQUIRED'
      ) {
        setWorkspaceConnected(false);
        setWorkspaceEmail(null);
        showWorkspaceToast(cText.connectors.sessionExpired);
      } else {
        showWorkspaceToast(err?.message || cText.connectors.connectFailed);
      }
      setPendingChatGmailAction(null);
    } finally {
      setSubmittingChatGmailAction(false);
    }
  };

  const handleConfirmWorkspaceMutation = async () => {
    if (!pendingWorkspaceMutation) return;
    const { mutation, chatId, assistantMsgId } = pendingWorkspaceMutation;
    setSubmittingWorkspaceMutation(true);
    try {
      const finalMarkdown = await mutation.execute();
      const targetChat = chats.find((c) => c.id === chatId);
      if (targetChat) {
        const updatedMsgs = (targetChat.messages || []).map((m) =>
          m.id === assistantMsgId ? { ...m, content: finalMarkdown } : m
        );
        void onUpdateChatMessages(chatId, updatedMsgs);
      }
      showWorkspaceToast(lang === 'tr' ? 'İşlem tamamlandı.' : 'Action completed.');
      setPendingWorkspaceMutation(null);
    } catch (err: any) {
      if (
        err?.code === 'WORKSPACE_TOKEN_EXPIRED' ||
        err?.code === 'WORKSPACE_AUTH_REQUIRED' ||
        err?.code === 'WORKSPACE_REAUTH_REQUIRED' ||
        err?.code === 'GMAIL_TOKEN_EXPIRED' ||
        err?.code === 'GMAIL_AUTH_REQUIRED'
      ) {
        setWorkspaceConnected(false);
        setWorkspaceEmail(null);
        showWorkspaceToast(
          lang === 'tr'
            ? 'Güncel Google Workspace izinleri için tekrar bağlan.'
            : 'Please reconnect Google Workspace to refresh permissions.'
        );
        openConnectors(mutation.connector);
      } else {
        showWorkspaceToast(
          err?.message || (lang === 'tr' ? 'İşlem tamamlanamadı.' : 'Could not complete action.')
        );
      }
      setPendingWorkspaceMutation(null);
    } finally {
      setSubmittingWorkspaceMutation(false);
    }
  };

  // Smart auto-scroll: follow new messages/streaming only when user is already near the bottom
  const handleMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    isNearBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom && (currentChat?.messages?.length || 0) > 0);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!isNearBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: streamingText ? 'auto' : 'smooth',
    });
  }, [currentChat?.messages?.length, streamingText]);

  // Adjust textarea height dynamically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setInputMessage(nextVal);
    if (slashMenuDismissed) setSlashMenuDismissed(false);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const handleSelectSlashCommand = (cmd: SlashCommandItem, runIfImmediate = true) => {
    if (cmd.kind === 'action' && runIfImmediate) {
      setInputMessage('');
      setSlashMenuDismissed(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      if (cmd.actionType === 'new') {
        onNewChat();
        return;
      }
      if (cmd.actionType === 'connectors') {
        openConnectors('gmail');
        return;
      }
      if (cmd.actionType === 'settings') {
        openSettings('commands');
        return;
      }
      if (cmd.actionType === 'depth_fast') {
        setDepth('fast');
        showWorkspaceToast(lang === 'tr' ? 'Derinlik: Hızlı' : 'Depth: Fast');
        textareaRef.current?.focus();
        return;
      }
      if (cmd.actionType === 'depth_mid') {
        setDepth('mid');
        showWorkspaceToast(lang === 'tr' ? 'Derinlik: Dengeli' : 'Depth: Balanced');
        textareaRef.current?.focus();
        return;
      }
      if (cmd.actionType === 'depth_deep') {
        setDepth('deep');
        showWorkspaceToast(lang === 'tr' ? 'Derinlik: Derin' : 'Depth: Deep');
        textareaRef.current?.focus();
        return;
      }
    }

    const filled = `/${cmd.name} `;
    setInputMessage(filled);
    setSlashMenuDismissed(false);
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(filled.length, filled.length);
      }
    }, 10);
  };

  const handleStopStreaming = () => {
    streamCancelledRef.current = true;
    stopTypewriterPacer();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setGeneratingImage(false);
    setCheckingWorkspaceLabel(null);

    const activeStreamTarget = streamingChatRef.current;
    streamingChatRef.current = null;

    const visiblePartialText = streamDisplayedTextRef.current || streamingText;
    if (visiblePartialText && (activeStreamTarget || currentChat)) {
      const targetId = activeStreamTarget?.id || currentChat!.id;
      const baseMessages = activeStreamTarget?.messages || currentChat?.messages || [];
      const updatedMessages = [
        ...baseMessages,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant' as const,
          content: visiblePartialText || cText.stoppedFallback,
          thoughts: streamingThoughts,
          stopped: true,
          modelId: selectedModel,
          createdAt: Date.now(),
        },
      ];
      void onUpdateChatMessages(targetId, updatedMessages);
    }
    streamTargetTextRef.current = '';
    streamDisplayedLenRef.current = 0;
    streamDisplayedTextRef.current = '';
    streamDoneRef.current = false;
    setStreamingText('');
    setStreamingThoughts('');
  };

  const handleSendMessage = async (
    textToSend?: string,
    overrideImages?: AttachedImage[]
  ) => {
    if (isStreaming || voice.isRecording || voice.isTranscribing) return;
    const rawText = (textToSend !== undefined ? textToSend : inputMessage).trim();
    const imagesToSend =
      overrideImages !== undefined ? overrideImages : textToSend !== undefined ? [] : attachedImages;

    if (!rawText && imagesToSend.length === 0) return;

    // Intercept slash commands (/command ...)
    const parsedCmd = rawText ? parseSlashCommandInput(rawText, customCommands, lang) : null;
    let effectiveDepth: 'fast' | 'mid' | 'deep' = depth;
    let displayText = rawText;
    let promptForApi = rawText;
    let imagePromptOverride: string | null = null;
    let connectorCommand: { connectorId: ConnectorId; instruction: string } | null = null;

    if (parsedCmd) {
      if (parsedCmd.command.kind === 'connector' && parsedCmd.command.connectorId) {
        connectorCommand = {
          connectorId: parsedCmd.command.connectorId,
          instruction: parsedCmd.args,
        };
        displayText = parsedCmd.displayContent;
      } else if (parsedCmd.command.kind === 'action') {
        const clearComposer = () => {
          setInputMessage('');
          setSlashMenuDismissed(false);
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
        };

        if (parsedCmd.command.actionType === 'new') {
          clearComposer();
          onNewChat();
          return;
        }
        if (parsedCmd.command.actionType === 'connectors') {
          clearComposer();
          openConnectors('gmail');
          return;
        }
        if (parsedCmd.command.actionType === 'settings') {
          clearComposer();
          openSettings('commands');
          return;
        }
        if (parsedCmd.overrideDepth) {
          effectiveDepth = parsedCmd.overrideDepth;
          setDepth(parsedCmd.overrideDepth);
          if (!parsedCmd.args && imagesToSend.length === 0) {
            clearComposer();
            const labelMap = {
              fast: lang === 'tr' ? 'Derinlik: Hızlı' : 'Depth: Fast',
              mid: lang === 'tr' ? 'Derinlik: Dengeli' : 'Depth: Balanced',
              deep: lang === 'tr' ? 'Derinlik: Derin' : 'Depth: Deep',
            };
            showWorkspaceToast(labelMap[parsedCmd.overrideDepth]);
            textareaRef.current?.focus();
            return;
          }
          displayText = parsedCmd.args;
          promptForApi = parsedCmd.args;
        }
      } else if (parsedCmd.command.kind === 'image') {
        if (!parsedCmd.args) {
          setInputMessage('');
          setSlashMenuDismissed(false);
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          setImageMode(true);
          textareaRef.current?.focus();
          return;
        }
        imagePromptOverride = parsedCmd.args;
        displayText = parsedCmd.displayContent;
        promptForApi = parsedCmd.args;
      } else if (parsedCmd.command.kind === 'prompt' || parsedCmd.command.kind === 'custom') {
        if (parsedCmd.command.expectsArgs && !parsedCmd.args && imagesToSend.length === 0) {
          setInputMessage(`/${parsedCmd.command.name} `);
          showWorkspaceToast(
            lang === 'tr'
              ? `/${parsedCmd.command.name} komutundan sonra metnini ekle.`
              : `Add your text after /${parsedCmd.command.name}.`
          );
          textareaRef.current?.focus();
          return;
        }
        displayText = parsedCmd.displayContent;
        promptForApi = parsedCmd.expandedPrompt || rawText;
      }
    }

    isNearBottomRef.current = true;
    setShowScrollToBottom(false);

    // If a direct Workspace connector command (/gmail, /calendar, /drive, /docs, /tasks) was invoked
    // and Workspace is not connected yet, initiate Google Workspace connection inside this user gesture.
    if (connectorCommand && !getWorkspaceAccessToken()) {
      try {
        const connected = await connectWorkspace();
        setWorkspaceConnected(true);
        setWorkspaceEmail(connected.emailAddress || null);
      } catch (connErr: any) {
        showWorkspaceToast(
          lang === 'tr'
            ? 'Bu komutu çalıştırmak için önce Google Workspace hesabını bağla.'
            : 'Connect Google Workspace first to run this command.'
        );
        openConnectors(connectorCommand.connectorId);
        return;
      }
    }

    // Never auto-route to image generation when running a connector command or analyzing images
    const wantsImage =
      !connectorCommand &&
      imagesToSend.length === 0 &&
      (imagePromptOverride !== null || imageMode || isImageGenerationPrompt(promptForApi));

    setInputMessage('');
    setSlashMenuDismissed(false);
    if (overrideImages === undefined && textToSend === undefined) {
      setAttachedImages([]);
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const targetChat = currentChat || onCreateChat(effectiveDepth);

    const newUserMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: displayText,
      ...(imagesToSend.length > 0 ? { images: imagesToSend } : {}),
      createdAt: Date.now(),
    };

    const currentList = targetChat.messages || [];
    const updatedWithUser = [...currentList, newUserMsg];
    streamingChatRef.current = { id: targetChat.id, messages: updatedWithUser };

    // Optimistically update without blocking the network request
    void onUpdateChatMessages(targetChat.id, updatedWithUser);

    // Prepare API call
    setIsStreaming(true);
    setStreamingText('');
    setStreamingThoughts('');
    setGeneratingImage(wantsImage);

    abortControllerRef.current = new AbortController();
    const startTime = Date.now();

    try {
      // Direct Google Workspace connector execution path (/gmail, /takvim, /drive, /döküman, /görev)
      if (connectorCommand) {
        const connectorNames: Record<ConnectorId, string> =
          lang === 'tr'
            ? {
                gmail: 'Gmail',
                calendar: 'Google Takvim',
                drive: 'Google Drive',
                docs: 'Google Dokümanlar',
                tasks: 'Google Görevler',
              }
            : {
                gmail: 'Gmail',
                calendar: 'Google Calendar',
                drive: 'Google Drive',
                docs: 'Google Docs',
                tasks: 'Google Tasks',
              };

        setCheckingWorkspaceLabel(
          lang === 'tr'
            ? `${connectorNames[connectorCommand.connectorId]} üzerinde işlem yapılıyor…`
            : `Working in ${connectorNames[connectorCommand.connectorId]}…`
        );

        try {
          const outcome = await runWorkspaceSlashCommand({
            connector: connectorCommand.connectorId,
            instruction: connectorCommand.instruction,
            lang,
            signal: abortControllerRef.current.signal,
          });
          setCheckingWorkspaceLabel(null);

          const finalDuration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          const assistantMsgId = `msg-${Date.now()}`;
          const content =
            outcome.status === 'done' ? outcome.markdown : outcome.previewMarkdown;

          const newAssistantMsg: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content,
            dur: finalDuration,
            modelId: selectedModel,
            createdAt: Date.now(),
          };

          const finalMessages = [...updatedWithUser, newAssistantMsg];
          void onUpdateChatMessages(targetChat.id, finalMessages);

          if (isDefaultChatTitle(targetChat.title) && updatedWithUser.length === 1) {
            const fallbackTitle =
              outcome.titleHint ||
              `${connectorNames[connectorCommand.connectorId]} · ${displayText.slice(0, 24)}`;
            void onUpdateChatMessages(targetChat.id, finalMessages, fallbackTitle);
          }

          if (outcome.status === 'confirm') {
            setPendingWorkspaceMutation({
              mutation: outcome.pending,
              chatId: targetChat.id,
              assistantMsgId,
            });
          }
          return;
        } catch (wsErr: any) {
          setCheckingWorkspaceLabel(null);
          if (
            wsErr?.code === 'WORKSPACE_REAUTH_REQUIRED' ||
            wsErr?.code === 'WORKSPACE_TOKEN_EXPIRED' ||
            wsErr?.code === 'WORKSPACE_AUTH_REQUIRED' ||
            wsErr?.code === 'GMAIL_TOKEN_EXPIRED' ||
            wsErr?.code === 'GMAIL_AUTH_REQUIRED'
          ) {
            setWorkspaceConnected(false);
            setWorkspaceEmail(null);
            const reauthMsg: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content:
                lang === 'tr'
                  ? `**${connectorNames[connectorCommand.connectorId]}** için güncel yazma izni gerekiyor. Bağlayıcılar penceresinden Google Workspace'i tekrar bağladıktan sonra komutu yeniden çalıştırabilirsin.`
                  : `Updated access permission is needed for **${connectorNames[connectorCommand.connectorId]}**. Reconnect Google Workspace in Connectors and run the command again.`,
              modelId: selectedModel,
              createdAt: Date.now(),
            };
            void onUpdateChatMessages(targetChat.id, [...updatedWithUser, reauthMsg]);
            openConnectors(connectorCommand.connectorId);
            return;
          }
          throw wsErr;
        }
      }

      // Background Gemini Image Generation path (free-tier Gemini, no extra/paid image API)
      if (wantsImage) {
        if (isStaticHostWithoutBackend()) {
          throw new Error(getStaticHostNotice(lang));
        }
        const effectiveImagePrompt = imagePromptOverride || promptForApi;
        const imgRes = await fetch(apiUrl('/api/generate-image'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            prompt: effectiveImagePrompt,
            aspectRatio: imageAspectRatio,
            lang,
          }),
        });

        if (isStaticHostErrorResponse(imgRes)) {
          throw new Error(getStaticHostNotice(lang));
        }

        const imgData = await imgRes.json().catch(() => ({}));
        if (!imgRes.ok || (!imgData?.imageUrl && !imgData?.svg)) {
          throw new Error(
            imgData?.error ||
              (lang === 'tr'
                ? 'Görsel oluşturulamadı, lütfen tekrar dene.'
                : 'Could not generate the image. Please try again.')
          );
        }

        if (imgData.imageUrl && imgData.imageDataUrl) {
          cacheGeneratedImageDataUrl(imgData.imageUrl, imgData.imageDataUrl);
        }

        // Persist compact inline dataUrl when small enough for Firestore (avoids rate limits on chat reload)
        const existingImageBytes = updatedWithUser.reduce(
          (sum, m) => sum + (m.generatedImage?.dataUrl?.length || 0),
          0
        );
        const persistDataUrl =
          typeof imgData.imageDataUrl === 'string' &&
          imgData.imageDataUrl.length < 220_000 &&
          existingImageBytes + imgData.imageDataUrl.length < 650_000
            ? imgData.imageDataUrl
            : undefined;

        const finalDuration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        const newAssistantMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content:
            imgData.caption ||
            (lang === 'tr' ? 'İstediğin görseli oluşturdum.' : 'Here is your generated image.'),
          generatedImage: {
            ...(imgData.imageUrl ? { url: imgData.imageUrl } : {}),
            ...(persistDataUrl ? { dataUrl: persistDataUrl } : {}),
            ...(imgData.svg ? { svg: imgData.svg } : {}),
            title: imgData.title || effectiveImagePrompt.slice(0, 48),
            prompt: effectiveImagePrompt,
            ...(imgData.enhancedPrompt ? { enhancedPrompt: imgData.enhancedPrompt } : {}),
            aspectRatio: imgData.aspectRatio || imageAspectRatio,
          },
          dur: finalDuration,
          modelId: selectedModel,
          createdAt: Date.now(),
        };

        const finalMessages = [...updatedWithUser, newAssistantMsg];
        void onUpdateChatMessages(targetChat.id, finalMessages);
        setImageMode(false);

        if (isDefaultChatTitle(targetChat.title) && updatedWithUser.length === 1) {
          const chatIdToTitle = targetChat.id;
          const fallbackTitle = String(imgData.title || effectiveImagePrompt).slice(0, 36);
          void onUpdateChatMessages(chatIdToTitle, finalMessages, fallbackTitle);
        }
        return;
      }

      // Multi-connector Google Workspace context fetching (only when connected & relevant)
      let gmailContext: Array<{
        from: string;
        subject: string;
        date: string;
        snippet: string;
        body: string;
        unread: boolean;
      }> = [];
      const workspaceContext: {
        calendar: Array<{
          summary: string;
          start: string;
          end: string;
          location: string;
          description: string;
        }>;
        drive: Array<{ name: string; mimeType: string; modifiedTime: string }>;
        docs: Array<{ name: string; modifiedTime: string; excerpt: string }>;
        tasks: Array<{ title: string; notes: string; due: string; status: string }>;
      } = {
        calendar: [],
        drive: [],
        docs: [],
        tasks: [],
      };

      if (workspaceConnected) {
        const needGmail = connectorToggles.gmail && shouldFetchGmailContext(promptForApi);
        const needCalendar = connectorToggles.calendar && shouldFetchCalendarContext(promptForApi);
        const needDrive = connectorToggles.drive && shouldFetchDriveContext(promptForApi);
        const needDocs = connectorToggles.docs && shouldFetchDocsContext(promptForApi);
        const needTasks = connectorToggles.tasks && shouldFetchTasksContext(promptForApi);

        const activeLabels: string[] = [];
        if (needGmail) activeLabels.push('Gmail');
        if (needCalendar) activeLabels.push(lang === 'tr' ? 'Takvim' : 'Calendar');
        if (needDrive) activeLabels.push('Drive');
        if (needDocs) activeLabels.push(lang === 'tr' ? 'Dokümanlar' : 'Docs');
        if (needTasks) activeLabels.push(lang === 'tr' ? 'Görevler' : 'Tasks');

        if (activeLabels.length > 0) {
          setCheckingWorkspaceLabel(
            lang === 'tr'
              ? `${activeLabels.join(', ')} verileri okunuyor…`
              : `Reading ${activeLabels.join(', ')}…`
          );

          let sessionExpired = false;
          const handleErr = (err: any) => {
            if (
              err?.code === 'GMAIL_TOKEN_EXPIRED' ||
              err?.code === 'GMAIL_AUTH_REQUIRED' ||
              err?.code === 'WORKSPACE_TOKEN_EXPIRED' ||
              err?.code === 'WORKSPACE_AUTH_REQUIRED'
            ) {
              sessionExpired = true;
            }
          };

          await Promise.all([
            needGmail
              ? (async () => {
                  try {
                    const query = buildGmailSearchQueryFromPrompt(promptForApi);
                    const fetched = await listGmailMessages({ query, maxResults: 8 });
                    gmailContext = fetched.map((m) => ({
                      from: m.from,
                      subject: m.subject,
                      date: m.date,
                      snippet: m.snippet,
                      body: m.body.slice(0, 1200),
                      unread: m.unread,
                    }));
                  } catch (err) {
                    handleErr(err);
                  }
                })()
              : Promise.resolve(),
            needCalendar
              ? (async () => {
                  try {
                    const events = await listCalendarEvents(10);
                    workspaceContext.calendar = events.map((ev) => ({
                      summary: ev.summary,
                      start: ev.start,
                      end: ev.end,
                      location: ev.location,
                      description: ev.description.slice(0, 300),
                    }));
                  } catch (err) {
                    handleErr(err);
                  }
                })()
              : Promise.resolve(),
            needDrive
              ? (async () => {
                  try {
                    const files = await listDriveFiles({ maxResults: 12 });
                    workspaceContext.drive = files.map((f) => ({
                      name: f.name,
                      mimeType: f.mimeType,
                      modifiedTime: f.modifiedTime,
                    }));
                  } catch (err) {
                    handleErr(err);
                  }
                })()
              : Promise.resolve(),
            needDocs
              ? (async () => {
                  try {
                    const docs = await listGoogleDocs({ maxResults: 6 });
                    const withExcerpts = await Promise.all(
                      docs.map(async (d, idx) => {
                        let excerpt = '';
                        if (idx < 2) {
                          try {
                            excerpt = (await getGoogleDocText(d.id)).slice(0, 1200);
                          } catch {}
                        }
                        return {
                          name: d.name,
                          modifiedTime: d.modifiedTime,
                          excerpt,
                        };
                      })
                    );
                    workspaceContext.docs = withExcerpts;
                  } catch (err) {
                    handleErr(err);
                  }
                })()
              : Promise.resolve(),
            needTasks
              ? (async () => {
                  try {
                    const tasks = await listGoogleTasks(15);
                    workspaceContext.tasks = tasks.map((tk) => ({
                      title: tk.title,
                      notes: tk.notes.slice(0, 200),
                      due: tk.due,
                      status: tk.status,
                    }));
                  } catch (err) {
                    handleErr(err);
                  }
                })()
              : Promise.resolve(),
          ]);

          setCheckingWorkspaceLabel(null);
          if (sessionExpired) {
            setWorkspaceConnected(false);
            setWorkspaceEmail(null);
            showWorkspaceToast(cText.connectors.sessionExpired);
          }
        }
      }

      // Include image payloads for the latest 4 messages that contain images so follow-up vision questions work cleanly
      const imageMsgIndices = new Set<number>();
      for (let i = updatedWithUser.length - 1; i >= 0 && imageMsgIndices.size < 4; i--) {
        if (updatedWithUser[i].images && updatedWithUser[i].images!.length > 0) {
          imageMsgIndices.add(i);
        }
      }

      if (isStaticHostWithoutBackend()) {
        throw new Error(getStaticHostNotice(lang));
      }

      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: updatedWithUser.map((m, idx) => ({
            role: m.role,
            content: m.id === newUserMsg.id ? promptForApi : m.content,
            ...(imageMsgIndices.has(idx) && m.images?.length
              ? {
                  images: m.images.map((img) => ({
                    mimeType: img.mimeType,
                    dataUrl: img.dataUrl,
                    name: img.name,
                  })),
                }
              : {}),
          })),
          depth: effectiveDepth,
          mode: 'chat',
          model: selectedModel,
          lang,
          gmailConnected: workspaceConnected && connectorToggles.gmail,
          gmailContext,
          workspaceContext,
        }),
      });

      if (!response.ok) {
        if (isStaticHostErrorResponse(response)) {
          throw new Error(getStaticHostNotice(lang));
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(cText.readBodyError);

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let accumulatedThoughts = '';

      stopTypewriterPacer();
      streamTargetTextRef.current = '';
      streamDisplayedLenRef.current = 0;
      streamDisplayedTextRef.current = '';
      streamDoneRef.current = false;
      streamCancelledRef.current = false;

      const processNdjsonLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line) return;
        try {
          const event = JSON.parse(line);
          if (event.t === 'tx') {
            accumulatedText += event.x;
            streamTargetTextRef.current = accumulatedText;
            startTypewriterPacer();
          } else if (event.t === 'th') {
            accumulatedThoughts += event.x;
            setStreamingThoughts(accumulatedThoughts);
          } else if (event.t === 'err') {
            throw new Error(event.x || cText.streamError);
          }
        } catch (parseErr: any) {
          if (!(parseErr instanceof SyntaxError)) {
            throw parseErr;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.trim()) {
            processNdjsonLine(buffer);
            buffer = '';
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;

        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          processNdjsonLine(line);
        }
      }

      // Let the smooth character-by-character typewriter finish draining the tail cleanly
      streamDoneRef.current = true;
      if (
        !streamCancelledRef.current &&
        streamDisplayedLenRef.current < streamTargetTextRef.current.length
      ) {
        if (typeof document !== 'undefined' && document.hidden) {
          streamDisplayedLenRef.current = streamTargetTextRef.current.length;
          streamDisplayedTextRef.current = streamTargetTextRef.current;
          setStreamingText(streamTargetTextRef.current);
        } else {
          await new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              window.clearTimeout(safetyTimer);
              streamDrainResolveRef.current = null;
              resolve();
            };
            const safetyTimer = window.setTimeout(() => {
              if (!streamCancelledRef.current) {
                streamDisplayedLenRef.current = streamTargetTextRef.current.length;
                streamDisplayedTextRef.current = streamTargetTextRef.current;
                setStreamingText(streamTargetTextRef.current);
              }
              finish();
            }, 2800);
            streamDrainResolveRef.current = finish;
            startTypewriterPacer();
          });
        }
      }

      if (streamCancelledRef.current) return;

      const finalDuration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const newAssistantMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: accumulatedText || cText.noResponseFallback,
        thoughts: accumulatedThoughts,
        dur: finalDuration,
        modelId: selectedModel,
        createdAt: Date.now(),
      };

      const finalMessages = [...updatedWithUser, newAssistantMsg];
      void onUpdateChatMessages(targetChat.id, finalMessages);

      // Auto-title in the background so the chat completes immediately without waiting for a second API round-trip
      if (isDefaultChatTitle(targetChat.title) && updatedWithUser.length === 1) {
        const chatIdToTitle = targetChat.id;
        void (async () => {
          let newTitle = displayText.slice(0, 30);
          try {
            const titleRes = await fetch(apiUrl('/api/name-chat'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userMessage: displayText,
                assistantMessage: accumulatedText,
                lang,
              }),
            });
            if (titleRes.ok) {
              const titleData = await titleRes.json();
              if (titleData.title) {
                newTitle = titleData.title;
              }
            }
          } catch {}
          if (newTitle) {
            await onRenameChat(chatIdToTitle, newTitle);
          }
        })();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: cText.chatErrorMessage(err.message || cText.connectionError),
        createdAt: Date.now(),
      };
      await onUpdateChatMessages(targetChat.id, [...updatedWithUser, errorMsg]);
    } finally {
      stopTypewriterPacer();
      streamTargetTextRef.current = '';
      streamDisplayedLenRef.current = 0;
      streamDisplayedTextRef.current = '';
      streamDoneRef.current = false;
      setIsStreaming(false);
      setGeneratingImage(false);
      setCheckingWorkspaceLabel(null);
      setStreamingText('');
      setStreamingThoughts('');
      abortControllerRef.current = null;
      streamingChatRef.current = null;
    }
  };

  const handleRegenerate = async () => {
    if (isStreaming || !currentChat?.messages?.length) return;
    const msgs = [...currentChat.messages];
    if (msgs[msgs.length - 1].role === 'assistant') {
      msgs.pop();
    }
    const lastUser = msgs[msgs.length - 1];
    if (lastUser && lastUser.role === 'user') {
      await onUpdateChatMessages(currentChat.id, msgs);
      handleSendMessage(lastUser.content, lastUser.images || []);
    }
  };

  const optimizeImageFile = (file: File): Promise<AttachedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.onload = () => {
        const originalDataUrl = String(reader.result || '');
        if (!originalDataUrl.startsWith('data:image/')) {
          reject(new Error('Unsupported image format'));
          return;
        }

        const img = new Image();
        img.onerror = () => {
          // Fallback to original dataUrl if browser cannot draw into canvas (e.g. certain GIFs)
          if (originalDataUrl.length < 350_000) {
            resolve({
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name || 'image',
              mimeType: file.type || 'image/jpeg',
              dataUrl: originalDataUrl,
            });
          } else {
            reject(new Error('Could not process image'));
          }
        };
        img.onload = () => {
          const MAX_SIDE = 1280;
          let { width, height } = img;
          if (width > MAX_SIDE || height > MAX_SIDE) {
            const scale = MAX_SIDE / Math.max(width, height);
            width = Math.max(1, Math.round(width * scale));
            height = Math.max(1, Math.round(height * scale));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          const isPngWithTransparency = file.type === 'image/png' && file.size < 250_000;
          const targetMime = isPngWithTransparency ? 'image/png' : 'image/jpeg';
          let dataUrl = canvas.toDataURL(targetMime, 0.84);

          // If still large, compress gently to stay crisp and lightweight for chat + Firestore
          if (dataUrl.length > 260_000) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          }

          resolve({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name || 'image.jpg',
            mimeType: dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
            dataUrl,
          });
        };
        img.src = originalDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const processIncomingFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;

    const imageFiles = list.filter((f) => f.type.startsWith('image/'));
    const textFiles = list.filter((f) => !f.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      const remainingSlots = Math.max(0, 4 - attachedImages.length);
      if (remainingSlots === 0) {
        showWorkspaceToast(
          lang === 'tr' ? 'En fazla 4 görsel ekleyebilirsin.' : 'You can attach up to 4 images.'
        );
      } else {
        const toProcess = imageFiles.slice(0, remainingSlots);
        const processed: AttachedImage[] = [];
        for (const f of toProcess) {
          try {
            const optimized = await optimizeImageFile(f);
            processed.push(optimized);
          } catch {
            showWorkspaceToast(
              lang === 'tr'
                ? `"${f.name}" görseli eklenemedi.`
                : `Could not attach image "${f.name}".`
            );
          }
        }
        if (processed.length > 0) {
          setAttachedImages((prev) => [...prev, ...processed].slice(0, 4));
          setImageMode(false);
          textareaRef.current?.focus();
        }
      }
    }

    for (const file of textFiles) {
      const reader = new FileReader();
      reader.onload = () => {
        const fileContent = String(reader.result || '').slice(0, 30000);
        const snippet = `[${cText.fileLabel}: ${file.name}]\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
        setInputMessage((prev) => snippet + prev);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processIncomingFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedImages: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) pastedImages.push(file);
      }
    }
    if (pastedImages.length > 0) {
      e.preventDefault();
      void processIncomingFiles(pastedImages);
    }
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 1600);
    } catch {
      // Clipboard API may be blocked in restricted iframe contexts
    }
  };

  // Filtered chats list
  const filteredChats = chats
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = c.title?.toLowerCase().includes(q);
      const matchContent = c.messages?.some((m) => m.content.toLowerCase().includes(q));
      return matchTitle || matchContent;
    })
    .sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));

  return (
    <div className="canvas-tactile flex h-[100dvh] w-full overflow-hidden bg-[var(--bg)] text-[var(--tx)]">
      {/* Sidebar Overlay on mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] md:hidden"
          onClick={() => onSetMobileMenuOpen(false)}
        />
      )}

      {/* Architectural Sidebar */}
      <aside
        className={`sidebar-3d fixed md:static inset-y-0 left-0 z-40 h-full shrink-0 overflow-hidden border-[var(--bd)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] w-[82vw] max-w-[300px] md:w-[276px] border-r ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 ${
          sidebarOpen
            ? 'md:w-[276px] md:border-r md:opacity-100'
            : 'md:w-0 md:border-r-0 md:opacity-0 md:pointer-events-none'
        }`}
      >
        <div className="w-[82vw] max-w-[300px] md:w-[276px] h-full flex flex-col px-3.5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] gap-3.5">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-1 py-1">
            <button
              onClick={onBackToLanding}
              className="flex items-center gap-2 font-space font-semibold text-base tracking-tight text-[var(--tx)] hover:opacity-80 transition-opacity cursor-pointer"
              title={cText.backToLandingTitle}
            >
              <LongclawLogo className="w-6 h-6 text-[var(--tx)]" />
              <span>Longclaw</span>
            </button>

            <button
              onClick={() => onSetMobileMenuOpen(false)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--card)] transition-colors cursor-pointer"
              aria-label={cText.closeMenuAria}
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Primary Action & Utility Stack */}
          <div className="space-y-2 shrink-0">
            <button
              onClick={() => {
                onNewChat();
                onSetMobileMenuOpen(false);
              }}
              title={`${cText.newChatTitle} (${modKey}+K)`}
              className="btn-3d-primary w-full flex items-center justify-between py-2.5 px-3.5 rounded-full font-medium text-sm md:text-[13px] cursor-pointer whitespace-nowrap"
            >
              <span className="flex items-center gap-2">
                <SquarePen className="w-4 h-4 shrink-0" />
                <span>{cText.newChatTitle}</span>
              </span>
              <span className="hidden sm:inline text-[10px] font-mono opacity-75">
                {modKey}+K
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                openConnectors('gmail');
                onSetMobileMenuOpen(false);
              }}
              className="btn-3d-soft w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] md:text-xs font-medium cursor-pointer"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                {workspaceConnected ? (
                  <div className="flex items-center -space-x-1 shrink-0">
                    <GmailIcon className="w-3.5 h-3.5" />
                    <GoogleCalendarIcon className="w-3.5 h-3.5" />
                    <GoogleDriveIcon className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <ConnectorsIcon className="w-4 h-4 text-[var(--ac)] shrink-0" />
                )}
                <span className="truncate">{cText.connectors.title}</span>
              </span>
              <span
                className={`text-[11px] shrink-0 tabular-nums font-mono ${
                  workspaceConnected
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-[var(--mut)]'
                }`}
              >
                {workspaceConnected ? `${enabledConnectorCount}/5` : '5'}
              </span>
            </button>

            {/* Machined Recessed 3D Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--mut)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={cText.searchPlaceholder}
                title={cText.searchTitle}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="well-3d w-full rounded-lg pl-8.5 pr-7 py-2 md:py-1.5 text-base md:text-xs text-[var(--tx)] placeholder:text-[var(--mut)] outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Chats List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {filteredChats.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--mut)]">
                {searchQuery ? cText.noResults : cText.noChatsYet}
              </div>
            ) : (
              filteredChats.map((c) => {
                const isActive = c.id === currentChat?.id;
                const isEditing = editingTitleId === c.id;

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectChat(c.id);
                      onSetMobileMenuOpen(false);
                    }}
                  className={`group relative flex items-center gap-2 px-3 py-2.5 md:py-2 min-h-[42px] md:min-h-0 rounded-lg text-[13.5px] md:text-[13px] font-medium cursor-pointer transition-all border ${
                    isActive
                      ? 'surface-3d text-[var(--tx)] font-semibold'
                      : 'border-transparent text-[var(--mut)] hover:bg-[var(--card)]/55 hover:text-[var(--tx)]'
                  }`}
                >
                  {isEditing ? (
                    <div
                      className="flex items-center gap-1.5 w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editTitleInput}
                        onChange={(e) => setEditTitleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onRenameChat(c.id, editTitleInput);
                            setEditingTitleId(null);
                          } else if (e.key === 'Escape') {
                            setEditingTitleId(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 bg-[var(--bg)] border border-[var(--bd)] px-2 py-1 rounded text-base md:text-xs text-[var(--tx)] outline-none"
                      />
                      <button
                        onClick={() => {
                          onRenameChat(c.id, editTitleInput);
                          setEditingTitleId(null);
                        }}
                        className="p-1.5 hover:text-emerald-500"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingTitleId(null)}
                        className="p-1.5 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{formatChatTitle(c.title)}</span>

                      <div
                        className={`flex items-center gap-0.5 transition-opacity ${
                          isActive
                            ? 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinChat(c.id);
                          }}
                          className={`p-2 md:p-1 rounded-lg hover:bg-[var(--surf)] ${
                            c.pin ? 'opacity-100 text-[var(--tx)]' : 'text-[var(--mut)]'
                          }`}
                          title={c.pin ? cText.unpinTitle : cText.pinTitle}
                        >
                          <Pin className="w-3.5 h-3.5 md:w-3 md:h-3" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitleId(c.id);
                            setEditTitleInput(formatChatTitle(c.title));
                          }}
                          className="p-2 md:p-1 rounded-lg text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)]"
                          title={cText.renameTitle}
                        >
                          <Pencil className="w-3.5 h-3.5 md:w-3 md:h-3" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChat(c.id);
                          }}
                          className="p-2 md:p-1 rounded-lg text-[var(--mut)] hover:text-red-500 hover:bg-[var(--surf)]"
                          title={cText.deleteTitle}
                        >
                          <Trash2 className="w-3.5 h-3.5 md:w-3 md:h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* User Profile Footer */}
        <div ref={profileMenuRef} className="relative pt-2 border-t border-[var(--bd)]">
          <AnimatePresence>
            {profileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="surface-3d-elevated absolute bottom-14 left-0 right-0 rounded-2xl p-2 space-y-1 text-xs z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-[var(--bd)] space-y-1">
                  <p className="font-medium text-[var(--tx)] truncate">
                    {effectiveDisplayName}
                  </p>
                  <p className="text-[11px] text-[var(--mut)] truncate">
                    {user?.email || ''}
                  </p>
                  {user?.email && (
                    <div className="pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                          user.emailVerified ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {user.emailVerified ? cText.emailVerified : cText.emailUnverified}
                      </span>
                    </div>
                  )}
                </div>

              <button
                onClick={() => openSettings('profile')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[var(--surf)] text-[var(--tx)] cursor-pointer"
              >
                <UserIcon className="w-4 h-4" />
                <span>{lang === 'tr' ? 'Profil & logo' : 'Profile & logo'}</span>
              </button>

              <button
                onClick={() => openSettings('commands')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[var(--surf)] text-[var(--tx)] cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>{lang === 'tr' ? 'Ayarlar ve komutlar' : 'Settings & commands'}</span>
              </button>

              <button
                onClick={() => {
                  onToggleTheme();
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[var(--surf)] text-[var(--tx)] cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? cText.switchToLight : cText.switchToDark}</span>
              </button>

              <button
                onClick={() => {
                  onChangeLang(lang === 'tr' ? 'en' : 'tr');
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[var(--surf)] text-[var(--tx)] cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>{cText.switchLanguageLabel}</span>
              </button>

              <button
                onClick={() => {
                  onSignOut();
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[var(--surf)] text-[var(--tx)] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{cText.signOut}</span>
              </button>

              <button
                onClick={async () => {
                  if (!deleteArm) {
                    setDeleteArm(true);
                    setTimeout(() => setDeleteArm(false), 4000);
                    return;
                  }
                  await onDeleteAccount();
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-red-500/10 text-red-500 font-medium cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteArm ? cText.deleteAccountConfirm : cText.deleteAccount}</span>
              </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex-1 min-w-0 flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--card)] text-left transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[var(--ac)] text-[var(--on)] flex items-center justify-center font-display font-bold text-xs shrink-0 overflow-hidden">
                {effectivePhotoUrl && !sidebarAvatarFailed ? (
                  <img
                    src={effectivePhotoUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setSidebarAvatarFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (effectiveDisplayName || user?.email || 'U')[0].toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--tx)] truncate">
                  {effectiveDisplayName}
                </p>
                <p className="text-[10px] text-[var(--mut)] truncate">
                  {user?.email || 'Firebase Auth'}
                </p>
              </div>
              <ChevronUp className={`w-3.5 h-3.5 text-[var(--mut)] shrink-0 transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => openSettings('profile')}
              title={lang === 'tr' ? 'Ayarlar ve profil' : 'Settings & profile'}
              aria-label={lang === 'tr' ? 'Ayarlar' : 'Settings'}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--card)] transition-colors cursor-pointer shrink-0"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>
      </aside>

      {/* Main Chat Canvas */}
      <main className="ambient-chat-canvas flex-1 flex flex-col min-w-0 h-full relative">
        {/* Calm Minimal Top Bar */}
        <header className="relative z-10 min-h-14 pt-[env(safe-area-inset-top)] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 bg-[var(--bg)]/72 backdrop-blur-xl border-b border-[var(--bd)]/65 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => onSetMobileMenuOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer shrink-0"
              aria-label={cText.openSidebarAria}
              title={`${cText.sidebarLabel} (${modKey}+B)`}
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={onToggleSidebar}
              className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-full text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer shrink-0"
              aria-label={sidebarOpen ? cText.hideSidebar : cText.showSidebar}
              title={`${sidebarOpen ? cText.hideSidebar : cText.showSidebar} (${modKey}+B)`}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>

            <h2 className="font-soft text-[15px] font-semibold tracking-tight truncate min-w-0">
              {formatChatTitle(currentChat?.title)}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Calm Pill Segmented Reasoning Depth Switch */}
            <div className="segmented-track-3d flex items-center gap-0.5 p-1 rounded-full text-xs">
              {(
                [
                  { id: 'fast', label: cText.depthFast, title: cText.depthFastTitle, Icon: FastDepthIcon },
                  { id: 'mid', label: cText.depthMid, title: cText.depthMidTitle, Icon: BalancedDepthIcon },
                  { id: 'deep', label: cText.depthDeep, title: cText.depthDeepTitle, Icon: DeepDepthIcon },
                ] as const
              ).map(({ id, label, title, Icon }) => {
                const active = depth === id;
                return (
                  <motion.button
                    key={id}
                    whileTap={{ scale: 0.94 }}
                    transition={LIQUID_TAP}
                    onClick={() => setDepth(id)}
                    className={`relative flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'text-[var(--tx)] font-semibold'
                        : 'text-[var(--mut)] hover:text-[var(--tx)]'
                    }`}
                    title={title}
                    aria-label={label}
                  >
                    {active && (
                      <motion.span
                        layoutId="workspace-depth-pill"
                        transition={LIQUID_MORPH}
                        className="segmented-thumb-3d absolute inset-0 rounded-full"
                        aria-hidden="true"
                      />
                    )}
                    <Icon className="relative z-10 w-3.5 h-3.5" />
                    <span className="relative z-10 hidden sm:inline">{label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Email Verification Banner (when user has an unverified email) */}
        {user && user.email && !user.emailVerified && userVersion >= 0 && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {emailVerifyStatus || cText.emailUnverifiedBanner(user.email)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={checkingVerify}
                onClick={async () => {
                  try {
                    setCheckingVerify(true);
                    await sendEmailVerification(user);
                    setEmailVerifyStatus(cText.emailVerificationSent);
                  } catch (err: any) {
                    setEmailVerifyStatus(err.message || cText.emailSendFailed);
                  } finally {
                    setCheckingVerify(false);
                  }
                }}
                className="px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-medium cursor-pointer"
              >
                {cText.sendVerification}
              </button>
              <button
                type="button"
                disabled={checkingVerify}
                onClick={async () => {
                  try {
                    setCheckingVerify(true);
                    await user.reload();
                    await syncUserProfile(user);
                    setUserVersion((v) => v + 1);
                    if (!user.emailVerified) {
                      setEmailVerifyStatus(cText.emailStillUnverified);
                    }
                  } finally {
                    setCheckingVerify(false);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${checkingVerify ? 'animate-spin' : ''}`} />
                <span>{cText.checkAgain}</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Messages Thread */}
        <div
          ref={messagesScrollRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 pt-5 pb-6 sm:px-8 sm:py-8 flex flex-col"
        >
          <div className="w-full max-w-[46rem] mx-auto space-y-5 sm:space-y-7 min-w-0 flex-1 flex flex-col">
            {(!currentChat?.messages || currentChat.messages.length === 0) &&
              (() => {
                const ew = cText.emptyWorkspace;
                const hour = new Date().getHours();
                const firstName =
                  effectiveDisplayName && effectiveDisplayName !== t.common.defaultUser
                    ? effectiveDisplayName.split(' ')[0]
                    : cText.defaultFriendName;
                const greeting =
                  hour < 12
                    ? ew.greetingMorning(firstName)
                    : hour < 18
                      ? ew.greetingAfternoon(firstName)
                      : ew.greetingEvening(firstName);
                const quickPrompts = cText.suggestions.slice(0, 3);

                return (
                  <div className="flex-1 flex flex-col justify-center py-8 px-1 space-y-8 animate-up max-w-2xl mx-auto w-full text-center">
                    <div className="space-y-3 flex flex-col items-center">
                      <LongclawLogo className="w-[39px] h-[39px] text-[var(--tx)]" />
                      <h3 className="font-serif-fraunces text-[1.95rem] sm:text-[2.45rem] font-medium tracking-[-0.02em] leading-[1.12] text-balance text-[var(--tx)]">
                        {greeting}
                      </h3>
                      <div className="flex items-center justify-center gap-2 text-xs text-[var(--mut)]">
                        <ModelLogo modelId={selectedModel} className="w-[17px] h-[17px] shrink-0" />
                        <span className="font-medium text-[var(--tx)]">{activeModel.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.models[selectedModel].tagline}</span>
                      </div>
                    </div>

                    {/* Calm Starter Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                      {quickPrompts.map((prompt, i) => (
                        <motion.button
                          key={i}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileTap={{ scale: 0.985 }}
                          transition={{
                            duration: 0.28,
                            delay: 0.04 + i * 0.045,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          onClick={() => {
                            if (prompt.endsWith(':')) {
                              setInputMessage(prompt + ' ');
                              textareaRef.current?.focus();
                            } else {
                              handleSendMessage(prompt);
                            }
                          }}
                          className="tile-3d group p-4 rounded-2xl text-left flex flex-col justify-between gap-4 min-h-[104px] cursor-pointer"
                        >
                          <span className="text-[13.5px] font-medium text-[var(--tx)] leading-snug">
                            {prompt}
                          </span>
                          <ArrowUpRight className="w-4 h-4 text-[var(--mut)] group-hover:text-[var(--tx)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0 self-end" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                );
              })()}

            {/* Render Existing Messages */}
            {currentChat?.messages?.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`animate-pop flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[86%] sm:max-w-[78%] flex flex-col items-end gap-2">
                    {msg.images && msg.images.length > 0 && (
                      <div
                        className={`grid gap-2 ${
                          msg.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                        }`}
                      >
                        {msg.images.map((img) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setLightboxImageSrc(img.dataUrl)}
                            className="photo-frame-3d overflow-hidden rounded-xl bg-[var(--surf)] cursor-zoom-in block"
                          >
                            <img
                              src={img.dataUrl}
                              alt={img.name || 'Attached image'}
                              className="max-h-56 max-w-[260px] w-full h-full object-cover block"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <div className="bubble-3d-user px-4.5 py-3 rounded-3xl rounded-br-md text-[15px] sm:text-[14.5px] leading-[1.65] whitespace-pre-wrap break-words">
                        {(() => {
                          const cmdMatch = msg.content.match(/^(\/[\p{L}\p{N}_-]+)([\s\S]*)$/u);
                          if (!cmdMatch) return msg.content;
                          return (
                            <>
                              <span className="font-mono font-semibold text-[var(--on)] underline underline-offset-4 decoration-current/45">
                                {cmdMatch[1]}
                              </span>
                              {cmdMatch[2]}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full flex gap-3.5 items-start animate-pop">
                    <div className="w-8 h-8 rounded-full bg-[var(--surf)] border border-[var(--bd)] flex items-center justify-center shrink-0 mt-0.5 text-[var(--tx)]">
                      <LongclawLogo className="w-[17px] h-[17px]" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Thought block — Tactile 3D Disclosure */}
                      {msg.thoughts && (
                        <div className="text-xs">
                          <button
                            onClick={() =>
                              setExpandedThoughts((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="btn-3d-soft inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer"
                          >
                            <ReasoningIcon className="w-3.5 h-3.5 text-[var(--ac)] shrink-0" />
                            <span className="font-medium">
                              {cText.thoughtsLabel}{' '}
                              {msg.dur ? `· ${msg.dur} ${cText.secondsShort}` : ''}
                            </span>
                            {expandedThoughts[msg.id] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <AnimatePresence initial={false}>
                            {expandedThoughts[msg.id] && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="well-3d mt-2 p-3.5 rounded-xl text-[13px] text-[var(--mut)] whitespace-pre-line leading-relaxed">
                                  {msg.thoughts}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Content */}
                      {(() => {
                        const draftProposals = extractGmailDraftBlocks(msg.content);
                        const displayMarkdown =
                          draftProposals.length > 0
                            ? stripGmailDraftBlocks(msg.content)
                            : msg.content;
                        return (
                          <>
                            {displayMarkdown && (
                              <div className="text-[15.5px] sm:text-[15px] leading-[1.72] text-[var(--tx)] break-words">
                                {renderMarkdown(displayMarkdown, {
                                  onOpenPreview: (code, language, blockIndex) =>
                                    openCodePreview(displayMarkdown, code, language, blockIndex),
                                  openResultLabel: cText.codePreview.openResult,
                                  copyCodeLabel: cText.codePreview.copyCode,
                                  copiedCodeLabel: cText.codePreview.copiedCode,
                                  enablePreviewButtons: true,
                                })}
                              </div>
                            )}

                            {draftProposals.map((draft, dIdx) => (
                              <div
                                key={`${msg.id}-draft-${dIdx}`}
                                className="mt-4 py-4 border-y border-[var(--bd)] space-y-3"
                              >
                                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--tx)]">
                                  <GmailIcon className="w-4 h-4 shrink-0" />
                                  <span>{cText.connectors.draftCardTitle}</span>
                                </div>
                                <div className="space-y-1.5 text-xs py-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[var(--mut)] shrink-0">
                                      {cText.connectors.toLabel}:
                                    </span>
                                    <span className="font-medium text-[var(--tx)] break-all">
                                      {draft.to || '—'}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[var(--mut)] shrink-0">
                                      {cText.connectors.subjectLabel}:
                                    </span>
                                    <span className="font-medium text-[var(--tx)] break-words">
                                      {draft.subject || '—'}
                                    </span>
                                  </div>
                                  <p className="pt-1.5 text-[13px] text-[var(--tx)]/90 whitespace-pre-wrap leading-relaxed">
                                    {draft.body}
                                  </p>
                                </div>

                                {workspaceConnected ? (
                                  <div className="flex flex-wrap items-center gap-3 pt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPendingChatGmailAction({ mode: 'draft', payload: draft })
                                      }
                                      className="inline-flex items-center gap-1.5 py-1.5 text-xs font-medium text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>{cText.connectors.reviewAndSaveDraft}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPendingChatGmailAction({ mode: 'send', payload: draft })
                                      }
                                      className="btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium cursor-pointer"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      <span>{cText.connectors.reviewAndSend}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openConnectors('gmail')}
                                    className="inline-flex items-center gap-2 text-xs font-medium text-[var(--tx)] underline underline-offset-4 cursor-pointer"
                                  >
                                    <span>{cText.connectors.connectToSendHint}</span>
                                  </button>
                                )}
                              </div>
                            ))}

                            {msg.generatedImage && (
                              <GeneratedImageCard image={msg.generatedImage} lang={lang} />
                            )}
                          </>
                        );
                      })()}

                      {/* Action Tools */}
                      {(() => {
                        const previewableBlocks = extractCodeBlocks(msg.content).filter((b) =>
                          isPreviewableCode(b.language, b.code)
                        );
                        const primaryBlock =
                          previewableBlocks.find((b) =>
                            ['html', 'jsx', 'tsx', 'react', 'svg', 'mermaid'].includes(b.language)
                          ) || previewableBlocks[0];

                        return (
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--mut)]">
                            <button
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg hover:bg-[var(--surf)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                            >
                              {copiedMessageId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-500 font-medium">{cText.copied}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>{cText.copy}</span>
                                </>
                              )}
                            </button>

                            {primaryBlock && (
                              <button
                                onClick={() =>
                                  openCodePreview(
                                    msg.content,
                                    primaryBlock.code,
                                    primaryBlock.language,
                                    primaryBlock.index
                                  )
                                }
                                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer font-medium"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>{cText.codePreview.openResult}</span>
                              </button>
                            )}

                            {idx === (currentChat?.messages?.length || 0) - 1 && (
                              <button
                                onClick={handleRegenerate}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg hover:bg-[var(--surf)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>{cText.regenerate}</span>
                              </button>
                            )}

                            {msg.modelId && isValidChatModel(msg.modelId) && (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-[var(--mut)]/90 select-none sm:ml-auto"
                                title={getChatModelOption(msg.modelId).name}
                              >
                                <ModelLogo modelId={msg.modelId} className="w-[15px] h-[15px] shrink-0" />
                                <span>{getChatModelOption(msg.modelId).shortName}</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Live Streaming Bubble */}
            {isStreaming && (
              <div className="w-full flex gap-3.5 items-start animate-pop">
                <div className="w-8 h-8 rounded-full bg-[var(--surf)] border border-[var(--bd)] flex items-center justify-center shrink-0 mt-0.5 text-[var(--tx)]">
                  <LongclawLogo className="w-[17px] h-[17px]" />
                </div>

                <div className="flex-1 min-w-0 space-y-2.5">
                  {streamingThoughts && (
                    <div className="text-xs text-[var(--mut)] space-y-1.5">
                      <div className="flex items-center gap-1.5 font-medium py-0.5">
                        <ReasoningIcon className="w-3.5 h-3.5 text-[var(--ac)] shrink-0" />
                        <span className="animate-shimmer">{cText.thinking}</span>
                      </div>
                      <p className="well-3d p-3 rounded-xl text-[13px] whitespace-pre-line leading-relaxed">
                        {streamingThoughts}
                      </p>
                    </div>
                  )}

                  {streamingText ? (
                    <div className="text-[15px] leading-[1.65] sm:leading-relaxed text-[var(--tx)] font-soft break-words">
                      {renderMarkdown(stripGmailDraftBlocks(streamingText), {
                        copyCodeLabel: cText.codePreview.copyCode,
                        copiedCodeLabel: cText.codePreview.copiedCode,
                        enablePreviewButtons: false,
                        isStreaming: true,
                      })}
                    </div>
                  ) : generatingImage ? (
                    <div className="space-y-2.5 py-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--mut)]">
                        <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="animate-shimmer">
                          {lang === 'tr'
                            ? 'Görselin oluşturuluyor…'
                            : 'Creating your image…'}
                        </span>
                      </div>
                      <div className="w-full max-w-[360px] aspect-square rounded-2xl border border-[var(--bd)]/70 bg-[var(--surf)]/80 animate-pulse flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-[var(--mut)]/40" />
                      </div>
                    </div>
                  ) : checkingWorkspaceLabel ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-[var(--mut)]">
                      <ConnectorsIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="animate-shimmer">{checkingWorkspaceLabel}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 py-2.5" aria-label={cText.thinking}>
                      <span
                        className="w-[7px] h-[7px] rounded-full bg-[var(--mut)] animate-[bn_1.1s_infinite]"
                        style={{ animationDelay: '0s' }}
                      />
                      <span
                        className="w-[7px] h-[7px] rounded-full bg-[var(--mut)] animate-[bn_1.1s_infinite]"
                        style={{ animationDelay: '0.15s' }}
                      />
                      <span
                        className="w-[7px] h-[7px] rounded-full bg-[var(--mut)] animate-[bn_1.1s_infinite]"
                        style={{ animationDelay: '0.3s' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Sculpted 3D Composer (zero elements beneath typing bar) */}
        <div className="relative z-10 px-3 pt-1.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-2 sm:pb-6 bg-transparent shrink-0">
          <div className="max-w-[46rem] mx-auto relative">
            {/* Subtle Floating Scroll-to-Bottom Button */}
            <AnimatePresence>
              {showScrollToBottom && !slashMenuOpen && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => scrollToBottom('smooth')}
                  aria-label={lang === 'tr' ? 'En alta kaydır' : 'Scroll to bottom'}
                  title={lang === 'tr' ? 'En alta kaydır' : 'Scroll to bottom'}
                  className="surface-3d-elevated absolute -top-11 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer z-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Slash Command Autocomplete Popover */}
            <AnimatePresence>
              {slashMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.99 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  role="listbox"
                  aria-label={lang === 'tr' ? 'Komutlar' : 'Commands'}
                  className="surface-3d-elevated absolute left-0 right-0 bottom-full mb-2 rounded-2xl overflow-hidden z-40"
                >
                  <div className="px-3.5 py-2 border-b border-[var(--bd)]/75 flex items-center justify-between gap-2 text-[11px] text-[var(--mut)]">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Terminal className="w-3 h-3" />
                      <span>{lang === 'tr' ? 'Komutlar' : 'Commands'}</span>
                    </span>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSlashMenuDismissed(true);
                        openSettings('commands');
                      }}
                      className="text-[11px] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                    >
                      {lang === 'tr' ? '+ Ayarlarda komut ekle' : '+ Add command in Settings'}
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {filteredSlashCommands.map((cmd, idx) => {
                      const active = idx === slashSelectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setSlashSelectedIndex(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSlashCommand(cmd, true);
                          }}
                          className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            active ? 'bg-[var(--surf)] text-[var(--tx)]' : 'text-[var(--tx)]/90 hover:bg-[var(--surf)]/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {cmd.connectorId === 'gmail' && <GmailIcon className="w-3.5 h-3.5 shrink-0" />}
                            {cmd.connectorId === 'calendar' && (
                              <GoogleCalendarIcon className="w-3.5 h-3.5 shrink-0" />
                            )}
                            {cmd.connectorId === 'drive' && (
                              <GoogleDriveIcon className="w-3.5 h-3.5 shrink-0" />
                            )}
                            {cmd.connectorId === 'docs' && (
                              <GoogleDocsIcon className="w-3.5 h-3.5 shrink-0" />
                            )}
                            {cmd.connectorId === 'tasks' && (
                              <GoogleTasksIcon className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="font-mono text-xs font-semibold text-[var(--tx)] shrink-0">
                              /{cmd.name}
                            </span>
                            <span className="text-xs text-[var(--mut)] truncate">
                              {cmd.description}
                            </span>
                          </div>
                          {cmd.isCustom && (
                            <span className="text-[10px] font-medium text-[var(--mut)] shrink-0">
                              {lang === 'tr' ? 'Özel' : 'Custom'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sculpted 3D Floating Command Composer Dock */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!isDraggingFiles) setIsDraggingFiles(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDraggingFiles(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFiles(false);
                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                  void processIncomingFiles(e.dataTransfer.files);
                }
              }}
              className={`composer-3d relative rounded-3xl px-4 pt-3.5 pb-2.5 sm:px-4.5 sm:pt-4 sm:pb-3 ${
                isDraggingFiles ? 'ring-2 ring-[var(--tx)]/20 border-[var(--tx)]' : ''
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.txt,.md,.json,.csv,.py,.js,.html,.ts,.tsx,.jsx,.css"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />

              {attachedImages.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pb-2.5 mb-2 border-b border-[var(--bd)]/65">
                  {attachedImages.map((img) => (
                    <div
                      key={img.id}
                      className="photo-frame-3d relative group w-14 h-14 rounded-xl overflow-hidden bg-[var(--surf)] shrink-0"
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="w-full h-full object-cover block cursor-zoom-in"
                        onClick={() => setLightboxImageSrc(img.dataUrl)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAttachedImages((prev) => prev.filter((item) => item.id !== img.id))
                        }
                        aria-label={lang === 'tr' ? 'Görseli kaldır' : 'Remove image'}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {imageMode && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--bd)]/65 text-xs">
                  <div className="flex items-center gap-2 text-[var(--tx)] font-medium">
                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'tr' ? 'Görsel oluşturma modu' : 'Image creation mode'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['1:1', '16:9', '4:3', '9:16'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setImageAspectRatio(ratio)}
                        className={`px-1.5 py-0.5 text-[11px] font-mono transition-colors cursor-pointer border-b ${
                          imageAspectRatio === ratio
                            ? 'text-[var(--tx)] border-[var(--tx)] font-semibold'
                            : 'text-[var(--mut)] border-transparent hover:text-[var(--tx)]'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setImageMode(false)}
                      className="p-1 ml-1 rounded-full text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer"
                      aria-label={lang === 'tr' ? 'Görsel modunu kapat' : 'Exit image mode'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {(voice.isRecording || voice.isTranscribing) && (
                  <motion.div
                    key="voice-bar"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center justify-between gap-3 pb-2.5 mb-2 border-b border-[var(--bd)]/65 text-xs"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {voice.isRecording ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                          <div
                            className="flex items-center gap-[3px] h-4 shrink-0"
                            aria-hidden="true"
                          >
                            {voice.audioLevels.map((lvl, idx) => (
                              <span
                                key={idx}
                                className="w-[2.5px] rounded-full bg-[var(--tx)] transition-[height] duration-75"
                                style={{ height: `${Math.round(4 + lvl * 13)}px` }}
                              />
                            ))}
                          </div>
                          <span className="font-medium text-[var(--tx)] truncate">
                            {voice.interimTranscript || cText.voice.listeningLabel}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--mut)] tabular-nums shrink-0">
                            {formatVoiceDuration(voice.elapsedSeconds)}
                          </span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--tx)] shrink-0" />
                          <span className="font-medium text-[var(--tx)] truncate">
                            {cText.voice.transcribingLabel}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={voice.cancelRecording}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer"
                        title={cText.voice.cancelTitle}
                        aria-label={cText.voice.cancelTitle}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {voice.isRecording && (
                        <button
                          type="button"
                          onClick={voice.stopRecording}
                          className="w-7 h-7 rounded-full bg-[var(--ac)] text-[var(--on)] hover:opacity-90 flex items-center justify-center transition-opacity cursor-pointer"
                          title={cText.voice.stopTitle}
                          aria-label={cText.voice.stopTitle}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.3]" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {voiceError && !voice.isRecording && !voice.isTranscribing && (
                  <motion.div
                    key="voice-error"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--bd)]/65 text-xs text-red-600 dark:text-red-400"
                    role="alert"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{voiceError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVoiceError(null)}
                      aria-label={t.common.close}
                      className="p-0.5 rounded-full hover:bg-[var(--surf)] text-current shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={handleInputChange}
                onPaste={handleTextareaPaste}
                onKeyDown={(e) => {
                  if (slashMenuOpen) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSlashSelectedIndex((prev) => (prev + 1) % filteredSlashCommands.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSlashSelectedIndex(
                        (prev) =>
                          (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length
                      );
                      return;
                    }
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const chosen = filteredSlashCommands[slashSelectedIndex];
                      if (chosen) handleSelectSlashCommand(chosen, false);
                      return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const chosen = filteredSlashCommands[slashSelectedIndex];
                      if (chosen) {
                        // If user typed an exact custom command that does not expect extra input, run it directly
                        const exactTyped =
                          inputMessage.trim().slice(1).toLowerCase() === chosen.name.toLowerCase();
                        if (exactTyped && chosen.kind === 'custom' && !chosen.expectsArgs) {
                          handleSendMessage();
                        } else {
                          handleSelectSlashCommand(chosen, true);
                        }
                      }
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setSlashMenuDismissed(true);
                      return;
                    }
                  }

                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  imageMode
                    ? lang === 'tr'
                      ? 'Nasıl bir görsel çizmemi istersin? (örn. gün batımında İstanbul Boğazı)'
                      : 'Describe the picture you have in mind...'
                    : attachedImages.length > 0
                      ? lang === 'tr'
                        ? 'Eklediğin görsel hakkında ne soracaksın?'
                        : 'What should we look at in this image?'
                      : cText.inputPlaceholder
                }
                className="w-full bg-transparent border-0 outline-none focus:outline-none focus-visible:outline-none appearance-none resize-none px-1 pb-2 text-base sm:text-sm leading-relaxed text-[var(--tx)] placeholder:text-[var(--mut)] max-h-40 sm:max-h-44 min-h-[42px] sm:min-h-[38px]"
              />

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--bd)]/65 mt-1">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  {/* Attach File */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-9.5 h-9.5 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-lg text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer shrink-0"
                    title={cText.attachFileTitle}
                    aria-label={cText.attachFileTitle}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Connectors Hub Button (5 Google Workspace Connectors) */}
                  <button
                    type="button"
                    onClick={() => openConnectors('gmail')}
                    className="relative w-9.5 h-9.5 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-lg text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer shrink-0"
                    title={cText.connectors.openButtonTitle}
                    aria-label={cText.connectors.openButtonTitle}
                  >
                    <ConnectorsIcon className="w-4 h-4" />
                    {workspaceConnected && enabledConnectorCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[var(--card)]" />
                    )}
                  </button>

                  {/* Image Generation Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setImageMode((prev) => !prev);
                      textareaRef.current?.focus();
                    }}
                    className={`w-9.5 h-9.5 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
                      imageMode
                        ? 'bg-[var(--ac)] text-[var(--on)]'
                        : 'text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)]'
                    }`}
                    title={lang === 'tr' ? 'Görsel oluştur' : 'Create image'}
                    aria-label={lang === 'tr' ? 'Görsel oluştur' : 'Create image'}
                    aria-pressed={imageMode}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  {/* Model Selector inside Typing Bar */}
                  <div ref={modelMenuRef} className="relative min-w-0 max-w-full ml-1">
                    <button
                      type="button"
                      onClick={() => setModelMenuOpen((prev) => !prev)}
                      aria-expanded={modelMenuOpen}
                      aria-haspopup="listbox"
                      className="btn-3d-soft flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 min-h-[34px] max-w-full rounded-lg text-xs font-medium cursor-pointer"
                      title={cText.selectModelTitle}
                    >
                      <ModelLogo modelId={selectedModel} className="w-[19px] h-[19px] shrink-0" />
                      <span className="hidden sm:inline truncate">{activeModel.name}</span>
                      <span className="sm:hidden truncate">{activeModel.shortName}</span>
                      <ChevronUp
                        className={`w-3.5 h-3.5 text-[var(--mut)] shrink-0 transition-transform duration-200 ${
                          modelMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {modelMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.98 }}
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          role="listbox"
                          aria-label={cText.modelSelectionAria}
                          className="surface-3d-elevated fixed inset-x-3 bottom-[max(5.75rem,calc(5rem+env(safe-area-inset-bottom)))] sm:absolute sm:inset-x-auto sm:left-0 sm:bottom-11 sm:w-80 max-h-[min(65dvh,28rem)] overflow-y-auto rounded-2xl p-2 sm:p-1.5 z-50 space-y-0.5"
                        >
                          <div className="px-2.5 py-1.5 text-[11px] font-medium text-[var(--mut)]">
                            {cText.chooseModel}
                          </div>
                          {FAMILY_MODELS.map((m) => {
                            const isSelected = m.id === selectedModel;
                            const localizedModel = t.models[m.id];
                            return (
                              <button
                                key={m.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setSelectedModel(m.id);
                                  setModelMenuOpen(false);
                                }}
                                className={`w-full flex items-start gap-3 p-3 sm:p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-[var(--surf)]/90 text-[var(--tx)]'
                                    : 'hover:bg-[var(--surf)]/55 text-[var(--tx)]'
                                }`}
                              >
                                <ModelLogo modelId={m.id} className="w-[22px] h-[22px] shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs font-semibold text-[var(--tx)]">
                                    <span>{m.shortName}</span>
                                    <span className="text-[11px] font-normal text-[var(--mut)]">
                                      · {localizedModel.tagline}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[var(--mut)] leading-snug mt-0.5">
                                    {localizedModel.description}
                                  </p>
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-[var(--tx)] shrink-0 mt-0.5" />
                                )}
                              </button>
                            );
                          })}

                          {OTHER_MODELS.length > 0 && (
                            <div className="pt-1 mt-1 border-t border-[var(--bd)] space-y-0.5">
                              <button
                                type="button"
                                onClick={() => setOtherModelsOpen((prev) => !prev)}
                                className="w-full flex items-center justify-between px-2.5 py-2.5 sm:py-1.5 rounded-xl text-[11px] font-medium text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)]/50 transition-colors cursor-pointer"
                              >
                                <span>{cText.otherModels}</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    otherModelsOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {otherModelsOpen &&
                                OTHER_MODELS.map((m) => {
                                  const isSelected = m.id === selectedModel;
                                  const localizedModel = t.models[m.id];
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      onClick={() => {
                                        setSelectedModel(m.id);
                                        setModelMenuOpen(false);
                                      }}
                                      className={`w-full flex items-start gap-3 p-3 sm:p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                        isSelected
                                          ? 'bg-[var(--surf)]/90 text-[var(--tx)]'
                                          : 'hover:bg-[var(--surf)]/55 text-[var(--tx)]'
                                      }`}
                                    >
                                      <ModelLogo modelId={m.id} className="w-[22px] h-[22px] shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs font-semibold text-[var(--tx)]">
                                          <span>{m.shortName}</span>
                                          <span className="text-[11px] font-normal text-[var(--mut)]">
                                            · {localizedModel.tagline}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-[var(--mut)] leading-snug mt-0.5">
                                          {localizedModel.description}
                                        </p>
                                      </div>
                                      {isSelected && (
                                        <Check className="w-4 h-4 text-[var(--tx)] shrink-0 mt-0.5" />
                                      )}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {voice.isSupported && !isStreaming && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceError(null);
                        voice.toggleRecording();
                      }}
                      disabled={voice.isTranscribing}
                      aria-pressed={voice.isRecording}
                      aria-label={
                        voice.isRecording
                          ? cText.voice.stopTitle
                          : voice.isTranscribing
                            ? cText.voice.transcribingLabel
                            : cText.voice.startTitle
                      }
                      title={
                        voice.isRecording
                          ? cText.voice.stopTitle
                          : voice.isTranscribing
                            ? cText.voice.transcribingLabel
                            : cText.voice.startTitle
                      }
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
                        voice.isRecording
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/40 hover:bg-red-500/25'
                          : 'text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)]'
                      }`}
                    >
                      {voice.isTranscribing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : voice.isRecording ? (
                        <Square className="w-3 h-3 fill-current" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {!isStreaming && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceError(null);
                        if (voice.isRecording || voice.isTranscribing) {
                          voice.cancelRecording();
                        }
                        setIsVoiceChatOpen(true);
                      }}
                      aria-label={cText.voiceChat.openTitle}
                      title={cText.voiceChat.openTitle}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)]"
                    >
                      <AudioLines className="w-4 h-4" />
                    </button>
                  )}

                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      className="w-9 h-9 rounded-full bg-[var(--tx)] text-[var(--bg)] hover:opacity-85 flex items-center justify-center shrink-0 transition-opacity cursor-pointer"
                      title={cText.stopTitle}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={
                        voice.isRecording ||
                        voice.isTranscribing ||
                        (!inputMessage.trim() && attachedImages.length === 0)
                      }
                      className="btn-3d-primary w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      title={cText.sendTitle}
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {lightboxImageSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxImageSrc(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxImageSrc(null)}
              aria-label={t.common.close}
              className="fixed top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              src={lightboxImageSrc}
              alt="Preview"
              className="max-w-[92vw] max-h-[86dvh] rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {codePreview && (
        <CodePreviewPanel
          code={codePreview.code}
          language={codePreview.language}
          siblingCss={codePreview.siblingCss}
          siblingJs={codePreview.siblingJs}
          theme={theme}
          lang={lang}
          isExpanded={previewExpanded}
          onToggleExpand={() => setPreviewExpanded((prev) => !prev)}
          onClose={() => {
            setCodePreview(null);
            setPreviewExpanded(false);
          }}
        />
      )}

      {workspaceToast && (
        <div className="fixed top-4 right-4 z-[65] max-w-xs px-4 py-3 rounded-2xl bg-[var(--card)] border border-[var(--bd)] shadow-xl text-xs font-medium text-[var(--tx)] flex items-center gap-2">
          <ConnectorsIcon className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{workspaceToast}</span>
        </div>
      )}

      <ConnectorsModal
        isOpen={connectorsOpen}
        initialConnector={initialConnector}
        lang={lang}
        workspaceConnected={workspaceConnected}
        workspaceEmail={workspaceEmail}
        connectorToggles={connectorToggles}
        onToggleConnector={handleToggleConnector}
        onWorkspaceConnected={(email) => {
          setWorkspaceConnected(true);
          setWorkspaceEmail(email);
        }}
        onWorkspaceDisconnected={() => {
          setWorkspaceConnected(false);
          setWorkspaceEmail(null);
        }}
        onAttachContextToChat={handleAttachContextToChat}
        onClose={() => setConnectorsOpen(false)}
      />

      <SettingsModal
        isOpen={settingsOpen}
        initialTab={settingsTab}
        user={user}
        lang={lang}
        theme={theme}
        fontPref={fontPref}
        customCommands={customCommands}
        workspaceConnected={workspaceConnected}
        workspaceEmail={workspaceEmail}
        onSaveCommand={handleSaveCustomCommand}
        onDeleteCommand={handleDeleteCustomCommand}
        onToggleTheme={onToggleTheme}
        onChangeLang={onChangeLang}
        onChangeFontPref={onChangeFontPref}
        onOpenConnectors={() => openConnectors('gmail')}
        onProfileUpdated={() => setUserVersion((v) => v + 1)}
        onClose={() => setSettingsOpen(false)}
      />

      <GmailConfirmActionDialog
        action={pendingChatGmailAction}
        lang={lang}
        submitting={submittingChatGmailAction}
        onCancel={() => setPendingChatGmailAction(null)}
        onConfirm={handleConfirmChatGmailAction}
      />

      {/* Explicit Confirmation Dialog for Mutating / External Google Workspace Command Actions */}
      <AnimatePresence>
        {pendingWorkspaceMutation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => !submittingWorkspaceMutation && setPendingWorkspaceMutation(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="surface-3d-elevated w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4 text-[var(--tx)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-serif-fraunces text-lg font-semibold">
                    {pendingWorkspaceMutation.mutation.title}
                  </h3>
                  <p className="text-xs text-[var(--mut)] leading-relaxed">
                    {pendingWorkspaceMutation.mutation.description}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submittingWorkspaceMutation}
                  onClick={() => setPendingWorkspaceMutation(null)}
                  aria-label={t.common.close}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {pendingWorkspaceMutation.mutation.details.length > 0 && (
                <div className="divide-y divide-[var(--bd)]/75 border-y border-[var(--bd)]/75 text-xs">
                  {pendingWorkspaceMutation.mutation.details.map((row, idx) => (
                    <div key={idx} className="py-2.5 flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-[var(--mut)]">
                        {row.label}
                      </span>
                      <span className="text-[var(--tx)] whitespace-pre-wrap break-words max-h-36 overflow-y-auto">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={submittingWorkspaceMutation}
                  onClick={() => setPendingWorkspaceMutation(null)}
                  className="btn-3d-soft px-4 py-2 rounded-full text-xs font-medium cursor-pointer disabled:opacity-40"
                >
                  {lang === 'tr' ? 'Vazgeç' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={submittingWorkspaceMutation}
                  onClick={() => void handleConfirmWorkspaceMutation()}
                  className={`px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity disabled:opacity-40 ${
                    pendingWorkspaceMutation.mutation.destructive
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'btn-3d-primary'
                  }`}
                >
                  {submittingWorkspaceMutation
                    ? lang === 'tr'
                      ? 'İşleniyor…'
                      : 'Working…'
                    : pendingWorkspaceMutation.mutation.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <VoiceChatOverlay
        isOpen={isVoiceChatOpen}
        onClose={() => setIsVoiceChatOpen(false)}
        lang={lang}
        history={(currentChat?.messages || []).slice(-12).map((m) => ({
          role: m.role,
          content: m.content,
        }))}
        onCommitExchange={handleCommitVoiceExchange}
      />
    </div>
  );
}
