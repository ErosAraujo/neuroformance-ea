import { Response } from 'express';
import webpush from 'web-push';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getStudentIdByUserId } from '../services/identityService';
import { sendDueSleepReminders } from '../services/pushReminderService';

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

async function getOptionalStudentId(req: AuthRequest) {
  if (!req.user || req.user.profile !== 'student') return undefined;

  try {
    return await getStudentIdByUserId(req.user.id);
  } catch {
    return undefined;
  }
}

function normalizeReminderTime(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return DEFAULT_REMINDER_TIME;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : DEFAULT_REMINDER_TIME;
}

function normalizeTimezone(_value: unknown) {
  return DEFAULT_TIMEZONE;
}

function normalizeReminderEnabled(value: unknown) {
  if (typeof value === 'boolean') return value;
  return true;
}

export class PushController {
  static async publicKey(_req: AuthRequest, res: Response) {
    return res.json({
      publicKey: process.env.VAPID_PUBLIC_KEY || null,
    });
  }

  static async settings(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Nao autenticado.' });
    }

    const sub = await prisma.pushSubscription.findFirst({
      where: {
        userId: req.user.id,
        active: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!sub) {
      return res.json({
        active: false,
        reminderEnabled: false,
        reminderTime: DEFAULT_REMINDER_TIME,
        timezone: DEFAULT_TIMEZONE,
      });
    }

    return res.json({
      active: sub.active,
      reminderEnabled: sub.reminderEnabled,
      reminderTime: sub.reminderTime,
      timezone: DEFAULT_TIMEZONE,
      lastSentAt: sub.lastSentAt,
      studentId: sub.studentId,
    });
  }

  static async subscribe(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Nao autenticado.' });
    }

    const { endpoint, keys, p256dh, auth, userAgent, reminderEnabled, reminderTime, timezone } = req.body;
    const finalP256dh = p256dh || keys?.p256dh;
    const finalAuth = auth || keys?.auth;

    if (!endpoint || !finalP256dh || !finalAuth) {
      return res.status(400).json({
        message: 'Dados de subscription incompletos.',
      });
    }

    const finalReminderTime = normalizeReminderTime(reminderTime);
    const finalTimezone = normalizeTimezone(timezone);
    const finalReminderEnabled = normalizeReminderEnabled(reminderEnabled);

    try {
      const studentId = await getOptionalStudentId(req);

      if (req.user.profile === 'student' && !studentId) {
        return res.status(400).json({
          message: 'Aluno nao encontrado para vincular a subscription.',
        });
      }

      const existing = await prisma.pushSubscription.findFirst({
        where: {
          endpoint,
          userId: req.user.id,
        },
      });

      if (existing) {
        const updated = await prisma.pushSubscription.update({
          where: {
            id: existing.id,
          },
          data: {
            p256dh: finalP256dh,
            auth: finalAuth,
            userAgent,
            active: true,
            reminderEnabled: finalReminderEnabled,
            reminderTime: finalReminderTime,
            timezone: finalTimezone,
            studentId,
            lastSentAt: null,
          },
        });

        return res.json(updated);
      }

      const subscription = await prisma.pushSubscription.create({
        data: {
          userId: req.user.id,
          studentId,
          endpoint,
          p256dh: finalP256dh,
          auth: finalAuth,
          userAgent,
          active: true,
          reminderEnabled: finalReminderEnabled,
          reminderTime: finalReminderTime,
          timezone: finalTimezone,
          lastSentAt: null,
        },
      });

      return res.status(201).json(subscription);
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao salvar subscription.',
      });
    }
  }

  static async unsubscribe(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Nao autenticado.' });
    }

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        message: 'Endpoint e obrigatorio.',
      });
    }

    try {
      await prisma.pushSubscription.updateMany({
        where: {
          userId: req.user.id,
          endpoint,
        },
        data: {
          active: false,
          reminderEnabled: false,
        },
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao desativar subscription.',
      });
    }
  }

  static async updateSettings(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Nao autenticado.' });
    }

    const { reminderEnabled, reminderTime, timezone } = req.body;

    if (
      typeof reminderTime === 'string' &&
      reminderTime.trim() &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime.trim())
    ) {
      return res.status(400).json({
        message: 'Horario invalido. Use HH:mm entre 00:00 e 23:59.',
      });
    }

    const data: {
      reminderEnabled?: boolean;
      reminderTime?: string;
      timezone?: string;
      studentId?: number;
      lastSentAt?: null;
    } = {};

    if (typeof reminderEnabled === 'boolean') {
      data.reminderEnabled = reminderEnabled;
    }

    if (typeof reminderTime === 'string' && reminderTime.trim()) {
      data.reminderTime = normalizeReminderTime(reminderTime);
      data.lastSentAt = null;
    }

    if (typeof timezone === 'string' && timezone.trim()) {
      data.timezone = normalizeTimezone(timezone);
    }

    try {
      const studentId = await getOptionalStudentId(req);
      if (studentId) data.studentId = studentId;

      await prisma.pushSubscription.updateMany({
        where: {
          userId: req.user.id,
          active: true,
        },
        data,
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao atualizar configuracoes.',
      });
    }
  }

  static async testPush(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Nao autenticado.' });
    }

    if (!configureWebPush()) {
      return res.status(400).json({
        message: 'Chaves VAPID nao configuradas no backend.',
      });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: req.user.id,
        active: true,
      },
    });

    if (!subscriptions.length) {
      return res.status(404).json({
        message: 'Nenhuma subscription ativa encontrada.',
      });
    }

    const payload = JSON.stringify({
      title: 'Hora de registrar seu sono.',
      body: 'Teste de notificacao configurado com sucesso.',
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        ),
      ),
    );

    await Promise.all(
      results.map(async (result, index) => {
        if (result.status !== 'rejected') return;

        const error = result.reason;

        if (error?.statusCode === 404 || error?.statusCode === 410) {
          const sub = subscriptions[index];

          if (sub) {
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
      }),
    );

    return res.json({
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
      subscriptions: subscriptions.map((sub, index) => ({
        subscriptionId: sub.id,
        userId: sub.userId,
        studentId: sub.studentId,
        decision: results[index]?.status === 'fulfilled' ? 'sent' : 'failed',
      })),
    });
  }

  static async runDueReminders(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Nao autenticado.' });
    }

    try {
      const result = await sendDueSleepReminders(new Date());
      return res.json(result);
    } catch (error) {
      console.error('Erro ao executar lembretes manualmente:', error);

      return res.status(500).json({
        ok: false,
        message: 'Erro ao executar lembretes manualmente.',
      });
    }
  }

  static async runDueRemindersCron(req: AuthRequest, res: Response) {
    const expectedSecret = process.env.CRON_SECRET;
    const receivedSecret = req.headers['x-cron-secret'];

    if (!expectedSecret) {
      return res.status(503).json({
        ok: false,
        message: 'CRON_SECRET nao configurado no backend.',
      });
    }

    if (String(receivedSecret || '') !== expectedSecret) {
      return res.status(401).json({
        ok: false,
        message: 'Cron nao autorizado.',
      });
    }

    try {
      const result = await sendDueSleepReminders(new Date());
      return res.json(result);
    } catch (error) {
      console.error('Erro ao executar cron de lembretes:', error);

      return res.status(500).json({
        ok: false,
        message: 'Erro ao executar cron de lembretes.',
      });
    }
  }
}
