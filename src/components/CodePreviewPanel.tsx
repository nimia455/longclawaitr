import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  Smartphone,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { buildPreviewDocument, normalizeCodeLanguage } from '../lib/codeRunner';
import { Language, TRANSLATIONS } from '../lib/i18n';

interface ConsoleEntry {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

interface CodePreviewPanelProps {
  code: string;
  language: string;
  siblingCss?: string;
  siblingJs?: string;
  theme: 'light' | 'dark';
  lang: Language;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

function hashPreviewContent(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function CodePreviewPanel({
  code,
  language,
  siblingCss,
  siblingJs,
  theme,
  lang,
  isExpanded,
  onToggleExpand,
  onClose,
}: CodePreviewPanelProps) {
  const cp = TRANSLATIONS[lang].chat.codePreview;
  const normalizedLang = normalizeCodeLanguage(language, code) || language || 'code';

  const [runCounter, setRunCounter] = useState(0);
  const contentHash = useMemo(
    () => hashPreviewContent(`${code}\0${siblingCss || ''}\0${siblingJs || ''}`),
    [code, siblingCss, siblingJs]
  );
  const runId = useMemo(
    () => `lc-run-${runCounter}-${normalizedLang}-${contentHash}`,
    [runCounter, normalizedLang, contentHash]
  );

  const previewDoc = useMemo(
    () =>
      buildPreviewDocument({
        code,
        language: normalizedLang,
        runId,
        theme,
        siblingCss,
        siblingJs,
      }),
    [code, normalizedLang, runId, theme, siblingCss, siblingJs]
  );

  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState<boolean>(previewDoc.isConsoleFirst);
  const [copied, setCopied] = useState(false);

  // Reset console and auto-open for console-first scripts whenever target code/run changes
  useEffect(() => {
    setConsoleLogs([]);
    setConsoleOpen(previewDoc.isConsoleFirst);
  }, [runId, previewDoc.isConsoleFirst]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Receive console & error messages strictly from our sandboxed preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current?.contentWindow || event.source !== iframeRef.current.contentWindow) {
        return;
      }
      const data = event.data;
      if (!data || data.source !== 'longclaw-preview' || data.runId !== runId) return;

      const level: ConsoleEntry['level'] =
        data.level === 'warn' || data.level === 'error' || data.level === 'info'
          ? data.level
          : 'log';

      setConsoleLogs((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          level,
          text: String(data.text || ''),
        },
      ]);

      if (level === 'error') {
        setConsoleOpen(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [runId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API may be blocked in restricted iframe contexts
    }
  };

  const handleDownload = () => {
    const blob = new Blob([previewDoc.downloadContent], {
      type: `${previewDoc.mimeType};charset=utf-8`,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = previewDoc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const errorCount = consoleLogs.filter((l) => l.level === 'error').length;

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-50 h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--tx)]'
          : 'fixed inset-0 z-40 h-[100dvh] lg:h-full lg:static lg:z-auto lg:w-[48%] lg:min-w-[420px] lg:max-w-[740px] flex flex-col bg-[var(--bg)] text-[var(--tx)] lg:border-l border-[var(--bd)] shrink-0'
      }
    >
      {/* Panel Header */}
      <header className="min-h-14 pt-[env(safe-area-inset-top)] px-3 sm:px-4 border-b border-[var(--bd)]/75 bg-[var(--bg)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="hidden sm:inline text-sm font-medium text-[var(--tx)] truncate">
            {cp.liveResultTitle}
          </span>
          <span className="hidden sm:inline text-[var(--mut)]" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-xs font-medium uppercase text-[var(--mut)] truncate">
            {normalizedLang}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 py-2">
          {/* Preview / Code Switch */}
          <div className="segmented-track-3d flex items-center p-1 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'preview'
                  ? 'segmented-thumb-3d text-[var(--tx)]'
                  : 'text-[var(--mut)] hover:text-[var(--tx)]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{cp.previewTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'code'
                  ? 'segmented-thumb-3d text-[var(--tx)]'
                  : 'text-[var(--mut)] hover:text-[var(--tx)]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{cp.codeTab}</span>
            </button>
          </div>

          {/* Desktop / Mobile Viewport Toggle */}
          {activeTab === 'preview' && !previewDoc.isConsoleFirst && (
            <div className="segmented-track-3d hidden sm:flex items-center p-1 rounded-full">
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                title={cp.desktopView}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  viewportMode === 'desktop'
                    ? 'segmented-thumb-3d text-[var(--tx)]'
                    : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                title={cp.mobileView}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  viewportMode === 'mobile'
                    ? 'segmented-thumb-3d text-[var(--tx)]'
                    : 'text-[var(--mut)] hover:text-[var(--tx)]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Re-run */}
          <button
            type="button"
            onClick={() => setRunCounter((n) => n + 1)}
            title={cp.rerunTitle}
            aria-label={cp.rerunTitle}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer shrink-0"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopy}
            title={cp.copyCode}
            aria-label={cp.copyCode}
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer shrink-0"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            title={cp.downloadTitle}
            aria-label={cp.downloadTitle}
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Expand / Restore */}
          <button
            type="button"
            onClick={onToggleExpand}
            title={isExpanded ? cp.restoreTitle : cp.expandTitle}
            aria-label={isExpanded ? cp.restoreTitle : cp.expandTitle}
            className="hidden lg:flex w-9 h-9 items-center justify-center rounded-xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer shrink-0"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            title={cp.closeTitle}
            aria-label={cp.closeTitle}
            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col bg-[var(--surf)]/35 overflow-hidden">
        {activeTab === 'preview' ? (
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-0 sm:p-3">
            <div
              className={`h-full transition-all duration-200 bg-[var(--card)] overflow-hidden ${
                viewportMode === 'mobile' && !previewDoc.isConsoleFirst
                  ? 'w-[390px] max-w-full rounded-2xl surface-3d-elevated'
                  : 'w-full sm:rounded-xl border-0 sm:border border-[var(--bd)] shadow-xs'
              }`}
            >
              <iframe
                ref={iframeRef}
                key={runId}
                title={`${cp.liveResultTitle} (${normalizedLang})`}
                srcDoc={previewDoc.srcDoc}
                sandbox="allow-scripts allow-forms allow-modals"
                className="w-full h-full border-0 bg-[var(--card)]"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto p-4 bg-[var(--card)]">
            <pre className="text-xs font-mono leading-relaxed text-[var(--tx)] whitespace-pre-wrap break-words">
              <code>{code}</code>
            </pre>
          </div>
        )}

        {/* Console Output Drawer + Mobile Copy/Download Controls */}
        <div className="border-t border-[var(--bd)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] shrink-0">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 sm:py-2 text-xs">
            <button
              type="button"
              onClick={() => setConsoleOpen((o) => !o)}
              className="flex items-center gap-2 font-medium text-[var(--tx)] hover:opacity-80 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-[var(--mut)]" />
              <span>{cp.consoleTab}</span>
              {consoleLogs.length > 0 && (
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    errorCount > 0 ? 'text-red-500' : 'text-[var(--mut)]'
                  }`}
                >
                  · {consoleLogs.length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              {consoleOpen && consoleLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConsoleLogs([])}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{cp.clearConsole}</span>
                </button>
              )}

              {/* Mobile-accessible Copy & Download actions */}
              <div className="flex sm:hidden items-center gap-1 border-l border-[var(--bd)] pl-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  title={cp.copyCode}
                  aria-label={cp.copyCode}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[11px] font-medium">
                    {copied ? (lang === 'tr' ? 'Kopyalandı' : 'Copied') : (lang === 'tr' ? 'Kopyala' : 'Copy')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  title={cp.downloadTitle}
                  aria-label={cp.downloadTitle}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {consoleOpen && (
            <div className="max-h-44 overflow-y-auto border-t border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-mono text-xs space-y-1">
              {consoleLogs.length === 0 ? (
                <p className="text-[var(--mut)] font-sans text-[11px] py-1">{cp.noConsoleOutput}</p>
              ) : (
                consoleLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className={`py-0.5 whitespace-pre-wrap break-words ${
                      entry.level === 'error'
                        ? 'text-red-500'
                        : entry.level === 'warn'
                        ? 'text-[var(--tx)] font-semibold'
                        : 'text-[var(--tx)]'
                    }`}
                  >
                    {entry.text}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
