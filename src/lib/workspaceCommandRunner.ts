import { Language } from './i18n';
import {
  apiUrl,
  getStaticHostNotice,
  isStaticHostErrorResponse,
  isStaticHostWithoutBackend,
} from './api';
import {
  buildGmailSearchQueryFromPrompt,
  createGmailDraft,
  listGmailMessages,
  sendGmailMessage,
} from './gmail';
import {
  ConnectorId,
  appendToGoogleDoc,
  createCalendarEvent,
  createDriveFolder,
  createDriveTextFile,
  createGoogleDoc,
  createGoogleTask,
  deleteCalendarEvent,
  deleteGoogleTask,
  getGoogleDocText,
  listCalendarEvents,
  listDriveFiles,
  listGoogleDocs,
  listGoogleTasks,
  updateCalendarEvent,
  updateGoogleTaskStatus,
} from './workspace';

export interface PendingWorkspaceMutation {
  connector: ConnectorId;
  operation:
    | 'send_email'
    | 'update_event'
    | 'delete_event'
    | 'append_doc'
    | 'complete_task'
    | 'delete_task';
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  details: Array<{ label: string; value: string }>;
  execute: () => Promise<string>;
}

export type WorkspaceCommandOutcome =
  | {
      status: 'done';
      markdown: string;
      titleHint?: string;
    }
  | {
      status: 'confirm';
      pending: PendingWorkspaceMutation;
      previewMarkdown: string;
      titleHint?: string;
    };

function getLocalIsoWithOffset(date = new Date()): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const tzOffsetMin = -date.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const hours = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
  const mins = pad(Math.abs(tzOffsetMin) % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}:${mins}`;
}

function formatReadableDateTime(iso: string, lang: Language): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

async function fetchConnectorContext(connector: ConnectorId, instruction: string) {
  if (connector === 'gmail') {
    const query = instruction ? buildGmailSearchQueryFromPrompt(instruction) : 'in:inbox';
    const msgs = await listGmailMessages({ query, maxResults: 8 });
    return {
      messages: msgs.map((m) => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        date: m.date,
        unread: m.unread,
        snippet: m.snippet,
        body: m.body.slice(0, 1000),
      })),
    };
  }

  if (connector === 'calendar') {
    const events = await listCalendarEvents(15);
    return {
      events: events.map((ev) => ({
        id: ev.id,
        summary: ev.summary,
        start: ev.start,
        end: ev.end,
        location: ev.location,
        description: ev.description.slice(0, 300),
      })),
    };
  }

  if (connector === 'drive') {
    const files = await listDriveFiles({ maxResults: 15 });
    return {
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink || '',
      })),
    };
  }

  if (connector === 'docs') {
    const docs = await listGoogleDocs({ maxResults: 8 });
    const withExcerpts = await Promise.all(
      docs.map(async (d, idx) => {
        let excerpt = '';
        if (idx < 2) {
          try {
            excerpt = (await getGoogleDocText(d.id)).slice(0, 1000);
          } catch {}
        }
        return {
          id: d.id,
          name: d.name,
          modifiedTime: d.modifiedTime,
          webViewLink: d.webViewLink || '',
          excerpt,
        };
      })
    );
    return { docs: withExcerpts };
  }

  const tasks = await listGoogleTasks(20);
  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes.slice(0, 200),
      due: t.due,
      status: t.status,
      taskListId: t.taskListId,
    })),
  };
}

export async function runWorkspaceSlashCommand(params: {
  connector: ConnectorId;
  instruction: string;
  lang: Language;
  signal?: AbortSignal;
}): Promise<WorkspaceCommandOutcome> {
  const { connector, instruction, lang, signal } = params;
  const isTr = lang === 'tr';

  const context = await fetchConnectorContext(connector, instruction);
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const nowIso = getLocalIsoWithOffset(new Date());

  if (isStaticHostWithoutBackend()) {
    throw new Error(getStaticHostNotice(lang));
  }

  const planRes = await fetch(apiUrl('/api/workspace-command'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      connector,
      instruction,
      nowIso,
      timeZone,
      context,
      lang,
    }),
  });

  if (isStaticHostErrorResponse(planRes)) {
    throw new Error(getStaticHostNotice(lang));
  }

  const plan = await planRes.json().catch(() => ({}));
  if (!planRes.ok || !plan?.operation) {
    throw new Error(
      plan?.error ||
        (isTr
          ? 'Bağlayıcı komutu işlenemedi.'
          : 'Could not process connector command.')
    );
  }

  const op = String(plan.operation);
  const payload = (plan.payload || {}) as Record<string, any>;
  const reply = String(plan.reply || '').trim();

  // 1) Read / Summarize — immediate response
  if (op === 'read_summary') {
    return {
      status: 'done',
      markdown:
        reply ||
        (isTr ? 'Bağlayıcı verileri okundu.' : 'Connector items retrieved.'),
      titleHint: instruction.slice(0, 36) || connector,
    };
  }

  // 2) GMAIL
  if (connector === 'gmail') {
    const to = String(payload.to || '').trim();
    const subject = String(payload.subject || (isTr ? '(Konusuz)' : '(No subject)')).trim();
    const body = String(payload.body || '').trim();

    if (op === 'send_email' && to) {
      return {
        status: 'confirm',
        titleHint: subject.slice(0, 36),
        previewMarkdown: isTr
          ? `Gmail ile gönderilmek üzere e-posta hazırlandı (**${to}** — *${subject}*). Onayladığında gönderilecek.`
          : `Email prepared for **${to}** (*${subject}*). Confirm in the dialog to send via Gmail.`,
        pending: {
          connector: 'gmail',
          operation: 'send_email',
          title: isTr ? 'E-postayı Gmail ile gönder?' : 'Send email via Gmail?',
          description: isTr
            ? 'Bu e-posta Gmail hesabından doğrudan alıcıya gönderilecek.'
            : 'This email will be sent directly from your Gmail account.',
          confirmLabel: isTr ? 'Gönder' : 'Send email',
          details: [
            { label: isTr ? 'Alıcı' : 'To', value: to },
            { label: isTr ? 'Konu' : 'Subject', value: subject },
            { label: isTr ? 'Mesaj' : 'Message', value: body },
          ],
          execute: async () => {
            await sendGmailMessage({ to, subject, body });
            return (
              reply ||
              (isTr
                ? `E-posta **${to}** adresine gönderildi.\n\n- **Konu:** ${subject}`
                : `Email sent to **${to}**.\n\n- **Subject:** ${subject}`)
            );
          },
        },
      };
    }

    // Default safe direct execution: save real Gmail Draft immediately
    await createGmailDraft({ to, subject, body });
    const lines = [
      reply ||
        (isTr
          ? 'Gmail taslaklarına kaydedildi.'
          : 'Saved directly to your Gmail drafts.'),
      '',
      ...(to ? [`- **${isTr ? 'Alıcı' : 'To'}:** ${to}`] : []),
      `- **${isTr ? 'Konu' : 'Subject'}:** ${subject}`,
      '',
      body,
    ];
    return {
      status: 'done',
      markdown: lines.join('\n'),
      titleHint: subject.slice(0, 36),
    };
  }

  // 3) GOOGLE CALENDAR
  if (connector === 'calendar') {
    if (op === 'delete_event' && payload.eventId) {
      const eventId = String(payload.eventId);
      const label = String(payload.existingSummary || eventId);
      return {
        status: 'confirm',
        titleHint: label.slice(0, 36),
        previewMarkdown: isTr
          ? `**${label}** etkinliğini Google Takvim'den silmek için onayın bekleniyor.`
          : `Waiting for confirmation to delete **${label}** from Google Calendar.`,
        pending: {
          connector: 'calendar',
          operation: 'delete_event',
          title: isTr ? 'Takvim etkinliğini sil?' : 'Delete calendar event?',
          description: isTr
            ? 'Bu etkinlik Google Takvim hesabından kalıcı olarak kaldırılacak.'
            : 'This event will be removed from your primary Google Calendar.',
          confirmLabel: isTr ? 'Sil' : 'Delete event',
          destructive: true,
          details: [{ label: isTr ? 'Etkinlik' : 'Event', value: label }],
          execute: async () => {
            await deleteCalendarEvent(eventId);
            return (
              reply ||
              (isTr
                ? `**${label}** etkinliği Google Takvim'den silindi.`
                : `Deleted **${label}** from Google Calendar.`)
            );
          },
        },
      };
    }

    if (op === 'update_event' && payload.eventId) {
      const eventId = String(payload.eventId);
      const existingSummary = String(payload.existingSummary || payload.summary || '');
      const summary = String(payload.summary || existingSummary).trim();
      const startIso = payload.startIso ? String(payload.startIso) : undefined;
      const endIso = payload.endIso ? String(payload.endIso) : undefined;
      const location = payload.location ? String(payload.location) : undefined;
      const description = payload.description ? String(payload.description) : undefined;

      return {
        status: 'confirm',
        titleHint: summary.slice(0, 36),
        previewMarkdown: isTr
          ? `**${existingSummary}** etkinliğini güncellemek için onayın bekleniyor.`
          : `Waiting for confirmation to update **${existingSummary}** on Google Calendar.`,
        pending: {
          connector: 'calendar',
          operation: 'update_event',
          title: isTr ? 'Takvim etkinliğini güncelle?' : 'Update calendar event?',
          description: isTr
            ? 'Mevcut etkinlik aşağıdaki yeni bilgilerle güncellenecek.'
            : 'The existing calendar event will be updated with these details.',
          confirmLabel: isTr ? 'Güncelle' : 'Update event',
          details: [
            { label: isTr ? 'Etkinlik' : 'Event', value: summary },
            ...(startIso
              ? [{ label: isTr ? 'Başlangıç' : 'Start', value: formatReadableDateTime(startIso, lang) }]
              : []),
            ...(endIso
              ? [{ label: isTr ? 'Bitiş' : 'End', value: formatReadableDateTime(endIso, lang) }]
              : []),
            ...(location ? [{ label: isTr ? 'Konum' : 'Location', value: location }] : []),
          ],
          execute: async () => {
            const updated = await updateCalendarEvent(eventId, {
              summary,
              startIso,
              endIso,
              location,
              description,
            });
            const linkLine = updated.htmlLink
              ? `\n\n[${isTr ? "Google Takvim'de aç" : 'Open in Google Calendar'}](${updated.htmlLink})`
              : '';
            return `${
              reply ||
              (isTr
                ? `**${updated.summary}** etkinliği güncellendi.`
                : `Updated **${updated.summary}** on Google Calendar.`)
            }${linkLine}`;
          },
        },
      };
    }

    // Create new event directly!
    const fallbackStart = new Date(Date.now() + 60 * 60 * 1000);
    fallbackStart.setMinutes(0, 0, 0);
    const startIso = String(payload.startIso || fallbackStart.toISOString());
    const startMs = new Date(startIso).getTime();
    const fallbackEnd = new Date(
      (Number.isNaN(startMs) ? Date.now() : startMs) + 60 * 60 * 1000
    ).toISOString();
    const endIso = String(payload.endIso || fallbackEnd);
    const summary = String(payload.summary || instruction || (isTr ? 'Yeni Etkinlik' : 'New Event'));

    const created = await createCalendarEvent({
      summary,
      startIso,
      endIso,
      location: payload.location ? String(payload.location) : undefined,
      description: payload.description ? String(payload.description) : undefined,
    });

    const lines = [
      reply ||
        (isTr
          ? `**${created.summary}** etkinliği Google Takvim'e eklendi.`
          : `Added **${created.summary}** to Google Calendar.`),
      '',
      `- **${isTr ? 'Başlangıç' : 'Start'}:** ${formatReadableDateTime(created.start, lang)}`,
      `- **${isTr ? 'Bitiş' : 'End'}:** ${formatReadableDateTime(created.end, lang)}`,
      ...(created.location ? [`- **${isTr ? 'Konum' : 'Location'}:** ${created.location}`] : []),
      ...(created.description ? [`- **${isTr ? 'Not' : 'Notes'}:** ${created.description}`] : []),
      ...(created.htmlLink
        ? ['', `[${isTr ? "Google Takvim'de aç" : 'Open in Google Calendar'}](${created.htmlLink})`]
        : []),
    ];

    return {
      status: 'done',
      markdown: lines.join('\n'),
      titleHint: created.summary.slice(0, 36),
    };
  }

  // 4) GOOGLE DRIVE
  if (connector === 'drive') {
    if (op === 'create_folder') {
      const folderName = String(payload.name || instruction || (isTr ? 'Yeni Klasör' : 'New Folder'));
      const created = await createDriveFolder(folderName);
      const lines = [
        reply ||
          (isTr
            ? `**${created.name}** klasörü Google Drive'da oluşturuldu.`
            : `Created folder **${created.name}** in Google Drive.`),
        ...(created.webViewLink
          ? ['', `[${isTr ? "Google Drive'da aç" : 'Open in Google Drive'}](${created.webViewLink})`]
          : []),
      ];
      return {
        status: 'done',
        markdown: lines.join('\n'),
        titleHint: created.name.slice(0, 36),
      };
    }

    const fileName = String(payload.name || 'notlar.txt');
    const content = String(payload.content || instruction || '');
    const mimeType = String(payload.mimeType || 'text/plain');
    const created = await createDriveTextFile({ name: fileName, content, mimeType });
    const lines = [
      reply ||
        (isTr
          ? `**${created.name}** dosyası Google Drive'da oluşturuldu.`
          : `Created **${created.name}** in Google Drive.`),
      ...(created.webViewLink
        ? ['', `[${isTr ? "Google Drive'da aç" : 'Open in Google Drive'}](${created.webViewLink})`]
        : []),
    ];
    return {
      status: 'done',
      markdown: lines.join('\n'),
      titleHint: created.name.slice(0, 36),
    };
  }

  // 5) GOOGLE DOCS
  if (connector === 'docs') {
    if (op === 'append_doc' && payload.documentId) {
      const documentId = String(payload.documentId);
      const existingTitle = String(payload.existingTitle || 'Google Doc');
      const content = String(payload.content || '').trim();
      return {
        status: 'confirm',
        titleHint: existingTitle.slice(0, 36),
        previewMarkdown: isTr
          ? `**${existingTitle}** belgesine metin eklemek için onayın bekleniyor.`
          : `Waiting for confirmation to append text to **${existingTitle}**.`,
        pending: {
          connector: 'docs',
          operation: 'append_doc',
          title: isTr ? 'Mevcut Google Dokümanını güncelle?' : 'Update existing Google Doc?',
          description: isTr
            ? 'Aşağıdaki içerik mevcut belgenin sonuna eklenecek.'
            : 'The following text will be appended to the end of your document.',
          confirmLabel: isTr ? 'Belgeye ekle' : 'Append to doc',
          details: [
            { label: isTr ? 'Belge' : 'Document', value: existingTitle },
            { label: isTr ? 'Eklenecek metin' : 'Text to append', value: content },
          ],
          execute: async () => {
            await appendToGoogleDoc(documentId, content);
            const link = `https://docs.google.com/document/d/${documentId}/edit`;
            return `${
              reply ||
              (isTr
                ? `**${existingTitle}** belgesine yeni içerik eklendi.`
                : `Appended new content to **${existingTitle}**.`)
            }\n\n[${isTr ? "Google Doküman'da aç" : 'Open in Google Docs'}](${link})`;
          },
        },
      };
    }

    // Create a brand-new Google Doc directly with full written content
    const title = String(payload.title || instruction.slice(0, 60) || (isTr ? 'Yeni Belge' : 'New Document'));
    const content = String(payload.content || '').trim();
    const created = await createGoogleDoc({ title, content });
    const preview = content.length > 280 ? `${content.slice(0, 280).trim()}…` : content;
    const lines = [
      reply ||
        (isTr
          ? `**${created.title}** Google Dokümanlar'da oluşturuldu.`
          : `Created **${created.title}** in Google Docs.`),
      ...(preview ? ['', `> ${preview.replace(/\n+/g, '\n> ')}`] : []),
      '',
      `[${isTr ? "Google Doküman'da aç" : 'Open in Google Docs'}](${created.webViewLink})`,
    ];
    return {
      status: 'done',
      markdown: lines.join('\n'),
      titleHint: created.title.slice(0, 36),
    };
  }

  // 6) GOOGLE TASKS
  if (op === 'complete_task' && payload.taskId) {
    const taskId = String(payload.taskId);
    const taskTitle = String(payload.taskTitle || taskId);
    const completed = payload.completed !== false;
    return {
      status: 'confirm',
      titleHint: taskTitle.slice(0, 36),
      previewMarkdown: isTr
        ? `**${taskTitle}** görevini güncellemek için onayın bekleniyor.`
        : `Waiting for confirmation to update task **${taskTitle}**.`,
      pending: {
        connector: 'tasks',
        operation: 'complete_task',
        title: isTr ? 'Görevi tamamlandı olarak işaretle?' : 'Mark task as completed?',
        description: isTr
          ? 'Bu görevin durumu Google Görevler listende güncellenecek.'
          : 'This task status will be updated in your Google Tasks list.',
        confirmLabel: isTr ? 'Onayla' : 'Confirm',
        details: [{ label: isTr ? 'Görev' : 'Task', value: taskTitle }],
        execute: async () => {
          await updateGoogleTaskStatus(
            {
              id: taskId,
              title: taskTitle,
              notes: '',
              due: '',
              status: completed ? 'needsAction' : 'completed',
              taskListId: '@default',
            },
            completed
          );
          return (
            reply ||
            (isTr
              ? `**${taskTitle}** görevi ${completed ? 'tamamlandı olarak işaretlendi' : 'tekrar açıldı'}.`
              : `Marked **${taskTitle}** as ${completed ? 'completed' : 'open'}.`)
          );
        },
      },
    };
  }

  if (op === 'delete_task' && payload.taskId) {
    const taskId = String(payload.taskId);
    const taskTitle = String(payload.taskTitle || taskId);
    return {
      status: 'confirm',
      titleHint: taskTitle.slice(0, 36),
      previewMarkdown: isTr
        ? `**${taskTitle}** görevini silmek için onayın bekleniyor.`
        : `Waiting for confirmation to delete task **${taskTitle}**.`,
      pending: {
        connector: 'tasks',
        operation: 'delete_task',
        title: isTr ? 'Görevi sil?' : 'Delete task?',
        description: isTr
          ? 'Bu görev Google Görevler listenden kalıcı olarak silinecek.'
          : 'This task will be permanently deleted from Google Tasks.',
        confirmLabel: isTr ? 'Sil' : 'Delete task',
        destructive: true,
        details: [{ label: isTr ? 'Görev' : 'Task', value: taskTitle }],
        execute: async () => {
          await deleteGoogleTask(taskId);
          return (
            reply ||
            (isTr
              ? `**${taskTitle}** görevi Google Görevler'den silindi.`
              : `Deleted **${taskTitle}** from Google Tasks.`)
          );
        },
      },
    };
  }

  // Create new Google Task directly!
  const taskTitle = String(payload.title || instruction || (isTr ? 'Yeni Görev' : 'New Task'));
  const notes = payload.notes ? String(payload.notes) : undefined;
  const dueDate =
    typeof payload.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.dueDate.trim())
      ? payload.dueDate.trim()
      : undefined;

  const createdTask = await createGoogleTask({
    title: taskTitle,
    notes,
    dueDate,
  });

  const lines = [
    reply ||
      (isTr
        ? `**${createdTask.title}** görevi Google Görevler'e eklendi.`
        : `Added **${createdTask.title}** to Google Tasks.`),
    ...(dueDate ? ['', `- **${isTr ? 'Son tarih' : 'Due'}:** ${dueDate}`] : []),
    ...(notes ? [`- **${isTr ? 'Not' : 'Notes'}:** ${notes}`] : []),
  ];

  return {
    status: 'done',
    markdown: lines.join('\n'),
    titleHint: createdTask.title.slice(0, 36),
  };
}
