import webpush from 'web-push';
import prisma from '../models/prisma';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_REMINDER_TIME = '08:00';

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

function startEndOfDate(dateOnly: string) {
  return {
    start: new Date(`${dateOnly}T00:00:00.000Z`),
    end: new Date(`${dateOnly}T23:59:59.999Z`),
  };
}

function normalizeHHmm(value: string | null | undefined) {
  const raw = typeof value === 'string' ? value.trim() : '';

  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
    return raw;
  }

  return DEFAULT_REMINDER_TIME;
}

function toMinutes(hhmm: string) {
  const [hour, minute] = hhmm.split(':').map(Number);
  return hour * 60 + minute;
}

function shouldCheckTime(nowHHmm: string, reminderHHmm: string) {
  const nowMinutes = toMinutes(normalizeHHmm(nowHHmm));
  const reminderMinutes = toMinutes(normalizeHHmm(reminderHHmm));

  /*
    Antes:
    só enviava entre o horário marcado e +9 minutos.

    Agora:
    envia em qualquer checagem após o horário marcado,
    desde que ainda não tenha enviado hoje.

    Isso evita perder o push quando Render atrasa/dorme/reinicia.
  */
  return nowMinutes >= reminderMinutes;
}

export async function sendDueSleepReminders(now = new Date()) {
  if (!configureWebPush()) {
    return {
      skipped: true,
      reason: 'VAPID não configurado',
      sent: 0,
      failed: 0,
    };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      active: true,
      reminderEnabled: true,
    },
    include: {
      student: true,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const timezone = sub.timezone || DEFAULT_TIMEZONE;
    const today = localDateInTimezone(now, timezone);
    const nowTime = localTimeInTimezone(now, timezone);
    const reminderTime = normalizeHHmm(sub.reminderTime || DEFAULT_REMINDER_TIME);

    if (!sub.studentId || !sub.student) continue;

    if (sub.student.status !== 'active' || sub.student.active !== true) {
      continue;
    }

    if (!shouldCheckTime(nowTime, reminderTime)) {
      continue;
    }

    if (sub.lastSentAt && localDateInTimezone(sub.lastSentAt, timezone) === today) {
      continue;
    }

    const { start, end } = startEndOfDate(previousDate(today));

    const alreadyRegistered = await prisma.sleepRecord.findFirst({
      where: {
        studentId: sub.studentId,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    if (alreadyRegistered) {
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
          body: 'Registre como foi sua noite para o professor acompanhar sua recuperação e ajustar o treino com mais precisão.',
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
    }
  }

  return {
    skipped: false,
    sent,
    failed,
  };
}

export function startSleepReminderJob() {
  const intervalMs = Number(process.env.PUSH_REMINDER_INTERVAL_MS || 5 * 60 * 1000);

  const safeIntervalMs =
    Number.isFinite(intervalMs) && intervalMs >= 60_000
      ? intervalMs
      : 5 * 60 * 1000;

  sendDueSleepReminders().catch((error) => {
    console.error('Erro ao executar push diário inicial:', error);
  });

  const timer = setInterval(() => {
    sendDueSleepReminders().catch((error) => {
      console.error('Erro no job de push diário:', error);
    });
  }, safeIntervalMs);

  timer.unref?.();

  return timer;
}