import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  RefreshCw,
  Send,
  FileText,
  Reply,
  MessageSquarePlus,
  Check,
  AlertCircle,
  ChevronDown,
  Loader2,
  LogOut,
  Plus,
  Calendar as CalendarIcon,
  MapPin,
  CheckCircle2,
  Circle,
  ExternalLink,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  MODAL_BACKDROP_ENTER,
  MODAL_BACKDROP_EXIT,
  MODAL_SHEET_ENTER,
  MODAL_SHEET_EXIT,
} from '../lib/motion';
import {
  GmailIcon,
  GoogleCalendarIcon,
  GoogleDocsIcon,
  GoogleDriveIcon,
  GoogleIcon,
  GoogleTasksIcon,
} from './Icons';
import {
  GmailDraftPayload,
  GmailMessageSummary,
  createGmailDraft,
  listGmailMessages,
  sendGmailMessage,
} from '../lib/gmail';
import {
  CalendarEventItem,
  ConnectorId,
  CreateCalendarEventPayload,
  CreateGoogleTaskPayload,
  DriveFileItem,
  GoogleTaskItem,
  WorkspaceConnectorToggles,
  connectWorkspace,
  createCalendarEvent,
  createGoogleTask,
  disconnectWorkspace,
  formatMimeTypeLabel,
  getGoogleDocText,
  listCalendarEvents,
  listDriveFiles,
  listGoogleDocs,
  listGoogleTasks,
  readDriveFileTextPreview,
  updateGoogleTaskStatus,
} from '../lib/workspace';
import { Language, TRANSLATIONS } from '../lib/i18n';

export interface PendingGmailAction {
  mode: 'send' | 'draft';
  payload: GmailDraftPayload;
}

export type PendingWorkspaceMutation =
  | { type: 'gmail_send'; payload: GmailDraftPayload }
  | { type: 'gmail_draft'; payload: GmailDraftPayload }
  | { type: 'calendar_create'; payload: CreateCalendarEventPayload }
  | { type: 'task_create'; payload: CreateGoogleTaskPayload }
  | { type: 'task_toggle'; task: GoogleTaskItem; nextCompleted: boolean };

interface GmailConfirmActionDialogProps {
  action: PendingGmailAction | null;
  lang: Language;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function GmailConfirmActionDialog({
  action,
  lang,
  submitting,
  onCancel,
  onConfirm,
}: GmailConfirmActionDialogProps) {
  const mutation: PendingWorkspaceMutation | null = action
    ? action.mode === 'send'
      ? { type: 'gmail_send', payload: action.payload }
      : { type: 'gmail_draft', payload: action.payload }
    : null;
  return (
    <WorkspaceConfirmMutationDialog
      action={mutation}
      lang={lang}
      submitting={submitting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

interface WorkspaceConfirmMutationDialogProps {
  action: PendingWorkspaceMutation | null;
  lang: Language;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function WorkspaceConfirmMutationDialog({
  action,
  lang,
  submitting,
  onCancel,
  onConfirm,
}: WorkspaceConfirmMutationDialogProps) {
  const cText = TRANSLATIONS[lang].chat.connectors;
  const isTr = lang === 'tr';

  const getHeaderMeta = () => {
    if (!action) return null;
    switch (action.type) {
      case 'gmail_send':
        return {
          icon: <GmailIcon className="w-6 h-6 shrink-0 mt-0.5" />,
          title: cText.confirmSendTitle,
          desc: cText.confirmSendDesc,
          confirmLabel: cText.confirmSendButton,
          busyLabel: cText.sending,
        };
      case 'gmail_draft':
        return {
          icon: <GmailIcon className="w-6 h-6 shrink-0 mt-0.5" />,
          title: cText.confirmDraftTitle,
          desc: cText.confirmDraftDesc,
          confirmLabel: cText.confirmDraftButton,
          busyLabel: cText.savingDraft,
        };
      case 'calendar_create':
        return {
          icon: <GoogleCalendarIcon className="w-6 h-6 shrink-0 mt-0.5" />,
          title: isTr ? 'Bu etkinlik Google Takvim’e eklensin mi?' : 'Add this event to Google Calendar?',
          desc: isTr
            ? 'Onayladığında aşağıdaki etkinlik birincil Google Takvim hesabında oluşturulacaktır.'
            : 'Once confirmed, this event will be created on your primary Google Calendar.',
          confirmLabel: isTr ? 'Onayla ve Oluştur' : 'Confirm & Create',
          busyLabel: isTr ? 'Oluşturuluyor...' : 'Creating...',
        };
      case 'task_create':
        return {
          icon: <GoogleTasksIcon className="w-6 h-6 shrink-0 mt-0.5" />,
          title: isTr ? 'Bu görev Google Görevler’e eklensin mi?' : 'Add this task to Google Tasks?',
          desc: isTr
            ? 'Onayladığında aşağıdaki görev varsayılan Google Görevler listene eklenecektir.'
            : 'Once confirmed, this task will be added to your default Google Tasks list.',
          confirmLabel: isTr ? 'Onayla ve Ekle' : 'Confirm & Add',
          busyLabel: isTr ? 'Ekleniyor...' : 'Adding...',
        };
      case 'task_toggle':
        return {
          icon: <GoogleTasksIcon className="w-6 h-6 shrink-0 mt-0.5" />,
          title: action.nextCompleted
            ? isTr
              ? 'Görev tamamlandı olarak işaretlensin mi?'
              : 'Mark this Google Task as completed?'
            : isTr
              ? 'Görev tekrar açık duruma alınsın mı?'
              : 'Reopen this Google Task?',
          desc: isTr
            ? 'Onayladığında bu görevin durumu Google Görevler hesabında güncellenecektir.'
            : 'Once confirmed, this task status will be updated in your Google Tasks account.',
          confirmLabel: isTr ? 'Onayla ve Güncelle' : 'Confirm & Update',
          busyLabel: isTr ? 'Güncelleniyor...' : 'Updating...',
        };
    }
  };

  const meta = getHeaderMeta();

  return (
    <AnimatePresence>
      {action && meta && (
        <motion.div
          key="workspace-confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: MODAL_BACKDROP_ENTER }}
          exit={{ opacity: 0, transition: MODAL_BACKDROP_EXIT }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/58 dark:bg-black/72"
          onClick={() => {
            if (!submitting) onCancel();
          }}
        >
          <motion.div
            key="workspace-confirm-sheet"
            initial={{ opacity: 0, scale: 0.985, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: MODAL_SHEET_ENTER }}
            exit={{ opacity: 0, scale: 0.985, y: 8, transition: MODAL_SHEET_EXIT }}
            role="alertdialog"
            aria-modal="true"
            className="surface-3d-elevated w-full max-w-[460px] max-h-[88dvh] overflow-y-auto text-[var(--tx)] rounded-3xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {meta.icon}
              <div className="flex-1 min-w-0">
                <h4 className="font-serif-fraunces text-lg font-semibold leading-snug">
                  {meta.title}
                </h4>
                <p className="text-xs text-[var(--mut)] mt-1 leading-relaxed">{meta.desc}</p>
              </div>
            </div>

            <div className="border-y border-[var(--bd)]/75 py-3.5 space-y-2 text-xs">
              {(action.type === 'gmail_send' || action.type === 'gmail_draft') && (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[var(--mut)] shrink-0 w-14">{cText.toLabel}:</span>
                    <span className="font-medium text-[var(--tx)] break-all">
                      {action.payload.to || '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[var(--mut)] shrink-0 w-14">{cText.subjectLabel}:</span>
                    <span className="font-medium text-[var(--tx)] break-words">
                      {action.payload.subject || '—'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[var(--bd)]/50">
                    <p className="text-[var(--tx)]/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto text-[13px]">
                      {action.payload.body || '—'}
                    </p>
                  </div>
                </>
              )}

              {action.type === 'calendar_create' && (
                <>
                  <p className="text-[14px] font-semibold text-[var(--tx)]">
                    {action.payload.summary}
                  </p>
                  <p className="text-[var(--mut)]">
                    {new Date(action.payload.startIso).toLocaleString(isTr ? 'tr-TR' : 'en-US')} →{' '}
                    {new Date(action.payload.endIso).toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {action.payload.location && (
                    <p className="text-[var(--tx)]/85">{action.payload.location}</p>
                  )}
                  {action.payload.description && (
                    <p className="text-[var(--tx)]/85 whitespace-pre-wrap pt-1">
                      {action.payload.description}
                    </p>
                  )}
                </>
              )}

              {action.type === 'task_create' && (
                <>
                  <p className="text-[14px] font-semibold text-[var(--tx)]">
                    {action.payload.title}
                  </p>
                  {action.payload.dueDate && (
                    <p className="text-[var(--mut)]">
                      {isTr ? 'Son tarih' : 'Due'}: {action.payload.dueDate}
                    </p>
                  )}
                  {action.payload.notes && (
                    <p className="text-[var(--tx)]/85 whitespace-pre-wrap pt-1">
                      {action.payload.notes}
                    </p>
                  )}
                </>
              )}

              {action.type === 'task_toggle' && (
                <p className="text-[14px] font-semibold text-[var(--tx)]">{action.task.title}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={onCancel}
                className="px-4 py-2.5 rounded-full text-xs font-medium text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors cursor-pointer disabled:opacity-40"
              >
                {cText.cancelButton}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onConfirm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium bg-[var(--ac)] text-[var(--on)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{meta.busyLabel}</span>
                  </>
                ) : (
                  <span>{meta.confirmLabel}</span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ConnectorsModalProps {
  isOpen: boolean;
  initialConnector?: ConnectorId;
  lang: Language;
  workspaceConnected: boolean;
  workspaceEmail: string | null;
  connectorToggles: WorkspaceConnectorToggles;
  onToggleConnector: (id: ConnectorId, enabled: boolean) => void;
  onWorkspaceConnected: (email: string) => void;
  onWorkspaceDisconnected: () => void;
  onAttachContextToChat: (formattedSnippet: string) => void;
  onClose: () => void;
}

function formatShortDate(rawDate: string, lang: Language): string {
  if (!rawDate) return '';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate.slice(0, 16);
  try {
    return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'short',
      day: 'numeric',
    }).format(parsed);
  } catch {
    return rawDate.slice(0, 16);
  }
}

function formatEventDateRange(start: string, end: string, lang: Language): string {
  if (!start) return '';
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return start;
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  if (!start.includes('T')) {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', weekday: 'short' }).format(s);
  }
  const datePart = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(s);
  if (!end) return datePart;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return datePart;
  const endTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(e);
  return `${datePart} – ${endTime}`;
}

function formatSenderName(rawFrom: string): string {
  if (!rawFrom) return 'Unknown';
  const match = rawFrom.match(/^"?([^"<]+)"?\s*</);
  if (match && match[1].trim()) return match[1].trim();
  return rawFrom.replace(/[<>]/g, '').trim();
}

function extractEmailAddress(rawFrom: string): string {
  const match = rawFrom.match(/<([^>]+)>/);
  if (match && match[1]) return match[1].trim();
  return rawFrom.trim();
}

export function ConnectorsModal({
  isOpen,
  initialConnector = 'gmail',
  lang,
  workspaceConnected,
  workspaceEmail,
  connectorToggles,
  onToggleConnector,
  onWorkspaceConnected,
  onWorkspaceDisconnected,
  onAttachContextToChat,
  onClose,
}: ConnectorsModalProps) {
  const t = TRANSLATIONS[lang];
  const cText = t.chat.connectors;
  const isTr = lang === 'tr';

  const [activeConnector, setActiveConnector] = useState<ConnectorId>(initialConnector);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Gmail state
  const [gmailSubTab, setGmailSubTab] = useState<'inbox' | 'compose'>('inbox');
  const [gmailQuery, setGmailQuery] = useState('');
  const [gmailMessages, setGmailMessages] = useState<GmailMessageSummary[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [toField, setToField] = useState('');
  const [subjectField, setSubjectField] = useState('');
  const [bodyField, setBodyField] = useState('');

  // Calendar state
  const [calendarSubTab, setCalendarSubTab] = useState<'upcoming' | 'new'>('upcoming');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [evSummary, setEvSummary] = useState('');
  const [evDate, setEvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [evStartTime, setEvStartTime] = useState('10:00');
  const [evEndTime, setEvEndTime] = useState('11:00');
  const [evLocation, setEvLocation] = useState('');
  const [evNotes, setEvNotes] = useState('');

  // Drive state
  const [driveQuery, setDriveQuery] = useState('');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [attachingDriveId, setAttachingDriveId] = useState<string | null>(null);

  // Docs state
  const [docsQuery, setDocsQuery] = useState('');
  const [docFiles, setDocFiles] = useState<DriveFileItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [docPreviews, setDocPreviews] = useState<Record<string, string>>({});
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Tasks state
  const [tasksList, setTasksList] = useState<GoogleTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // Mandatory explicit confirmation state for ALL mutating Workspace API calls
  const [pendingMutation, setPendingMutation] = useState<PendingWorkspaceMutation | null>(null);
  const [executingMutation, setExecutingMutation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveConnector(initialConnector);
    }
  }, [isOpen, initialConnector]);

  const handleSessionError = useCallback(
    (err: any) => {
      if (
        err?.code === 'GMAIL_TOKEN_EXPIRED' ||
        err?.code === 'GMAIL_AUTH_REQUIRED' ||
        err?.code === 'WORKSPACE_TOKEN_EXPIRED' ||
        err?.code === 'WORKSPACE_AUTH_REQUIRED'
      ) {
        onWorkspaceDisconnected();
        setErrorMsg(
          isTr
            ? 'Google Workspace oturumunun süresi doldu. Lütfen tekrar bağlan.'
            : 'Your Google Workspace session expired. Please reconnect.'
        );
      } else {
        setErrorMsg(err?.message || cText.connectFailed);
      }
    },
    [onWorkspaceDisconnected, isTr, cText.connectFailed]
  );

  const loadGmail = useCallback(
    async (qOverride?: string) => {
      if (!workspaceConnected) return;
      setLoadingGmail(true);
      setErrorMsg(null);
      try {
        const q = qOverride !== undefined ? qOverride : gmailQuery;
        const list = await listGmailMessages({ query: q || 'in:inbox', maxResults: 10 });
        setGmailMessages(list);
      } catch (err) {
        handleSessionError(err);
      } finally {
        setLoadingGmail(false);
      }
    },
    [workspaceConnected, gmailQuery, handleSessionError]
  );

  const loadCalendar = useCallback(async () => {
    if (!workspaceConnected) return;
    setLoadingCalendar(true);
    setErrorMsg(null);
    try {
      const items = await listCalendarEvents(12);
      setCalendarEvents(items);
    } catch (err) {
      handleSessionError(err);
    } finally {
      setLoadingCalendar(false);
    }
  }, [workspaceConnected, handleSessionError]);

  const loadDrive = useCallback(
    async (qOverride?: string) => {
      if (!workspaceConnected) return;
      setLoadingDrive(true);
      setErrorMsg(null);
      try {
        const q = qOverride !== undefined ? qOverride : driveQuery;
        const files = await listDriveFiles({ query: q, maxResults: 12 });
        setDriveFiles(files);
      } catch (err) {
        handleSessionError(err);
      } finally {
        setLoadingDrive(false);
      }
    },
    [workspaceConnected, driveQuery, handleSessionError]
  );

  const loadDocs = useCallback(
    async (qOverride?: string) => {
      if (!workspaceConnected) return;
      setLoadingDocs(true);
      setErrorMsg(null);
      try {
        const q = qOverride !== undefined ? qOverride : docsQuery;
        const files = await listGoogleDocs({ query: q, maxResults: 10 });
        setDocFiles(files);
      } catch (err) {
        handleSessionError(err);
      } finally {
        setLoadingDocs(false);
      }
    },
    [workspaceConnected, docsQuery, handleSessionError]
  );

  const loadTasks = useCallback(async () => {
    if (!workspaceConnected) return;
    setLoadingTasks(true);
    setErrorMsg(null);
    try {
      const list = await listGoogleTasks(18);
      setTasksList(list);
    } catch (err) {
      handleSessionError(err);
    } finally {
      setLoadingTasks(false);
    }
  }, [workspaceConnected, handleSessionError]);

  useEffect(() => {
    if (!isOpen || !workspaceConnected) return;
    setStatusMsg(null);
    setErrorMsg(null);
    if (activeConnector === 'gmail' && gmailSubTab === 'inbox') {
      void loadGmail();
    } else if (activeConnector === 'calendar' && calendarSubTab === 'upcoming') {
      void loadCalendar();
    } else if (activeConnector === 'drive') {
      void loadDrive();
    } else if (activeConnector === 'docs') {
      void loadDocs();
    } else if (activeConnector === 'tasks') {
      void loadTasks();
    }
  }, [isOpen, workspaceConnected, activeConnector, gmailSubTab, calendarSubTab]);

  const handleConnect = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setConnecting(true);
    try {
      const { emailAddress } = await connectWorkspace();
      onWorkspaceConnected(emailAddress);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err?.message || cText.connectFailed);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectWorkspace();
    setGmailMessages([]);
    setCalendarEvents([]);
    setDriveFiles([]);
    setDocFiles([]);
    setTasksList([]);
    setDocPreviews({});
    setErrorMsg(null);
    setStatusMsg(null);
    onWorkspaceDisconnected();
  };

  const handleExpandDoc = async (docFile: DriveFileItem) => {
    if (expandedDocId === docFile.id) {
      setExpandedDocId(null);
      return;
    }
    setExpandedDocId(docFile.id);
    if (docPreviews[docFile.id] !== undefined) return;
    setLoadingDocId(docFile.id);
    try {
      const text = await getGoogleDocText(docFile.id);
      setDocPreviews((prev) => ({ ...prev, [docFile.id]: text }));
    } catch (err) {
      handleSessionError(err);
    } finally {
      setLoadingDocId(null);
    }
  };

  const handleAttachDriveFile = async (file: DriveFileItem) => {
    setAttachingDriveId(file.id);
    try {
      const preview = await readDriveFileTextPreview(file);
      const header = `[Google Drive · ${file.name}] (${formatMimeTypeLabel(file.mimeType, lang)})`;
      const snippet = preview
        ? `${header}\n\n${preview.slice(0, 4500)}\n\n`
        : `${header}${file.webViewLink ? `\nLink: ${file.webViewLink}` : ''}\n\n`;
      onAttachContextToChat(snippet);
      onClose();
    } finally {
      setAttachingDriveId(null);
    }
  };

  const handleConfirmMutation = async () => {
    if (!pendingMutation) return;
    setExecutingMutation(true);
    setErrorMsg(null);
    try {
      switch (pendingMutation.type) {
        case 'gmail_send':
          await sendGmailMessage(pendingMutation.payload);
          setToField('');
          setSubjectField('');
          setBodyField('');
          setStatusMsg(cText.sentSuccess);
          break;
        case 'gmail_draft':
          await createGmailDraft(pendingMutation.payload);
          setToField('');
          setSubjectField('');
          setBodyField('');
          setStatusMsg(cText.draftSavedSuccess);
          break;
        case 'calendar_create':
          await createCalendarEvent(pendingMutation.payload);
          setEvSummary('');
          setEvLocation('');
          setEvNotes('');
          setCalendarSubTab('upcoming');
          setStatusMsg(
            isTr ? 'Etkinlik Google Takvim’e eklendi.' : 'Event added to Google Calendar.'
          );
          void loadCalendar();
          break;
        case 'task_create':
          await createGoogleTask(pendingMutation.payload);
          setNewTaskTitle('');
          setNewTaskDue('');
          setNewTaskNotes('');
          setStatusMsg(isTr ? 'Görev Google Görevler’e eklendi.' : 'Task added to Google Tasks.');
          void loadTasks();
          break;
        case 'task_toggle': {
          const updated = await updateGoogleTaskStatus(
            pendingMutation.task,
            pendingMutation.nextCompleted
          );
          setTasksList((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));
          setStatusMsg(
            isTr ? 'Görev durumu güncellendi.' : 'Task status updated.'
          );
          break;
        }
      }
      setPendingMutation(null);
    } catch (err) {
      handleSessionError(err);
      setPendingMutation(null);
    } finally {
      setExecutingMutation(false);
    }
  };

  const connectorsMeta: Array<{
    id: ConnectorId;
    name: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'gmail',
      name: 'Gmail',
      desc: cText.gmailDesc,
      icon: <GmailIcon className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'calendar',
      name: isTr ? 'Takvim' : 'Calendar',
      desc: isTr
        ? 'Yaklaşan etkinliklerini görüntüle, sohbete ekle ve onayınla yeni toplantı oluştur.'
        : 'View upcoming events, bring schedules into chat, and create events with your confirmation.',
      icon: <GoogleCalendarIcon className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'drive',
      name: 'Drive',
      desc: isTr
        ? 'Google Drive dosyalarını ara, incele ve metin içeriklerini doğrudan sohbete aktar.'
        : 'Search your Google Drive files and attach file details or text previews directly into chat.',
      icon: <GoogleDriveIcon className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'docs',
      name: isTr ? 'Dokümanlar' : 'Docs',
      desc: isTr
        ? 'Google Dokümanlar belgelerini okuyup özetlemek veya düzenlemek için sohbete ekle.'
        : 'Browse and read your Google Docs text inline or pull full documents into chat.',
      icon: <GoogleDocsIcon className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'tasks',
      name: isTr ? 'Görevler' : 'Tasks',
      desc: isTr
        ? 'Yapılacaklar listeni takip et, onayınla yeni görev ekle veya tamamlandı olarak işaretle.'
        : 'Review your to-do lists, add new tasks, and mark items complete with your confirmation.',
      icon: <GoogleTasksIcon className="w-5 h-5 shrink-0" />,
    },
  ];

  const activeMeta = connectorsMeta.find((c) => c.id === activeConnector) || connectorsMeta[0];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="connectors-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: MODAL_BACKDROP_ENTER }}
            exit={{ opacity: 0, transition: MODAL_BACKDROP_EXIT }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/52 dark:bg-black/68"
            onClick={onClose}
          >
            <motion.div
              key="connectors-modal-sheet"
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.985, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: MODAL_SHEET_ENTER }}
              exit={{ opacity: 0, scale: 0.985, y: 8, transition: MODAL_SHEET_EXIT }}
              className="surface-3d-elevated w-full max-w-[640px] max-h-[90dvh] flex flex-col text-[var(--tx)] rounded-3xl sm:rounded-[28px] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-4 sm:px-7 sm:pt-6 border-b border-[var(--bd)]/70 flex items-start justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <h3 className="font-serif-fraunces text-xl sm:text-2xl font-semibold tracking-tight">
                      {cText.title}
                    </h3>
                    <span
                      className={`text-xs ${
                        workspaceConnected
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-[var(--mut)]'
                      }`}
                    >
                      {workspaceConnected && workspaceEmail
                        ? `· ${workspaceEmail}`
                        : `· 5 ${isTr ? 'Google aracı' : 'Google tools'}`}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[var(--mut)] mt-1 leading-relaxed">
                    {cText.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {workspaceConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      title={cText.disconnect}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--mut)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{cText.disconnect}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-10 h-10 -mr-1.5 flex items-center justify-center rounded-full hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] transition-colors cursor-pointer"
                    aria-label={t.common.close}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 5-Connector Selector Bar — Open Underline Tabs */}
              <div className="px-5 sm:px-7 border-b border-[var(--bd)]/70 shrink-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-5 w-max">
                  {connectorsMeta.map((conn) => {
                    const isSelected = activeConnector === conn.id;
                    const isOn = workspaceConnected && connectorToggles[conn.id];
                    return (
                      <button
                        key={conn.id}
                        type="button"
                        onClick={() => {
                          setActiveConnector(conn.id);
                          setErrorMsg(null);
                          setStatusMsg(null);
                        }}
                        className={`inline-flex items-center gap-2 py-3 border-b-2 -mb-[1px] text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[var(--tx)] text-[var(--tx)] font-semibold'
                            : 'border-transparent text-[var(--mut)] hover:text-[var(--tx)]'
                        }`}
                      >
                        <span className="shrink-0">{conn.icon}</span>
                        <span>{conn.name}</span>
                        {isOn && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-5">
                {/* Active Connector Info + Connect CTA */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5">{activeMeta.icon}</div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold text-[var(--tx)]">
                          {activeMeta.name}
                        </h4>
                        <p className="text-xs text-[var(--mut)] mt-0.5 leading-relaxed">
                          {activeMeta.desc}
                        </p>
                      </div>
                    </div>

                    {workspaceConnected && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={connectorToggles[activeConnector]}
                        aria-label={cText.useInChatLabel}
                        onClick={() =>
                          onToggleConnector(activeConnector, !connectorToggles[activeConnector])
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer mt-0.5 ${
                          connectorToggles[activeConnector] ? 'bg-emerald-500' : 'bg-[var(--bd)]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-xs transition-transform ${
                            connectorToggles[activeConnector]
                              ? 'translate-x-5.5'
                              : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Single Official Google Sign-In button connecting all 5 connectors */}
                  {!workspaceConnected && (
                    <div className="pt-1 space-y-3">
                      <button
                        type="button"
                        disabled={connecting}
                        onClick={handleConnect}
                        className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-full bg-white text-[#1f1f1f] border border-[#747775]/40 hover:bg-[#f8fafd] active:scale-[0.99] shadow-xs text-sm font-medium transition-all cursor-pointer disabled:opacity-60"
                      >
                        {connecting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#4285F4]" />
                        ) : (
                          <GoogleIcon className="w-4.5 h-4.5 shrink-0" />
                        )}
                        <span>{connecting ? cText.connecting : cText.signInWithGoogle}</span>
                      </button>
                      <p className="text-[11px] text-[var(--mut)] leading-relaxed">
                        {isTr
                          ? 'Tek girişle Gmail, Takvim, Drive, Dokümanlar ve Görevler bağlayıcılarını etkinleştirebilir, istediğini sohbet için açıp kapatabilirsin.'
                          : 'One sign-in connects Gmail, Calendar, Drive, Docs, and Tasks—toggle any tool on or off for chat anytime.'}
                      </p>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/8 border border-red-500/20 rounded-2xl px-3.5 py-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{errorMsg}</span>
                    </div>
                  )}

                  {statusMsg && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-3.5 py-2.5">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{statusMsg}</span>
                    </div>
                  )}
                </div>

                {/* Connected Connector Workspaces */}
                {workspaceConnected && (
                  <div className="pt-4 border-t border-[var(--bd)]/70 space-y-4">
                    {/* 1. GMAIL */}
                    {activeConnector === 'gmail' && (
                      <>
                        <div className="flex items-center gap-5 border-b border-[var(--bd)]/70 text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => setGmailSubTab('inbox')}
                            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                              gmailSubTab === 'inbox'
                                ? 'border-[var(--tx)] text-[var(--tx)]'
                                : 'border-transparent text-[var(--mut)] hover:text-[var(--tx)]'
                            }`}
                          >
                            {cText.inboxTab}
                          </button>
                          <button
                            type="button"
                            onClick={() => setGmailSubTab('compose')}
                            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                              gmailSubTab === 'compose'
                                ? 'border-[var(--tx)] text-[var(--tx)]'
                                : 'border-transparent text-[var(--mut)] hover:text-[var(--tx)]'
                            }`}
                          >
                            {cText.composeTab}
                          </button>
                        </div>

                        {gmailSubTab === 'inbox' ? (
                          <div className="space-y-3">
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                void loadGmail(gmailQuery);
                              }}
                              className="flex items-center gap-2"
                            >
                              <div className="relative flex-1 min-w-0">
                                <Search className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="text"
                                  value={gmailQuery}
                                  onChange={(e) => setGmailQuery(e.target.value)}
                                  placeholder={cText.searchPlaceholder}
                                  className="w-full pl-9.5 pr-3 py-2.5 sm:py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] placeholder:text-[var(--mut)] outline-none transition-colors"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={loadingGmail}
                                className="px-3.5 py-2.5 sm:py-2 rounded-2xl bg-[var(--ac)] text-[var(--on)] text-xs font-medium hover:opacity-90 cursor-pointer shrink-0 disabled:opacity-50"
                              >
                                {cText.searchButton}
                              </button>
                              <button
                                type="button"
                                disabled={loadingGmail}
                                onClick={() => void loadGmail()}
                                title={cText.refreshTitle}
                                className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-2xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer shrink-0"
                              >
                                <RefreshCw className={`w-4 h-4 ${loadingGmail ? 'animate-spin' : ''}`} />
                              </button>
                            </form>

                            {loadingGmail && gmailMessages.length === 0 ? (
                              <div className="py-10 text-center text-xs text-[var(--mut)] flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{cText.loadingInbox}</span>
                              </div>
                            ) : gmailMessages.length === 0 ? (
                              <div className="py-10 text-center text-xs text-[var(--mut)]">
                                {cText.emptyInbox}
                              </div>
                            ) : (
                              <div className="divide-y divide-[var(--bd)]/60">
                                {gmailMessages.map((msg) => {
                                  const isExpanded = expandedEmailId === msg.id;
                                  return (
                                    <div key={msg.id} className="py-3 first:pt-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedEmailId((prev) =>
                                            prev === msg.id ? null : msg.id
                                          )
                                        }
                                        className="w-full text-left cursor-pointer"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {msg.unread && (
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                            )}
                                            <span
                                              className={`text-xs truncate ${
                                                msg.unread
                                                  ? 'font-semibold text-[var(--tx)]'
                                                  : 'font-medium text-[var(--tx)]/90'
                                              }`}
                                            >
                                              {formatSenderName(msg.from)}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[11px] text-[var(--mut)]">
                                              {formatShortDate(msg.date, lang)}
                                            </span>
                                            <ChevronDown
                                              className={`w-3.5 h-3.5 text-[var(--mut)] transition-transform ${
                                                isExpanded ? 'rotate-180' : ''
                                              }`}
                                            />
                                          </div>
                                        </div>
                                        <p className="text-[13px] mt-0.5 truncate font-medium text-[var(--tx)]">
                                          {msg.subject}
                                        </p>
                                        {!isExpanded && (
                                          <p className="text-xs text-[var(--mut)] mt-0.5 line-clamp-1">
                                            {msg.snippet}
                                          </p>
                                        )}
                                      </button>

                                      {isExpanded && (
                                        <div className="mt-2.5 pt-2.5 border-t border-[var(--bd)]/45 space-y-3">
                                          <p className="text-xs text-[var(--tx)]/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                            {msg.body}
                                          </p>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                onAttachContextToChat(
                                                  `[Gmail · ${msg.subject}]\nFrom: ${msg.from}\nDate: ${msg.date}\n\n${msg.body.slice(0, 4000)}\n\n`
                                                );
                                                onClose();
                                              }}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ac)] text-[var(--on)] text-xs font-medium hover:opacity-90 cursor-pointer"
                                            >
                                              <MessageSquarePlus className="w-3.5 h-3.5" />
                                              <span>{cText.attachToChat}</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setToField(extractEmailAddress(msg.from));
                                                setSubjectField(
                                                  msg.subject.toLowerCase().startsWith('re:')
                                                    ? msg.subject
                                                    : `Re: ${msg.subject}`
                                                );
                                                setBodyField('');
                                                setGmailSubTab('compose');
                                              }}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surf)] text-[var(--tx)] text-xs font-medium hover:bg-[var(--bd)]/60 cursor-pointer"
                                            >
                                              <Reply className="w-3.5 h-3.5" />
                                              <span>{cText.replyButton}</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-[var(--mut)]">
                                {cText.toLabel}
                              </label>
                              <input
                                type="email"
                                value={toField}
                                onChange={(e) => setToField(e.target.value)}
                                placeholder={cText.toPlaceholder}
                                className="w-full px-3.5 py-2.5 sm:py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-[var(--mut)]">
                                {cText.subjectLabel}
                              </label>
                              <input
                                type="text"
                                value={subjectField}
                                onChange={(e) => setSubjectField(e.target.value)}
                                placeholder={cText.subjectPlaceholder}
                                className="w-full px-3.5 py-2.5 sm:py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-[var(--mut)]">
                                {cText.bodyLabel}
                              </label>
                              <textarea
                                rows={4}
                                value={bodyField}
                                onChange={(e) => setBodyField(e.target.value)}
                                placeholder={cText.bodyPlaceholder}
                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] outline-none resize-y leading-relaxed"
                              />
                            </div>
                            <div className="flex flex-wrap justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!toField.trim() || (!subjectField.trim() && !bodyField.trim())) {
                                    setErrorMsg(cText.missingFieldsError);
                                    return;
                                  }
                                  setPendingMutation({
                                    type: 'gmail_draft',
                                    payload: {
                                      to: toField.trim(),
                                      subject: subjectField.trim(),
                                      body: bodyField.trim(),
                                    },
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--surf)] text-[var(--tx)] text-xs font-medium hover:bg-[var(--bd)]/60 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{cText.saveDraftButton}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!toField.trim() || (!subjectField.trim() && !bodyField.trim())) {
                                    setErrorMsg(cText.missingFieldsError);
                                    return;
                                  }
                                  setPendingMutation({
                                    type: 'gmail_send',
                                    payload: {
                                      to: toField.trim(),
                                      subject: subjectField.trim(),
                                      body: bodyField.trim(),
                                    },
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--ac)] text-[var(--on)] text-xs font-medium hover:opacity-90 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{cText.sendEmailButton}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* 2. GOOGLE CALENDAR */}
                    {activeConnector === 'calendar' && (
                      <>
                        <div className="flex items-center justify-between border-b border-[var(--bd)]/70">
                          <div className="flex items-center gap-5 text-xs font-medium">
                            <button
                              type="button"
                              onClick={() => setCalendarSubTab('upcoming')}
                              className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                                calendarSubTab === 'upcoming'
                                  ? 'border-[var(--tx)] text-[var(--tx)]'
                                  : 'border-transparent text-[var(--mut)] hover:text-[var(--tx)]'
                              }`}
                            >
                              {isTr ? 'Yaklaşan Etkinlikler' : 'Upcoming Events'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCalendarSubTab('new')}
                              className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                                calendarSubTab === 'new'
                                  ? 'border-[var(--tx)] text-[var(--tx)]'
                                  : 'border-transparent text-[var(--mut)] hover:text-[var(--tx)]'
                              }`}
                            >
                              {isTr ? 'Yeni Etkinlik' : 'New Event'}
                            </button>
                          </div>
                          {calendarSubTab === 'upcoming' && (
                            <button
                              type="button"
                              disabled={loadingCalendar}
                              onClick={() => void loadCalendar()}
                              className="p-2 mb-1 rounded-xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer"
                              title={cText.refreshTitle}
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${loadingCalendar ? 'animate-spin' : ''}`}
                              />
                            </button>
                          )}
                        </div>

                        {calendarSubTab === 'upcoming' ? (
                          loadingCalendar && calendarEvents.length === 0 ? (
                            <div className="py-10 text-center text-xs text-[var(--mut)] flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{isTr ? 'Etkinlikler yükleniyor...' : 'Loading events...'}</span>
                            </div>
                          ) : calendarEvents.length === 0 ? (
                            <div className="py-10 text-center text-xs text-[var(--mut)]">
                              {isTr
                                ? 'Yaklaşan takvim etkinliği bulunamadı.'
                                : 'No upcoming calendar events found.'}
                            </div>
                          ) : (
                            <div className="divide-y divide-[var(--bd)]/60">
                              {calendarEvents.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="py-3 first:pt-1 flex items-start justify-between gap-3"
                                >
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-[13.5px] font-medium text-[var(--tx)] truncate">
                                      {ev.summary}
                                    </p>
                                    <p className="text-xs text-[var(--mut)] flex items-center gap-1.5">
                                      <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                                      <span>{formatEventDateRange(ev.start, ev.end, lang)}</span>
                                    </p>
                                    {ev.location && (
                                      <p className="text-xs text-[var(--mut)] flex items-center gap-1.5 truncate">
                                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">{ev.location}</span>
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onAttachContextToChat(
                                        `[Google Calendar · ${ev.summary}]\nTime: ${ev.start}${ev.end ? ` - ${ev.end}` : ''}${ev.location ? `\nLocation: ${ev.location}` : ''}${ev.description ? `\nNotes: ${ev.description}` : ''}\n\n`
                                      );
                                      onClose();
                                    }}
                                    className="px-3 py-1.5 rounded-full bg-[var(--surf)] hover:bg-[var(--bd)]/70 text-[var(--tx)] text-xs font-medium shrink-0 cursor-pointer"
                                  >
                                    {cText.attachToChat}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-[var(--mut)]">
                                {isTr ? 'Etkinlik başlığı' : 'Event title'}
                              </label>
                              <input
                                type="text"
                                value={evSummary}
                                onChange={(e) => setEvSummary(e.target.value)}
                                placeholder={isTr ? 'Örn. Ürün planlama toplantısı' : 'e.g. Product planning sync'}
                                className="w-full px-3.5 py-2.5 sm:py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-[var(--mut)]">
                                  {isTr ? 'Tarih' : 'Date'}
                                </label>
                                <input
                                  type="date"
                                  value={evDate}
                                  onChange={(e) => setEvDate(e.target.value)}
                                  className="w-full px-3 py-2 rounded-2xl bg-[var(--surf)]/80 text-base sm:text-xs text-[var(--tx)] outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-[var(--mut)]">
                                  {isTr ? 'Başlangıç' : 'Start'}
                                </label>
                                <input
                                  type="time"
                                  value={evStartTime}
                                  onChange={(e) => setEvStartTime(e.target.value)}
                                  className="w-full px-3 py-2 rounded-2xl bg-[var(--surf)]/80 text-base sm:text-xs text-[var(--tx)] outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-[var(--mut)]">
                                  {isTr ? 'Bitiş' : 'End'}
                                </label>
                                <input
                                  type="time"
                                  value={evEndTime}
                                  onChange={(e) => setEvEndTime(e.target.value)}
                                  className="w-full px-3 py-2 rounded-2xl bg-[var(--surf)]/80 text-base sm:text-xs text-[var(--tx)] outline-none"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-[var(--mut)]">
                                {isTr ? 'Konum (isteğe bağlı)' : 'Location (optional)'}
                              </label>
                              <input
                                type="text"
                                value={evLocation}
                                onChange={(e) => setEvLocation(e.target.value)}
                                placeholder={isTr ? 'Ofis veya toplantı bağlantısı' : 'Office or meeting link'}
                                className="w-full px-3.5 py-2.5 sm:py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-[var(--mut)]">
                                {isTr ? 'Notlar (isteğe bağlı)' : 'Notes (optional)'}
                              </label>
                              <textarea
                                rows={2}
                                value={evNotes}
                                onChange={(e) => setEvNotes(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] outline-none resize-none"
                              />
                            </div>
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!evSummary.trim() || !evDate) {
                                    setErrorMsg(
                                      isTr
                                        ? 'Lütfen etkinlik başlığı ve tarih gir.'
                                        : 'Please enter an event title and date.'
                                    );
                                    return;
                                  }
                                  const startIso = new Date(`${evDate}T${evStartTime || '09:00'}:00`).toISOString();
                                  const endIso = new Date(`${evDate}T${evEndTime || '10:00'}:00`).toISOString();
                                  setPendingMutation({
                                    type: 'calendar_create',
                                    payload: {
                                      summary: evSummary.trim(),
                                      startIso,
                                      endIso,
                                      location: evLocation.trim(),
                                      description: evNotes.trim(),
                                    },
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--ac)] text-[var(--on)] text-xs font-medium hover:opacity-90 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isTr ? 'Etkinlik Oluştur' : 'Create Event'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* 3. GOOGLE DRIVE */}
                    {activeConnector === 'drive' && (
                      <div className="space-y-3">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void loadDrive(driveQuery);
                          }}
                          className="flex items-center gap-2"
                        >
                          <div className="relative flex-1 min-w-0">
                            <Search className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={driveQuery}
                              onChange={(e) => setDriveQuery(e.target.value)}
                              placeholder={
                                isTr ? 'Drive dosyalarında ara...' : 'Search Google Drive files...'
                              }
                              className="w-full pl-9.5 pr-3 py-2.5 sm:py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] placeholder:text-[var(--mut)] outline-none"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loadingDrive}
                            className="px-3.5 py-2.5 sm:py-2 rounded-2xl bg-[var(--ac)] text-[var(--on)] text-xs font-medium hover:opacity-90 cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            {cText.searchButton}
                          </button>
                          <button
                            type="button"
                            disabled={loadingDrive}
                            onClick={() => void loadDrive()}
                            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-2xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer shrink-0"
                          >
                            <RefreshCw className={`w-4 h-4 ${loadingDrive ? 'animate-spin' : ''}`} />
                          </button>
                        </form>

                        {loadingDrive && driveFiles.length === 0 ? (
                          <div className="py-10 text-center text-xs text-[var(--mut)] flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{isTr ? 'Dosyalar yükleniyor...' : 'Loading Drive files...'}</span>
                          </div>
                        ) : driveFiles.length === 0 ? (
                          <div className="py-10 text-center text-xs text-[var(--mut)]">
                            {isTr ? 'Eşleşen Drive dosyası bulunamadı.' : 'No Drive files found.'}
                          </div>
                        ) : (
                          <div className="divide-y divide-[var(--bd)]/60">
                            {driveFiles.map((file) => (
                              <div
                                key={file.id}
                                className="py-3 first:pt-1 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13.5px] font-medium text-[var(--tx)] truncate">
                                    {file.name}
                                  </p>
                                  <p className="text-[11px] text-[var(--mut)] mt-0.5">
                                    {formatMimeTypeLabel(file.mimeType, lang)} ·{' '}
                                    {formatShortDate(file.modifiedTime, lang)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {file.webViewLink && /^https?:\/\//i.test(file.webViewLink.trim()) && (
                                    <a
                                      href={file.webViewLink.trim()}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 rounded-full text-[var(--mut)] hover:text-[var(--tx)] hover:bg-[var(--surf)] transition-colors"
                                      title={isTr ? 'Drive’da aç' : 'Open in Drive'}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    disabled={attachingDriveId === file.id}
                                    onClick={() => void handleAttachDriveFile(file)}
                                    className="px-3 py-1.5 rounded-full bg-[var(--surf)] hover:bg-[var(--bd)]/70 text-[var(--tx)] text-xs font-medium cursor-pointer disabled:opacity-50"
                                  >
                                    {attachingDriveId === file.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      cText.attachToChat
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. GOOGLE DOCS */}
                    {activeConnector === 'docs' && (
                      <div className="space-y-3">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void loadDocs(docsQuery);
                          }}
                          className="flex items-center gap-2"
                        >
                          <div className="relative flex-1 min-w-0">
                            <Search className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={docsQuery}
                              onChange={(e) => setDocsQuery(e.target.value)}
                              placeholder={
                                isTr ? 'Google Dokümanlarda ara...' : 'Search Google Docs...'
                              }
                              className="w-full pl-9.5 pr-3 py-2.5 sm:py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] placeholder:text-[var(--mut)] outline-none"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loadingDocs}
                            className="px-3.5 py-2.5 sm:py-2 rounded-2xl bg-[var(--ac)] text-[var(--on)] text-xs font-medium hover:opacity-90 cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            {cText.searchButton}
                          </button>
                          <button
                            type="button"
                            disabled={loadingDocs}
                            onClick={() => void loadDocs()}
                            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-2xl hover:bg-[var(--surf)] text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer shrink-0"
                          >
                            <RefreshCw className={`w-4 h-4 ${loadingDocs ? 'animate-spin' : ''}`} />
                          </button>
                        </form>

                        {loadingDocs && docFiles.length === 0 ? (
                          <div className="py-10 text-center text-xs text-[var(--mut)] flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>
                              {isTr ? 'Dokümanlar yükleniyor...' : 'Loading Google Docs...'}
                            </span>
                          </div>
                        ) : docFiles.length === 0 ? (
                          <div className="py-10 text-center text-xs text-[var(--mut)]">
                            {isTr ? 'Google Doküman bulunamadı.' : 'No Google Docs found.'}
                          </div>
                        ) : (
                          <div className="divide-y divide-[var(--bd)]/60">
                            {docFiles.map((docItem) => {
                              const isExpanded = expandedDocId === docItem.id;
                              const content = docPreviews[docItem.id];
                              const isLoadingThis = loadingDocId === docItem.id;
                              return (
                                <div key={docItem.id} className="py-3 first:pt-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleExpandDoc(docItem)}
                                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[13.5px] font-medium text-[var(--tx)] truncate">
                                        {docItem.name}
                                      </p>
                                      <p className="text-[11px] text-[var(--mut)] mt-0.5">
                                        {formatShortDate(docItem.modifiedTime, lang)}
                                      </p>
                                    </div>
                                    <ChevronDown
                                      className={`w-4 h-4 text-[var(--mut)] shrink-0 transition-transform ${
                                        isExpanded ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>

                                  {isExpanded && (
                                    <div className="mt-2.5 pt-2.5 border-t border-[var(--bd)]/45 space-y-3">
                                      {isLoadingThis ? (
                                        <div className="flex items-center gap-2 text-xs text-[var(--mut)] py-2">
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          <span>
                                            {isTr ? 'Belge okunuyor...' : 'Reading document...'}
                                          </span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-[var(--tx)]/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                          {content ||
                                            (isTr ? '(Belge boş)' : '(Document is empty)')}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          disabled={isLoadingThis}
                                          onClick={() => {
                                            onAttachContextToChat(
                                              `[Google Docs · ${docItem.name}]\n\n${(content || '').slice(0, 5000)}\n\n`
                                            );
                                            onClose();
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ac)] text-[var(--on)] text-xs font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
                                        >
                                          <MessageSquarePlus className="w-3.5 h-3.5" />
                                          <span>{cText.attachToChat}</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5. GOOGLE TASKS */}
                    {activeConnector === 'tasks' && (
                      <div className="space-y-4">
                        {/* New Task Inline Form */}
                        <div className="space-y-2 pb-3 border-b border-[var(--bd)]/65">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              placeholder={
                                isTr ? 'Yeni görev ekle...' : 'Add a new Google Task...'
                              }
                              className="flex-1 px-3.5 py-2.5 sm:py-2 rounded-2xl bg-[var(--surf)]/80 border border-transparent focus:border-[var(--bd)] focus:bg-[var(--bg)] text-base sm:text-xs text-[var(--tx)] placeholder:text-[var(--mut)] outline-none"
                            />
                            <input
                              type="date"
                              value={newTaskDue}
                              onChange={(e) => setNewTaskDue(e.target.value)}
                              className="px-3 py-2 rounded-2xl bg-[var(--surf)]/80 text-base sm:text-xs text-[var(--tx)] outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!newTaskTitle.trim()) return;
                                setPendingMutation({
                                  type: 'task_create',
                                  payload: {
                                    title: newTaskTitle.trim(),
                                    dueDate: newTaskDue || undefined,
                                    notes: newTaskNotes.trim() || undefined,
                                  },
                                });
                              }}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-2xl bg-[var(--ac)] text-[var(--on)] text-xs font-medium hover:opacity-90 cursor-pointer shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isTr ? 'Ekle' : 'Add'}</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={newTaskNotes}
                            onChange={(e) => setNewTaskNotes(e.target.value)}
                            placeholder={isTr ? 'Not (isteğe bağlı)' : 'Notes (optional)'}
                            className="w-full px-3.5 py-2 rounded-2xl bg-[var(--surf)]/60 text-base sm:text-xs text-[var(--tx)] placeholder:text-[var(--mut)] outline-none"
                          />
                        </div>

                        {loadingTasks && tasksList.length === 0 ? (
                          <div className="py-8 text-center text-xs text-[var(--mut)] flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{isTr ? 'Görevler yükleniyor...' : 'Loading tasks...'}</span>
                          </div>
                        ) : tasksList.length === 0 ? (
                          <div className="py-8 text-center text-xs text-[var(--mut)]">
                            {isTr ? 'Henüz görev bulunmuyor.' : 'No tasks found.'}
                          </div>
                        ) : (
                          <div className="divide-y divide-[var(--bd)]/60">
                            {tasksList.map((tk) => {
                              const isDone = tk.status === 'completed';
                              return (
                                <div
                                  key={tk.id}
                                  className="py-3 first:pt-1 flex items-start justify-between gap-3"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingMutation({
                                        type: 'task_toggle',
                                        task: tk,
                                        nextCompleted: !isDone,
                                      })
                                    }
                                    className="flex items-start gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
                                  >
                                    {isDone ? (
                                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                                    ) : (
                                      <Circle className="w-4.5 h-4.5 text-[var(--mut)] group-hover:text-[var(--tx)] shrink-0 mt-0.5" />
                                    )}
                                    <div className="min-w-0">
                                      <p
                                        className={`text-[13.5px] font-medium ${
                                          isDone
                                            ? 'line-through text-[var(--mut)]'
                                            : 'text-[var(--tx)]'
                                        }`}
                                      >
                                        {tk.title}
                                      </p>
                                      {(tk.due || tk.notes) && (
                                        <p className="text-xs text-[var(--mut)] mt-0.5 line-clamp-1">
                                          {tk.due ? formatShortDate(tk.due, lang) : ''}
                                          {tk.due && tk.notes ? ' · ' : ''}
                                          {tk.notes}
                                        </p>
                                      )}
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      onAttachContextToChat(
                                        `[Google Tasks · ${tk.title}]\nStatus: ${tk.status}${tk.due ? `\nDue: ${tk.due}` : ''}${tk.notes ? `\nNotes: ${tk.notes}` : ''}\n\n`
                                      );
                                      onClose();
                                    }}
                                    className="px-3 py-1.5 rounded-full bg-[var(--surf)] hover:bg-[var(--bd)]/70 text-[var(--tx)] text-xs font-medium shrink-0 cursor-pointer"
                                  >
                                    {cText.attachToChat}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mandatory Explicit Confirmation Dialog for ALL Workspace Mutations */}
      <WorkspaceConfirmMutationDialog
        action={pendingMutation}
        lang={lang}
        submitting={executingMutation}
        onCancel={() => setPendingMutation(null)}
        onConfirm={handleConfirmMutation}
      />
    </>
  );
}
