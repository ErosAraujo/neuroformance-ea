import webpush from 'web-push';
import prisma from '../models/prisma';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_REMINDER_TIME = '08:00';

export type PushReminderDecision = 'sent' | 'skipped' | 'failed';

export interface PushReminderDetail {
  subscriptionId: number;
  userId: number;
  studentId: number | null;
  active: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  timezone: string;
  nowTime: string;
  today: string;
  lastSentAt: string | null;
  decision: PushReminderDecision;
  reason: string;
  expectedRecordDate?: string;
  errorStatusCode?: number;
  errorMessage?: string;
}

export interface PushReminderResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  sent: number;
  failed: number;
  checked: number;
  details: PushReminderDetail[];
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function localDateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';

  return `${year}-${month}-${day}`;
}

function localTimeInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';

  return `${hour}:${minute}`;
}

function previousDate(dateOnly: string) {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function normalizeHHmm(value: string | null | undefined) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : DEFAULT_REMINDER_TIME;
}

function toMinutes(hhmm: string) {
  const [hour, minute] = normalizeHHmm(hhmm).split(':').map(Number);
  return hour * 60 + minute;
}

function hasReminderTimeArrived(nowHHmm: string, reminderHHmm: string) {
  return toMinutes(nowHHmm) >= toMinutes(reminderHHmm);
}

function baseDetail(sub: any, now: Date): Omit<PushReminderDetail, 'decision' | 'reason'> {
  const timezone = DEFAULT_TIMEZONE;
  return {
    subscriptionId: sub.id,
    userId: sub.userId,
    studentId: sub.studentId ?? null,
    active: sub.active,
    reminderEnabled: sub.reminderEnabled,
    reminderTime: normalizeHHmm(sub.reminderTime || DEFAULT_REMINDER_TIME),
    timezone,
    nowTime: localTimeInTimezone(now, timezone),
    today: localDateInTimezone(now, timezone),
    lastSentAt: sub.lastSentAt ? sub.lastSentAt.toISOString() : null,
  };
}

function logDetail(detail: PushReminderDetail) {
  console.log('[push-reminder]', JSON.stringify(detail));
}

function finishDetail(details: PushReminderDetail[], detail: PushReminderDetail) {
  details.push(detail);
  logDetail(detail);
}

export async function sendDueSleepReminders(now = new Date()): Promise<PushReminderResult> {
  if (!configureWebPush()) {
    const result: PushReminderResult = {
      ok: false,
      skipped: true,
      reason: 'VAPID nao configurado',
      sent: 0,
      failed: 0,
      checked: 0,
      details: [],
    };
    console.warn('[push-reminder]', JSON.stringify(result));
    return result;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    include: {
      student: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  let sent = 0;
  let failed = 0;
  const details: PushReminderDetail[] = [];

  for (const sub of subscriptions) {
    const base = baseDetail(sub, now);
    const expectedRecordDate = previousDate(base.today);

    if (!sub.active) {
      finishDetail(details, { ...base, expectedRecordDate, decision: 'skipped', reason: 'subscription inativa' });
      continue;
    }

    if (!sub.reminderEnabled) {
      finishDetail(details, { ...base, expectedRecordDate, decision: 'skipped', reason: 'lembrete desativado' });
      continue;
    }

    if (!sub.studentId) {
      finishDetail(details, { ...base, expectedRecordDate, decision: 'skipped', reason: 'sem studentId' });
      continue;
    }

    if (!sub.student || sub.student.status !== 'active' || sub.student.active !== true) {
      finishDetail(details, { ...base, expectedRecordDate, decision: 'skipped', reason: 'aluno inexistente/inativo' });
      continue;
    }

    if (!hasReminderTimeArrived(base.nowTime, base.reminderTime)) {
      finishDetail(details, { ...base, expectedRecordDate, decision: 'skipped', reason: 'horario ainda nao chegou' });
      continue;
    }

    if (sub.lastSentAt && localDateInTimezone(sub.lastSentAt, DEFAULT_TIMEZONE) === base.today) {
      finishDetail(details, { ...base, expectedRecordDate, decision: 'skipped', reason: 'ja enviado hoje' });
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify({
          title: 'Hora de registrar seu sono.',
          body: 'Registre como foi sua noite para o professor acompanhar sua recuperacao e ajustar o treino com mais precisao.',
        }),
      );

      await prisma.pushSubscription.update({
        where: {
          id: sub.id,
        },
        data: {
          lastSentAt: now,
        },
      });

      sent += 1;
      finishDetail(details, {
        ...base,
        expectedRecordDate,
        decision: 'sent',
        reason: 'enviado',
      });
    } catch (error: any) {
      failed += 1;

      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await prisma.pushSubscription.update({
          where: {
            id: sub.id,
          },
          data: {
            active: false,
            reminderEnabled: false,
          },
        });
      }

      finishDetail(details, {
        ...base,
        expectedRecordDate,
        decision: 'failed',
        reason: 'erro webpush',
        errorStatusCode: typeof error?.statusCode === 'number' ? error.statusCode : undefined,
        errorMessage: error?.message ? String(error.message) : undefined,
      });
    }
  }

  const result: PushReminderResult = {
    ok: true,
    skipped: false,
    sent,
    failed,
    checked: subscriptions.length,
    details,
  };

  console.log('[push-reminder-summary]', JSON.stringify({ sent, failed, checked: subscriptions.length }));
  return result;
}

export function startSleepReminderJob() {
  const intervalMs = Number(process.env.PUSH_REMINDER_INTERVAL_MS || 5 * 60 * 1000);
  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs >= 60_000 ? intervalMs : 5 * 60 * 1000;

  console.log(`[push-reminder-job] iniciado com intervalo de ${safeIntervalMs}ms`);

  sendDueSleepReminders().catch((error) => {
    console.error('Erro ao executar push diario inicial:', error);
  });

  const timer = setInterval(() => {
    sendDueSleepReminders().catch((error) => {
      console.error('Erro no job de push diario:', error);
    });
  }, safeIntervalMs);

  timer.unref?.();

  return timer;
}
