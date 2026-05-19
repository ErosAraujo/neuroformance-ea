import { Response } from 'express';
import webpush from 'web-push';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getStudentIdByUserId } from '../services/identityService';

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}
async function getOptionalStudentId(req: AuthRequest) { if (!req.user || req.user.profile !== 'student') return undefined; try { return await getStudentIdByUserId(req.user.id); } catch { return undefined; } }
export class PushController {
  static async publicKey(_req: AuthRequest, res: Response) { return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null }); }
  static async settings(req: AuthRequest, res: Response) { if (!req.user) return res.status(401).json({ message: 'Não autenticado.' }); const sub = await prisma.pushSubscription.findFirst({ where: { userId: req.user.id, active: true }, orderBy: { updatedAt: 'desc' } }); if (!sub) return res.json({ active: false, reminderEnabled: false, reminderTime: '08:00', timezone: 'America/Sao_Paulo' }); return res.json({ active: sub.active, reminderEnabled: sub.reminderEnabled, reminderTime: sub.reminderTime, timezone: sub.timezone, lastSentAt: sub.lastSentAt }); }
  static async subscribe(req: AuthRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: 'Não autenticado.' });
    const { endpoint, keys, p256dh, auth, userAgent } = req.body;
    const finalP256dh = p256dh || keys?.p256dh; const finalAuth = auth || keys?.auth;
    if (!endpoint || !finalP256dh || !finalAuth) return res.status(400).json({ message: 'Dados de subscription incompletos.' });
    try { const studentId = await getOptionalStudentId(req); const existing = await prisma.pushSubscription.findFirst({ where: { endpoint, userId: req.user.id } }); if (existing) { const updated = await prisma.pushSubscription.update({ where: { id: existing.id }, data: { p256dh: finalP256dh, auth: finalAuth, userAgent, active: true, reminderEnabled: true, studentId } }); return res.json(updated); } const subscription = await prisma.pushSubscription.create({ data: { userId: req.user.id, studentId, endpoint, p256dh: finalP256dh, auth: finalAuth, userAgent, active: true, reminderEnabled: true } }); return res.status(201).json(subscription); }
    catch (error) { console.error(error); return res.status(500).json({ message: 'Erro ao salvar subscription.' }); }
  }
  static async unsubscribe(req: AuthRequest, res: Response) { if (!req.user) return res.status(401).json({ message: 'Não autenticado.' }); const { endpoint } = req.body; if (!endpoint) return res.status(400).json({ message: 'Endpoint é obrigatório.' }); try { await prisma.pushSubscription.updateMany({ where: { userId: req.user.id, endpoint }, data: { active: false, reminderEnabled: false } }); return res.json({ ok: true }); } catch (error) { console.error(error); return res.status(500).json({ message: 'Erro ao desativar subscription.' }); } }
  static async updateSettings(req: AuthRequest, res: Response) { if (!req.user) return res.status(401).json({ message: 'Não autenticado.' }); const { reminderEnabled, reminderTime, timezone } = req.body; if (reminderTime && !/^\d{2}:\d{2}$/.test(String(reminderTime))) return res.status(400).json({ message: 'Horário inválido. Use HH:mm.' }); try { await prisma.pushSubscription.updateMany({ where: { userId: req.user.id, active: true }, data: { reminderEnabled: typeof reminderEnabled === 'boolean' ? reminderEnabled : undefined, reminderTime: typeof reminderTime === 'string' ? reminderTime : undefined, timezone: typeof timezone === 'string' ? timezone : undefined } }); return res.json({ ok: true }); } catch (error) { console.error(error); return res.status(500).json({ message: 'Erro ao atualizar configurações.' }); } }
  static async testPush(req: AuthRequest, res: Response) { if (!req.user) return res.status(401).json({ message: 'Não autenticado.' }); if (!configureWebPush()) return res.status(400).json({ message: 'Chaves VAPID não configuradas no backend.' }); const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: req.user.id, active: true } }); if (!subscriptions.length) return res.status(404).json({ message: 'Nenhuma subscription ativa encontrada.' }); const payload = JSON.stringify({ title: 'Hora de registrar seu sono.', body: 'Teste de notificação configurado com sucesso.' }); const results = await Promise.allSettled(subscriptions.map((sub) => webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload))); return res.json({ sent: results.filter((r) => r.status === 'fulfilled').length, failed: results.filter((r) => r.status === 'rejected').length }); }
}
