import React, { useState } from 'react';
import { Check, Copy, Play } from 'lucide-react';
import {
  isPreviewableCode,
  normalizeCodeLanguage,
} from './codeRunner';

export interface MarkdownRenderOptions {
  onOpenPreview?: (code: string, language: string, blockIndex: number) => void;
  openResultLabel?: string;
  copyCodeLabel?: string;
  copiedCodeLabel?: string;
  enablePreviewButtons?: boolean;
  isStreaming?: boolean;
}

function StreamCursor() {
  return <span className="chatgpt-stream-cursor" aria-hidden="true" />;
}

function renderAnimatedTailText(text: string, keyPrefix: string): React.ReactNode {
  if (!text) return null;
  // Keep settled prefix in static 64-char blocks so active char keys never shift and DOM stays lightweight
  const settledEnd = Math.floor(Math.max(0, text.length - 64) / 64) * 64;
  const nodes: React.ReactNode[] = [];
  if (settledEnd > 0) {
    nodes.push(
      <React.Fragment key={`${keyPrefix}-settled`}>
        {text.slice(0, settledEnd)}
      </React.Fragment>
    );
  }
  for (let i = settledEnd; i < text.length; i++) {
    nodes.push(
      <span key={`${keyPrefix}-c-${i}`} className="stream-char">
        {text[i]}
      </span>
    );
  }
  return nodes;
}

interface CodeBlockProps {
  language: string;
  code: string;
  blockIndex: number;
  options?: MarkdownRenderOptions;
  isStreamingTail?: boolean;
}

function CodeBlock({
  language,
  code,
  blockIndex,
  options,
  isStreamingTail = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const detectedLang = normalizeCodeLanguage(language, code);
  const displayLang = language || detectedLang;
  const canPreview =
    options?.enablePreviewButtons !== false &&
    Boolean(options?.onOpenPreview) &&
    isPreviewableCode(language, code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API may be blocked in restricted iframe contexts
    }
  };

  return (
    <div className="my-3 w-full max-w-full rounded-xl overflow-hidden border border-[var(--bd)] bg-[var(--surf)]">
      <div className="px-3.5 py-2 border-b border-[var(--bd)] bg-[var(--bg)]/60 flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-[var(--mut)] uppercase tracking-wider truncate">
          {displayLang || 'code'}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg text-[11px] font-medium text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-500">
                  {options?.copiedCodeLabel || 'Copied'}
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>{options?.copyCodeLabel || 'Copy'}</span>
              </>
            )}
          </button>

          {canPreview && (
            <button
              type="button"
              onClick={() =>
                options?.onOpenPreview?.(code, detectedLang || language, blockIndex)
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-full bg-[var(--ac)] text-[var(--on)] text-[11px] font-medium hover:opacity-90 active:scale-95 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{options?.openResultLabel || 'Open result'}</span>
            </button>
          )}
        </div>
      </div>

      <pre className="p-3.5 overflow-x-auto max-w-full text-xs font-mono text-[var(--tx)] leading-relaxed">
        <code>
          {isStreamingTail ? renderAnimatedTailText(code, `code-${blockIndex}`) : code}
          {isStreamingTail && <StreamCursor />}
        </code>
      </pre>
    </div>
  );
}

function sanitizeSafeHttpUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Reject malformed or unsupported schemes
  }
  return null;
}

/**
 * Pure React inline markdown parser (zero dangerouslySetInnerHTML).
 * Supports inline code, links (http/https only), bold, italic, and strikethrough.
 */
function renderInlineMarkdown(
  text: string,
  keyPrefix: string,
  animateTail = false
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex =
    /`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|(^|[^*])\*([^*\n]+)\*/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const matchStart = match.index;

    // Italic pattern captures an optional leading non-asterisk character in group 6
    const italicPrefix = match[6] && match[7] ? match[6] : '';
    const effectiveStart = matchStart + italicPrefix.length;

    if (effectiveStart > lastIndex) {
      nodes.push(text.slice(lastIndex, effectiveStart));
    }

    const key = `${keyPrefix}-t-${tokenIdx++}`;
    const isFinalTokenAtEnd = animateTail && matchStart + fullMatch.length === text.length;

    if (match[1] !== undefined) {
      // Inline code
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded-md bg-[var(--surf)] border border-[var(--bd)] text-xs font-mono break-all"
        >
          {isFinalTokenAtEnd ? renderAnimatedTailText(match[1], `${key}-code`) : match[1]}
        </code>
      );
    } else if (match[2] !== undefined && match[3] !== undefined) {
      // Link (strictly http/https)
      const safeHref = sanitizeSafeHttpUrl(match[3]);
      if (safeHref) {
        nodes.push(
          <a
            key={key}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-[var(--tx)] font-medium hover:opacity-80 break-words"
          >
            {match[2]}
          </a>
        );
      } else {
        nodes.push(match[2]);
      }
    } else if (match[4] !== undefined) {
      // Bold (allow nested inline tokens inside bold)
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderInlineMarkdown(match[4], `${key}-b`, isFinalTokenAtEnd)}
        </strong>
      );
    } else if (match[5] !== undefined) {
      // Strikethrough
      nodes.push(
        <del key={key} className="opacity-70">
          {renderInlineMarkdown(match[5], `${key}-s`, isFinalTokenAtEnd)}
        </del>
      );
    } else if (match[7] !== undefined) {
      // Italic
      nodes.push(
        <em key={key} className="italic">
          {isFinalTokenAtEnd ? renderAnimatedTailText(match[7], `${key}-em`) : match[7]}
        </em>
      );
    }

    lastIndex = matchStart + fullMatch.length;
  }

  if (lastIndex < text.length) {
    const trailingSlice = text.slice(lastIndex);
    if (animateTail) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-tail-${lastIndex}`}>
          {renderAnimatedTailText(trailingSlice, `${keyPrefix}-tail-${lastIndex}`)}
        </React.Fragment>
      );
    } else {
      nodes.push(trailingSlice);
    }
  }

  return nodes;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
  const cells = splitTableRow(trimmed);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

type MarkdownSegment =
  | { type: 'text'; text: string; startIndex: number }
  | { type: 'code'; lang: string; code: string; startIndex: number; blockIndex: number; open: boolean };

export function renderMarkdown(
  content: string,
  options?: MarkdownRenderOptions
): React.ReactNode {
  if (!content) return null;

  const isStreaming = Boolean(options?.isStreaming);
  const segments: MarkdownSegment[] = [];
  const codeBlockRegex = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        text: content.slice(lastIndex, match.index),
        startIndex: lastIndex,
      });
    }

    segments.push({
      type: 'code',
      lang: (match[1] || '').trim(),
      code: match[2] || '',
      startIndex: match.index,
      blockIndex: blockIndex++,
      open: false,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const trailing = content.slice(lastIndex);
    const unclosedFenceMatch = trailing.match(/```([^\n`]*)\n?([\s\S]*)$/);
    if (unclosedFenceMatch && unclosedFenceMatch.index !== undefined) {
      if (unclosedFenceMatch.index > 0) {
        segments.push({
          type: 'text',
          text: trailing.slice(0, unclosedFenceMatch.index),
          startIndex: lastIndex,
        });
      }
      segments.push({
        type: 'code',
        lang: (unclosedFenceMatch[1] || '').trim(),
        code: unclosedFenceMatch[2] || '',
        startIndex: lastIndex + unclosedFenceMatch.index,
        blockIndex: blockIndex++,
        open: true,
      });
    } else {
      segments.push({
        type: 'text',
        text: trailing,
        startIndex: lastIndex,
      });
    }
  }

  let cursorOwnerSegmentIdx = -1;
  if (isStreaming) {
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (seg.type === 'code') {
        cursorOwnerSegmentIdx = seg.open ? i : -1;
        break;
      }
      if (seg.text.trim().length > 0) {
        cursorOwnerSegmentIdx = i;
        break;
      }
    }
  }

  const parts: React.ReactNode[] = segments.map((seg, segIdx) => {
    const isTail = isStreaming && segIdx === cursorOwnerSegmentIdx;
    if (seg.type === 'code') {
      return (
        <CodeBlock
          key={`code-${seg.open ? 'open-' : ''}${seg.startIndex}-${seg.blockIndex}`}
          language={seg.lang}
          code={seg.code}
          blockIndex={seg.blockIndex}
          options={options}
          isStreamingTail={isTail}
        />
      );
    }
    return renderTextSegment(seg.text, seg.startIndex, isTail);
  });

  if (isStreaming && cursorOwnerSegmentIdx === -1) {
    parts.push(
      <div key="stream-trailing-cursor" className="py-0.5">
        <StreamCursor />
      </div>
    );
  }

  return <div className="space-y-2 min-w-0 max-w-full">{parts}</div>;
}

function renderTextSegment(
  text: string,
  baseKey: number,
  isStreamingTail = false
): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: Array<{ text: string; lineIdx: number }> = [];
  let isNumbered = false;

  let lastContentLineIdx = -1;
  if (isStreamingTail) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) {
        lastContentLineIdx = i;
        break;
      }
    }
  }

  let cursorPlaced = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    const ListTag = isNumbered ? 'ol' : 'ul';
    const listKey = `list-${baseKey}-${elements.length}`;
    elements.push(
      <ListTag
        key={listKey}
        className={`my-2 pl-5 space-y-1.5 text-[15px] sm:text-sm leading-[1.65] sm:leading-relaxed break-words ${isNumbered ? 'list-decimal' : 'list-disc'}`}
      >
        {listItems.map((item, idx) => {
          const isActiveLine = isStreamingTail && item.lineIdx === lastContentLineIdx;
          if (isActiveLine) cursorPlaced = true;
          return (
            <li key={idx}>
              {renderInlineMarkdown(item.text, `${listKey}-li-${idx}`, isActiveLine)}
              {isActiveLine && <StreamCursor />}
            </li>
          );
        })}
      </ListTag>
    );
    listItems = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    // Markdown table detection (header row + separator row)
    if (
      trimmed.includes('|') &&
      idx + 1 < lines.length &&
      isTableSeparatorLine(lines[idx + 1])
    ) {
      flushList();
      const headers = splitTableRow(trimmed);
      const rows: string[][] = [];
      let rowCursor = idx + 2;
      while (rowCursor < lines.length) {
        const nextTrimmed = lines[rowCursor].trim();
        if (!nextTrimmed || !nextTrimmed.includes('|')) break;
        rows.push(splitTableRow(nextTrimmed));
        rowCursor++;
      }
      const tableKey = `table-${baseKey}-${idx}`;
      const isTailTable =
        isStreamingTail && lastContentLineIdx >= idx && lastContentLineIdx <= rowCursor - 1;
      if (isTailTable) cursorPlaced = true;

      elements.push(
        <div
          key={tableKey}
          className="my-3 w-full overflow-x-auto rounded-xl border border-[var(--bd)] bg-[var(--surf)]/40"
        >
          <table className="w-full border-collapse text-left text-xs sm:text-[13px]">
            <thead>
              <tr className="border-b border-[var(--bd)] bg-[var(--surf)]">
                {headers.map((header, hIdx) => {
                  const isActiveCell =
                    isTailTable && rows.length === 0 && hIdx === headers.length - 1;
                  return (
                    <th
                      key={hIdx}
                      className="px-3.5 py-2.5 font-semibold text-[var(--tx)] whitespace-nowrap"
                    >
                      {renderInlineMarkdown(header, `${tableKey}-h-${hIdx}`, isActiveCell)}
                      {isActiveCell && <StreamCursor />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                let lastPopulatedCol = headers.length - 1;
                if (isTailTable && rIdx === rows.length - 1) {
                  for (let c = headers.length - 1; c >= 0; c--) {
                    if ((row[c] || '').trim()) {
                      lastPopulatedCol = c;
                      break;
                    }
                  }
                }
                return (
                  <tr
                    key={rIdx}
                    className="border-b last:border-b-0 border-[var(--bd)]/70"
                  >
                    {headers.map((_, cIdx) => {
                      const isActiveCell =
                        isTailTable &&
                        rIdx === rows.length - 1 &&
                        cIdx === lastPopulatedCol;
                      return (
                        <td
                          key={cIdx}
                          className="px-3.5 py-2 text-[var(--tx)] align-top"
                        >
                          {renderInlineMarkdown(
                            row[cIdx] || '',
                            `${tableKey}-r-${rIdx}-c-${cIdx}`,
                            isActiveCell
                          )}
                          {isActiveCell && <StreamCursor />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      idx = rowCursor - 1;
      continue;
    }

    // Horizontal rule
    if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
      flushList();
      elements.push(
        <hr key={`${baseKey}-${idx}`} className="my-3 border-t border-[var(--bd)]" />
      );
      continue;
    }

    const isActiveLine = isStreamingTail && idx === lastContentLineIdx;

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      if (isActiveLine) cursorPlaced = true;
      elements.push(
        <h4
          key={`${baseKey}-${idx}`}
          className="font-serif-fraunces text-base font-semibold mt-3 mb-1"
        >
          {renderInlineMarkdown(trimmed.slice(4), `${baseKey}-h4-${idx}`, isActiveLine)}
          {isActiveLine && <StreamCursor />}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      if (isActiveLine) cursorPlaced = true;
      elements.push(
        <h3
          key={`${baseKey}-${idx}`}
          className="font-serif-fraunces text-lg font-semibold mt-4 mb-1.5"
        >
          {renderInlineMarkdown(trimmed.slice(3), `${baseKey}-h3-${idx}`, isActiveLine)}
          {isActiveLine && <StreamCursor />}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      if (isActiveLine) cursorPlaced = true;
      elements.push(
        <h2
          key={`${baseKey}-${idx}`}
          className="font-serif-fraunces text-xl font-bold mt-4 mb-2"
        >
          {renderInlineMarkdown(trimmed.slice(2), `${baseKey}-h2-${idx}`, isActiveLine)}
          {isActiveLine && <StreamCursor />}
        </h2>
      );
      continue;
    }

    // Unordered List
    if (/^[-*•]\s+/.test(trimmed)) {
      if (isNumbered) flushList();
      isNumbered = false;
      listItems.push({ text: trimmed.replace(/^[-*•]\s+/, ''), lineIdx: idx });
      continue;
    }

    // Numbered List
    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (!isNumbered && listItems.length > 0) flushList();
      isNumbered = true;
      listItems.push({ text: trimmed.replace(/^\d+[.)]\s+/, ''), lineIdx: idx });
      continue;
    }

    // Quote
    if (trimmed.startsWith('> ')) {
      flushList();
      if (isActiveLine) cursorPlaced = true;
      elements.push(
        <blockquote
          key={`${baseKey}-${idx}`}
          className="my-2 pl-3.5 border-l-2 border-[var(--ac)] text-[var(--mut)] italic text-sm"
        >
          {renderInlineMarkdown(trimmed.slice(2), `${baseKey}-bq-${idx}`, isActiveLine)}
          {isActiveLine && <StreamCursor />}
        </blockquote>
      );
      continue;
    }

    flushList();

    if (!trimmed) {
      continue;
    }

    if (isActiveLine) cursorPlaced = true;
    elements.push(
      <p
        key={`${baseKey}-${idx}`}
        className="text-[15px] sm:text-[14.5px] leading-[1.65] sm:leading-relaxed text-[var(--tx)] break-words"
      >
        {renderInlineMarkdown(line, `${baseKey}-p-${idx}`, isActiveLine)}
        {isActiveLine && <StreamCursor />}
      </p>
    );
  }

  flushList();

  if (isStreamingTail && !cursorPlaced) {
    elements.push(
      <div key={`${baseKey}-cursor-fallback`} className="py-0.5">
        <StreamCursor />
      </div>
    );
  }

  return elements;
}
