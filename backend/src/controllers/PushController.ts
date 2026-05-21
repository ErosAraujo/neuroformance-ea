import { Response } from 'express';
import webpush from 'web-push';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getStudentIdByUserId } from '../services/identityService';
import { sendDueSleepReminders } from '../services/pushReminderService';

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

  if (!raw) return '08:00';

  const isValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(raw);

  return isValid ? raw : '08:00';
}

function normalizeTimezone(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';

  return raw || 'America/Sao_Paulo';
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
      return res.status(401).json({ message: 'Não autenticado.' });
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
        reminderTime: '08:00',
        timezone: 'America/Sao_Paulo',
      });
    }

    return res.json({
      active: sub.active,
      reminderEnabled: sub.reminderEnabled,
      reminderTime: sub.reminderTime,
      timezone: sub.timezone,
      lastSentAt: sub.lastSentAt,
    });
  }

  static async subscribe(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado.' });
    }

    const {
      endpoint,
      keys,
      p256dh,
      auth,
      userAgent,
      reminderEnabled,
      reminderTime,
      timezone,
    } = req.body;

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
      return res.status(401).json({ message: 'Não autenticado.' });
    }

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        message: 'Endpoint é obrigatório.',
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
      return res.status(401).json({ message: 'Não autenticado.' });
    }

    const { reminderEnabled, reminderTime, timezone } = req.body;

    if (
      typeof reminderTime === 'string' &&
      reminderTime.trim() &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime.trim())
    ) {
      return res.status(400).json({
        message: 'Horário inválido. Use HH:mm entre 00:00 e 23:59.',
      });
    }

    const data: {
      reminderEnabled?: boolean;
      reminderTime?: string;
      timezone?: string;
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
        message: 'Erro ao atualizar configurações.',
      });
    }
  }

  static async testPush(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado.' });
    }

    if (!configureWebPush()) {
      return res.status(400).json({
        message: 'Chaves VAPID não configuradas no backend.',
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
      body: 'Teste de notificação configurado com sucesso.',
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
    });
  }

  static async runDueReminders(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado.' });
    }

    if (req.user.profile !== 'teacher') {
      return res.status(403).json({
        message: 'Apenas professor pode executar o disparo manual dos lembretes.',
      });
    }

    try {
      const result = await sendDueSleepReminders(new Date());

      return res.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      console.error('Erro ao executar lembretes manualmente:', error);

      return res.status(500).json({
        ok: false,
        message: 'Erro ao executar lembretes manualmente.',
      });
    }
  }
}
