import React, { useContext, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import { colors, shared } from '../theme';

function getNotificationPermission() {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') return 'indisponível';
  return Notification.permission === 'granted' ? 'permitido' : Notification.permission === 'denied' ? 'negado' : 'pendente';
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const formatClockInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const normalizeClockOnBlur = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  if (digits.length === 1) return `0${digits}:00`;
  if (digits.length === 2) return `${digits}:00`;
  if (digits.length === 3) return `0${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const validTime = (value: string) => /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) <= 23 && Number(value.slice(3)) <= 59;

async function registerWebNotification(reminderTime: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Notificações push estão disponíveis apenas no PWA/web compatível.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação não foi concedida.');
  const registration = await navigator.serviceWorker.register('/sw.js');
  const { data } = await api.get('/push/public-key');
  if (!data?.publicKey) throw new Error('Chave pública VAPID não configurada no backend.');
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.publicKey) });
  await api.post('/push/subscribe', { ...subscription.toJSON(), userAgent: navigator.userAgent });
  await api.patch('/push/settings', { reminderEnabled: true, reminderTime, timezone: 'America/Sao_Paulo' });
  await registration.showNotification('Lembrete de sono ativado', { body: 'Você receberá lembretes para registrar sua noite diariamente.', icon: '/icon.png', badge: '/icon.png' });
}

export default function ProfileScreen() {
  const { user, logout } = useContext(AuthContext);
  const navigation = useNavigation<any>();
  const [reminderTime, setReminderTime] = useState('08:00');
  const [notificationStatus, setNotificationStatus] = useState(getNotificationPermission());
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => { setNotificationStatus(getNotificationPermission()); }, []);

  const activateReminder = async () => {
    const normalized = normalizeClockOnBlur(reminderTime);
    setReminderTime(normalized);
    if (!validTime(normalized)) {
      Alert.alert('Horário inválido', 'Digite um horário real. Exemplo: 0800 vira 08:00. Sim, o relógio ainda exige limites.');
      return;
    }
    setSavingReminder(true);
    try {
      await registerWebNotification(normalized);
      setNotificationStatus(getNotificationPermission());
      Alert.alert('Lembrete configurado', 'Lembrete diário salvo.');
    } catch (error) {
      Alert.alert('Lembrete não ativado', getApiErrorMessage(error, 'Não foi possível ativar o lembrete.'));
    } finally {
      setSavingReminder(false);
    }
  };

  const disableReminder = async () => {
    const normalized = normalizeClockOnBlur(reminderTime || '08:00');
    setReminderTime(normalized);
    setSavingReminder(true);
    try {
      await api.patch('/push/settings', { reminderEnabled: false, reminderTime: normalized, timezone: 'America/Sao_Paulo' });
      Alert.alert('Lembrete desativado', 'O lembrete diário foi desativado.');
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível desativar o lembrete.'));
    } finally {
      setSavingReminder(false);
    }
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.title}>Perfil</Text>
        <Text style={shared.subtitle}>Dados básicos, metas e configurações do aluno.</Text>
        {user && (
          <View style={shared.card}>
            <Info label="Nome" value={user.name} />
            <Info label="E-mail" value={user.email} />
            <Info label="Perfil" value={user.profile === 'student' ? 'Aluno' : 'Professor'} />
          </View>
        )}
        <View style={shared.card}>
          <Text style={shared.cardTitle}>Lembrete de sono</Text>
          <Text style={shared.muted}>Notificações funcionam no PWA/web compatível. No app nativo, esse fluxo depende de push nativo, que ainda não está implementado aqui.</Text>
          <Text style={shared.label}>Horário do lembrete</Text>
          <TextInput
            style={shared.input}
            value={reminderTime}
            onChangeText={(value) => setReminderTime(formatClockInput(value))}
            onBlur={() => setReminderTime(normalizeClockOnBlur(reminderTime))}
            placeholder="0800"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            maxLength={5}
          />
          <Text style={styles.hint}>Digite só números. Exemplo: 2130 vira 21:30.</Text>
          <Text style={styles.status}>Permissão: {notificationStatus}</Text>
          <Text style={styles.status}>Fuso horário: America/Sao_Paulo</Text>
          <Pressable style={[shared.button, savingReminder && styles.disabled]} onPress={activateReminder} disabled={savingReminder}><Text style={shared.buttonText}>{savingReminder ? 'Salvando...' : 'Ativar lembrete'}</Text></Pressable>
          <Pressable style={shared.outlineButton} onPress={disableReminder} disabled={savingReminder}><Text style={shared.outlineText}>Desativar lembrete</Text></Pressable>
          {notificationStatus === 'negado' && <Text style={styles.warning}>Permissão negada. Ative manualmente as notificações nas configurações do navegador.</Text>}
        </View>
        <Pressable style={shared.button} onPress={() => navigation.navigate('MetasSono')}><Text style={shared.buttonText}>Metas de sono</Text></Pressable>
        <Pressable style={shared.outlineButton} onPress={() => navigation.navigate('Insights')}><Text style={shared.outlineText}>Insights</Text></Pressable>
        <Pressable style={shared.outlineButton} onPress={logout}><Text style={shared.outlineText}>Sair</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 9 },
  infoLabel: { color: colors.muted, flex: 1, lineHeight: 19 },
  infoValue: { color: colors.text, fontWeight: '900', textAlign: 'right', flex: 1, lineHeight: 19 },
  status: { color: colors.text, fontWeight: '800', marginBottom: 10 },
  hint: { color: colors.subtle, fontSize: 12, lineHeight: 18, marginTop: -6, marginBottom: 10 },
  warning: { color: colors.warning, marginTop: 8, lineHeight: 18 },
  disabled: { opacity: 0.6 },
});
