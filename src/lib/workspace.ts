import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/tasks',
] as const;

export type ConnectorId = 'gmail' | 'calendar' | 'drive' | 'docs' | 'tasks';

export interface WorkspaceConnectorToggles {
  gmail: boolean;
  calendar: boolean;
  drive: boolean;
  docs: boolean;
  tasks: boolean;
}

export const DEFAULT_CONNECTOR_TOGGLES: WorkspaceConnectorToggles = {
  gmail: true,
  calendar: true,
  drive: true,
  docs: true,
  tasks: true,
};

// Strictly in-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedWorkspaceToken: string | null = null;
let cachedWorkspaceEmail: string | null = null;
let isConnectingWorkspace = false;

export function getWorkspaceAccessToken(): string | null {
  return cachedWorkspaceToken;
}

export function getCachedWorkspaceEmail(): string | null {
  return cachedWorkspaceEmail;
}

export function setWorkspaceSession(token: string, email: string | null): void {
  cachedWorkspaceToken = token;
  cachedWorkspaceEmail = email;
}

export function disconnectWorkspace(): void {
  cachedWorkspaceToken = null;
  cachedWorkspaceEmail = null;
}

export function initWorkspaceSessionCleanup(onCleared: () => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user && !isConnectingWorkspace) {
      cachedWorkspaceToken = null;
      cachedWorkspaceEmail = null;
      onCleared();
    }
  });
}

function buildWorkspaceProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({
    prompt: 'select_account consent',
  });
  return provider;
}

export async function workspaceFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = cachedWorkspaceToken;
  if (!token) {
    const err = new Error('WORKSPACE_AUTH_REQUIRED');
    (err as any).code = 'WORKSPACE_AUTH_REQUIRED';
    throw err;
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401) {
    cachedWorkspaceToken = null;
    cachedWorkspaceEmail = null;
    const err = new Error('WORKSPACE_TOKEN_EXPIRED');
    (err as any).code = 'WORKSPACE_TOKEN_EXPIRED';
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 403) {
    const rawMsg = String(data?.error?.message || '');
    if (/insufficient|permission|scope/i.test(rawMsg)) {
      cachedWorkspaceToken = null;
      const err = new Error('WORKSPACE_REAUTH_REQUIRED');
      (err as any).code = 'WORKSPACE_REAUTH_REQUIRED';
      throw err;
    }
  }
  if (!res.ok) {
    const msg = data?.error?.message || `Google Workspace request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function connectWorkspace(): Promise<{ emailAddress: string; accessToken: string }> {
  try {
    isConnectingWorkspace = true;
    const provider = buildWorkspaceProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error('Could not obtain Google Workspace access permission from Google sign-in.');
    }

    cachedWorkspaceToken = accessToken;

    let emailAddress = result.user.email || '';
    try {
      const profile = await workspaceFetch<{ emailAddress?: string }>(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile'
      );
      if (profile.emailAddress) {
        emailAddress = profile.emailAddress;
      }
    } catch {
      // Fallback to Firebase user email if Gmail profile isn't available
    }

    cachedWorkspaceEmail = emailAddress || null;
    return { emailAddress, accessToken };
  } catch (err) {
    if (!cachedWorkspaceEmail) {
      cachedWorkspaceToken = null;
    }
    throw err;
  } finally {
    isConnectingWorkspace = false;
  }
}

/* ===========================
   1. GOOGLE CALENDAR API v3
   =========================== */
export interface CalendarEventItem {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  htmlLink?: string;
}

export interface CreateCalendarEventPayload {
  summary: string;
  startIso: string;
  endIso: string;
  location?: string;
  description?: string;
}

export async function listCalendarEvents(maxResults = 10): Promise<CalendarEventItem[]> {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(Math.min(Math.max(maxResults, 1), 20)),
  });

  const data = await workspaceFetch<{ items?: any[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`
  );

  return (data.items || []).map((ev) => ({
    id: String(ev.id || ''),
    summary: String(ev.summary || '(Untitled event)'),
    description: String(ev.description || ''),
    location: String(ev.location || ''),
    start: String(ev.start?.dateTime || ev.start?.date || ''),
    end: String(ev.end?.dateTime || ev.end?.date || ''),
    htmlLink: ev.htmlLink ? String(ev.htmlLink) : undefined,
  }));
}

export async function createCalendarEvent(
  payload: CreateCalendarEventPayload
): Promise<CalendarEventItem> {
  const body = {
    summary: payload.summary.trim(),
    location: payload.location?.trim() || undefined,
    description: payload.description?.trim() || undefined,
    start: { dateTime: payload.startIso },
    end: { dateTime: payload.endIso },
  };

  const ev = await workspaceFetch<any>(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  return {
    id: String(ev.id || ''),
    summary: String(ev.summary || payload.summary),
    description: String(ev.description || ''),
    location: String(ev.location || ''),
    start: String(ev.start?.dateTime || ev.start?.date || payload.startIso),
    end: String(ev.end?.dateTime || ev.end?.date || payload.endIso),
    htmlLink: ev.htmlLink ? String(ev.htmlLink) : undefined,
  };
}

export async function updateCalendarEvent(
  eventId: string,
  payload: Partial<CreateCalendarEventPayload>
): Promise<CalendarEventItem> {
  const body: Record<string, any> = {};
  if (payload.summary?.trim()) body.summary = payload.summary.trim();
  if (payload.location !== undefined) body.location = payload.location.trim();
  if (payload.description !== undefined) body.description = payload.description.trim();
  if (payload.startIso) body.start = { dateTime: payload.startIso };
  if (payload.endIso) body.end = { dateTime: payload.endIso };

  const ev = await workspaceFetch<any>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );

  return {
    id: String(ev.id || eventId),
    summary: String(ev.summary || payload.summary || '(Untitled event)'),
    description: String(ev.description || ''),
    location: String(ev.location || ''),
    start: String(ev.start?.dateTime || ev.start?.date || ''),
    end: String(ev.end?.dateTime || ev.end?.date || ''),
    htmlLink: ev.htmlLink ? String(ev.htmlLink) : undefined,
  };
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await workspaceFetch<any>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' }
  );
}

/* ===========================
   2. GOOGLE DRIVE API v3
   =========================== */
export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}

export async function listDriveFiles(options?: {
  query?: string;
  maxResults?: number;
  mimeTypeFilter?: string;
}): Promise<DriveFileItem[]> {
  const maxResults = Math.min(Math.max(options?.maxResults || 12, 1), 20);
  const clauses: string[] = ['trashed = false'];
  if (options?.mimeTypeFilter) {
    clauses.push(`mimeType = '${options.mimeTypeFilter}'`);
  }
  if (options?.query?.trim()) {
    const escaped = options.query.trim().replace(/'/g, "\\'");
    clauses.push(`name contains '${escaped}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    pageSize: String(maxResults),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
  });

  const data = await workspaceFetch<{ files?: any[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  );

  return (data.files || []).map((f) => ({
    id: String(f.id || ''),
    name: String(f.name || 'Untitled'),
    mimeType: String(f.mimeType || ''),
    modifiedTime: String(f.modifiedTime || ''),
    webViewLink: f.webViewLink ? String(f.webViewLink) : undefined,
  }));
}

export async function readDriveFileTextPreview(file: DriveFileItem): Promise<string> {
  const token = cachedWorkspaceToken;
  if (!token) return '';

  try {
    if (file.mimeType === 'application/vnd.google-apps.document') {
      return await getGoogleDocText(file.id);
    }
    if (
      file.mimeType === 'application/vnd.google-apps.spreadsheet' ||
      file.mimeType === 'application/vnd.google-apps.presentation'
    ) {
      const exportMime =
        file.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'text/csv' : 'text/plain';
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMime)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        return (await res.text()).slice(0, 6000);
      }
    }
    if (
      file.mimeType.startsWith('text/') ||
      file.mimeType === 'application/json' ||
      file.mimeType === 'application/xml'
    ) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        return (await res.text()).slice(0, 6000);
      }
    }
  } catch {
    // Ignore unsupported binary preview errors
  }
  return '';
}

export async function createDriveFolder(name: string): Promise<DriveFileItem> {
  const f = await workspaceFetch<any>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim() || 'New Folder',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  return {
    id: String(f.id || ''),
    name: String(f.name || name),
    mimeType: String(f.mimeType || 'application/vnd.google-apps.folder'),
    modifiedTime: String(f.modifiedTime || new Date().toISOString()),
    webViewLink:
      f.webViewLink || (f.id ? `https://drive.google.com/drive/folders/${f.id}` : undefined),
  };
}

export async function createDriveTextFile(payload: {
  name: string;
  content: string;
  mimeType?: string;
}): Promise<DriveFileItem> {
  const token = cachedWorkspaceToken;
  if (!token) {
    const err = new Error('WORKSPACE_AUTH_REQUIRED');
    (err as any).code = 'WORKSPACE_AUTH_REQUIRED';
    throw err;
  }

  const boundary = `longclaw_drive_${Date.now()}`;
  const fileMime = payload.mimeType || 'text/plain; charset=UTF-8';
  const metadata = JSON.stringify({
    name: payload.name.trim() || 'note.txt',
    mimeType: fileMime.split(';')[0],
  });

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${fileMime}`,
    '',
    payload.content || '',
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (res.status === 401) {
    cachedWorkspaceToken = null;
    cachedWorkspaceEmail = null;
    const err = new Error('WORKSPACE_TOKEN_EXPIRED');
    (err as any).code = 'WORKSPACE_TOKEN_EXPIRED';
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && /insufficient|permission|scope/i.test(String(data?.error?.message || ''))) {
    cachedWorkspaceToken = null;
    const err = new Error('WORKSPACE_REAUTH_REQUIRED');
    (err as any).code = 'WORKSPACE_REAUTH_REQUIRED';
    throw err;
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || `Google Drive upload failed (${res.status})`);
  }

  return {
    id: String(data.id || ''),
    name: String(data.name || payload.name),
    mimeType: String(data.mimeType || 'text/plain'),
    modifiedTime: String(data.modifiedTime || new Date().toISOString()),
    webViewLink:
      data.webViewLink || (data.id ? `https://drive.google.com/file/d/${data.id}/view` : undefined),
  };
}

/* ===========================
   3. GOOGLE DOCS API v1
   =========================== */
export async function listGoogleDocs(options?: {
  query?: string;
  maxResults?: number;
}): Promise<DriveFileItem[]> {
  return listDriveFiles({
    query: options?.query,
    maxResults: options?.maxResults || 10,
    mimeTypeFilter: 'application/vnd.google-apps.document',
  });
}

function extractTextFromGoogleDoc(doc: any): string {
  const blocks = doc?.body?.content;
  if (!Array.isArray(blocks)) return '';
  const chunks: string[] = [];

  for (const el of blocks) {
    if (el?.paragraph?.elements) {
      const line = el.paragraph.elements
        .map((pe: any) => pe?.textRun?.content || '')
        .join('');
      if (line.trim()) chunks.push(line.replace(/\n+$/, ''));
    } else if (el?.table?.tableRows) {
      for (const row of el.table.tableRows) {
        const cells = (row.tableCells || [])
          .map((cell: any) =>
            (cell.content || [])
              .map((c: any) =>
                (c?.paragraph?.elements || []).map((pe: any) => pe?.textRun?.content || '').join('')
              )
              .join(' ')
              .trim()
          )
          .filter(Boolean);
        if (cells.length) chunks.push(cells.join(' | '));
      }
    }
  }

  return chunks.join('\n').trim();
}

export async function getGoogleDocText(documentId: string): Promise<string> {
  const doc = await workspaceFetch<any>(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`
  );
  return extractTextFromGoogleDoc(doc).slice(0, 8000);
}

export interface CreatedGoogleDoc {
  id: string;
  title: string;
  webViewLink: string;
}

export async function createGoogleDoc(payload: {
  title: string;
  content?: string;
}): Promise<CreatedGoogleDoc> {
  const created = await workspaceFetch<any>('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title.trim() || 'Untitled Document',
    }),
  });

  const documentId = String(created.documentId || '');
  const title = String(created.title || payload.title || 'Untitled Document');

  if (documentId && payload.content?.trim()) {
    await workspaceFetch<any>(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: payload.content.trim(),
              },
            },
          ],
        }),
      }
    );
  }

  return {
    id: documentId,
    title,
    webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

export async function appendToGoogleDoc(documentId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  await workspaceFetch<any>(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              endOfSegmentLocation: { segmentId: '' },
              text: `\n\n${text.trim()}`,
            },
          },
        ],
      }),
    }
  );
}

/* ===========================
   4. GOOGLE TASKS API v1
   =========================== */
export interface GoogleTaskItem {
  id: string;
  title: string;
  notes: string;
  due: string;
  status: 'needsAction' | 'completed';
  taskListId: string;
}

export interface CreateGoogleTaskPayload {
  title: string;
  notes?: string;
  dueDate?: string; // YYYY-MM-DD
  taskListId?: string;
}

export async function listGoogleTasks(maxResults = 15): Promise<GoogleTaskItem[]> {
  const params = new URLSearchParams({
    maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
    showCompleted: 'true',
    showHidden: 'false',
  });

  const data = await workspaceFetch<{ items?: any[] }>(
    `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?${params.toString()}`
  );

  return (data.items || [])
    .filter((t) => Boolean(t?.title))
    .map((t) => ({
      id: String(t.id || ''),
      title: String(t.title || ''),
      notes: String(t.notes || ''),
      due: String(t.due || ''),
      status: t.status === 'completed' ? 'completed' : 'needsAction',
      taskListId: '@default',
    }));
}

export async function createGoogleTask(payload: CreateGoogleTaskPayload): Promise<GoogleTaskItem> {
  const listId = payload.taskListId || '@default';
  const body: Record<string, any> = {
    title: payload.title.trim(),
  };
  if (payload.notes?.trim()) body.notes = payload.notes.trim();
  if (payload.dueDate?.trim()) {
    body.due = new Date(`${payload.dueDate.trim()}T12:00:00.000Z`).toISOString();
  }

  const created = await workspaceFetch<any>(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  return {
    id: String(created.id || ''),
    title: String(created.title || payload.title),
    notes: String(created.notes || ''),
    due: String(created.due || ''),
    status: created.status === 'completed' ? 'completed' : 'needsAction',
    taskListId: listId,
  };
}

export async function updateGoogleTaskStatus(
  task: GoogleTaskItem,
  completed: boolean
): Promise<GoogleTaskItem> {
  const updated = await workspaceFetch<any>(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(task.taskListId)}/tasks/${encodeURIComponent(task.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: completed ? 'completed' : 'needsAction',
        completed: completed ? new Date().toISOString() : null,
      }),
    }
  );

  return {
    ...task,
    status: updated.status === 'completed' ? 'completed' : 'needsAction',
  };
}

export async function deleteGoogleTask(taskId: string, taskListId = '@default'): Promise<void> {
  await workspaceFetch<any>(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' }
  );
}

/* ===========================
   CHAT INTENT DETECTORS
   =========================== */
const CALENDAR_INTENT =
  /\b(takvim|calendar|etkinlik|toplantı|meeting|schedule|programım|randevu|event|events|bugün\s+ne\s+var|yarın\s+ne\s+var|agenda)\b/i;

const DRIVE_INTENT =
  /\b(drive|google\s*drive|dosyalarım|dosyam|klasör|files?|folder|spreadsheet|slayt|slides?|pdf)\b/i;

const DOCS_INTENT =
  /\b(google\s*docs?|doküman|dokümanlar|belge|belgelerim|document|documents|notlarım)\b/i;

const TASKS_INTENT =
  /\b(tasks?|görev|görevler|görevlerim|yapılacak|yapılacaklar|to-?do|checklist|hatırlatıcı)\b/i;

export function shouldFetchCalendarContext(prompt: string): boolean {
  return CALENDAR_INTENT.test(prompt);
}

export function shouldFetchDriveContext(prompt: string): boolean {
  return DRIVE_INTENT.test(prompt);
}

export function shouldFetchDocsContext(prompt: string): boolean {
  return DOCS_INTENT.test(prompt);
}

export function shouldFetchTasksContext(prompt: string): boolean {
  return TASKS_INTENT.test(prompt);
}

export function formatMimeTypeLabel(mimeType: string, lang: 'en' | 'tr'): string {
  if (mimeType === 'application/vnd.google-apps.document') {
    return lang === 'tr' ? 'Google Doküman' : 'Google Doc';
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return lang === 'tr' ? 'Google E-Tablo' : 'Google Sheet';
  }
  if (mimeType === 'application/vnd.google-apps.presentation') {
    return lang === 'tr' ? 'Google Slayt' : 'Google Slides';
  }
  if (mimeType === 'application/vnd.google-apps.folder') {
    return lang === 'tr' ? 'Klasör' : 'Folder';
  }
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return lang === 'tr' ? 'Görsel' : 'Image';
  if (mimeType.startsWith('text/')) return lang === 'tr' ? 'Metin' : 'Text';
  return lang === 'tr' ? 'Dosya' : 'File';
}
