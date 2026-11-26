import {
  WORKSPACE_SCOPES,
  connectWorkspace,
  disconnectWorkspace,
  getCachedWorkspaceEmail,
  getWorkspaceAccessToken,
  initWorkspaceSessionCleanup,
  workspaceFetch,
} from './workspace';

export const GMAIL_SCOPES = WORKSPACE_SCOPES;

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  unread: boolean;
}

export interface GmailDraftPayload {
  to: string;
  subject: string;
  body: string;
}

export function initGmailSessionCleanup(onCleared: () => void): () => void {
  return initWorkspaceSessionCleanup(onCleared);
}

export function getGmailAccessToken(): string | null {
  return getWorkspaceAccessToken();
}

export function getCachedGmailEmail(): string | null {
  return getCachedWorkspaceEmail();
}

export function disconnectGmail(): void {
  disconnectWorkspace();
}

async function gmailFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await workspaceFetch<T>(`${GMAIL_API_BASE}${path}`, init);
  } catch (err: any) {
    if (err?.code === 'WORKSPACE_AUTH_REQUIRED') {
      const wrapped = new Error('GMAIL_AUTH_REQUIRED');
      (wrapped as any).code = 'GMAIL_AUTH_REQUIRED';
      throw wrapped;
    }
    if (err?.code === 'WORKSPACE_TOKEN_EXPIRED') {
      const wrapped = new Error('GMAIL_TOKEN_EXPIRED');
      (wrapped as any).code = 'GMAIL_TOKEN_EXPIRED';
      throw wrapped;
    }
    throw err;
  }
}

export async function connectGmail(): Promise<{ profile: GmailProfile; accessToken: string }> {
  const { emailAddress, accessToken } = await connectWorkspace();
  let messagesTotal = 0;
  let threadsTotal = 0;
  try {
    const profile = await gmailFetch<GmailProfile>('/profile');
    messagesTotal = profile.messagesTotal || 0;
    threadsTotal = profile.threadsTotal || 0;
  } catch {
    // Profile stats are optional
  }

  return {
    profile: {
      emailAddress,
      messagesTotal,
      threadsTotal,
    },
    accessToken,
  };
}

function decodeBase64Url(input: string): string {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeader(value: string): string {
  // Use RFC 2047 UTF-8 Base64 encoding when non-ASCII characters exist
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value.replace(/[\r\n]+/g, ' ');
  }
  const bytes = new TextEncoder().encode(value.replace(/[\r\n]+/g, ' '));
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractBodyFromPayload(payload: any): string {
  if (!payload) return '';

  const findPart = (node: any, targetMime: string): string | null => {
    if (!node) return null;
    if (node.mimeType === targetMime && node.body?.data) {
      return decodeBase64Url(node.body.data);
    }
    if (Array.isArray(node.parts)) {
      for (const child of node.parts) {
        const found = findPart(child, targetMime);
        if (found) return found;
      }
    }
    return null;
  };

  const plain = findPart(payload, 'text/plain');
  if (plain) return plain.trim();

  const html = findPart(payload, 'text/html');
  if (html) return stripHtmlToText(html);

  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    return payload.mimeType === 'text/html' ? stripHtmlToText(raw) : raw.trim();
  }

  return '';
}

function getHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  if (!Array.isArray(headers)) return '';
  const target = name.toLowerCase();
  const match = headers.find((h) => h.name?.toLowerCase() === target);
  return match?.value || '';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseGmailMessage(raw: any): GmailMessageSummary {
  const headers = raw?.payload?.headers || [];
  const labelIds: string[] = Array.isArray(raw?.labelIds) ? raw.labelIds : [];
  const body = extractBodyFromPayload(raw?.payload);
  return {
    id: String(raw?.id || ''),
    threadId: String(raw?.threadId || ''),
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject') || '(No subject)',
    date: getHeader(headers, 'Date'),
    snippet: decodeHtmlEntities(String(raw?.snippet || '')),
    body: body || decodeHtmlEntities(String(raw?.snippet || '')),
    unread: labelIds.includes('UNREAD'),
  };
}

export async function listGmailMessages(options?: {
  query?: string;
  maxResults?: number;
}): Promise<GmailMessageSummary[]> {
  const maxResults = Math.min(Math.max(options?.maxResults || 10, 1), 20);
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (options?.query?.trim()) {
    params.set('q', options.query.trim());
  }

  const listData = await gmailFetch<{ messages?: Array<{ id: string; threadId: string }> }>(
    `/messages?${params.toString()}`
  );

  const ids = (listData.messages || []).slice(0, maxResults);
  if (ids.length === 0) return [];

  const details = await Promise.all(
    ids.map(async ({ id }) => {
      try {
        const msg = await gmailFetch<any>(`/messages/${encodeURIComponent(id)}?format=full`);
        return parseGmailMessage(msg);
      } catch {
        return null;
      }
    })
  );

  return details.filter((m): m is GmailMessageSummary => m !== null);
}

function buildRawRfc2822Message(payload: GmailDraftPayload): string {
  const to = payload.to.trim().replace(/[\r\n]+/g, '');
  const subject = encodeMimeHeader(payload.subject.trim());
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    payload.body,
  ];
  return encodeBase64Url(lines.join('\r\n'));
}

export async function createGmailDraft(payload: GmailDraftPayload): Promise<{ id: string }> {
  const raw = buildRawRfc2822Message(payload);
  const res = await gmailFetch<{ id?: string }>('/drafts', {
    method: 'POST',
    body: JSON.stringify({ message: { raw } }),
  });
  return { id: res.id || '' };
}

export async function sendGmailMessage(payload: GmailDraftPayload): Promise<{ id: string }> {
  const raw = buildRawRfc2822Message(payload);
  const res = await gmailFetch<{ id?: string }>('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
  return { id: res.id || '' };
}

const GMAIL_INTENT_PATTERN =
  /\b(gmail|e-?mail|e-?posta|eposta|mail|mailler|mailleri|mailim|mailimi|inbox|gelen\s*kutusu|okunmamış|unread|mesajlarım|fatura|invoice|receipt|rezervasyon|flight|uçuş|bilet|sipariş|order|newsletter|bülten|taslak|draft|yanıtla|reply)\b/i;

export function shouldFetchGmailContext(prompt: string): boolean {
  return GMAIL_INTENT_PATTERN.test(prompt);
}

export function buildGmailSearchQueryFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b(unread|okunmamış)\b/i.test(lower)) {
    return 'is:unread';
  }
  const emailAddrMatch = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailAddrMatch) {
    return emailAddrMatch[0];
  }
  const quotedMatch = prompt.match(/["“]([^"”]{2,40})["”]/);
  if (quotedMatch) {
    return quotedMatch[1];
  }
  // For general inbox questions, return recent inbox messages
  return 'in:inbox';
}

export function extractGmailDraftBlocks(markdown: string): GmailDraftPayload[] {
  const regex = /```gmail-draft\s*([\s\S]*?)```/gi;
  const results: GmailDraftPayload[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && (typeof parsed.subject === 'string' || typeof parsed.body === 'string')) {
        results.push({
          to: typeof parsed.to === 'string' ? parsed.to.trim() : '',
          subject: typeof parsed.subject === 'string' ? parsed.subject.trim() : '',
          body: typeof parsed.body === 'string' ? parsed.body.trim() : '',
        });
      }
    } catch {
      // Ignore malformed JSON while streaming
    }
  }

  return results;
}

export function stripGmailDraftBlocks(markdown: string): string {
  return markdown.replace(/```gmail-draft\s*[\s\S]*?```/gi, '').trim();
}
