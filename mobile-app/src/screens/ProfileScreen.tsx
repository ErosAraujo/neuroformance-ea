import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import { colors, shared } from '../theme';
import { getStudentPhotoSource, initialsFromStudentName } from '../utils/studentPhotos';

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
  if (!data?.publicKey) throw new Error('Configuração de lembretes indisponível no momento.');
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.publicKey) });
  await api.post('/push/subscribe', {
  ...subscription.toJSON(),
  userAgent: navigator.userAgent,
  reminderEnabled: true,
  reminderTime,
  timezone: 'America/Sao_Paulo',
});

await api.patch('/push/settings', {
  reminderEnabled: true,
  reminderTime,
  timezone: 'America/Sao_Paulo',
});
  await registration.showNotification('Lembrete de sono ativado', { body: 'Você receberá lembretes para registrar sua noite diariamente.', icon: '/icon.png', badge: '/icon.png' });
}

export default function ProfileScreen() {
  const { user, updateProfile, logout } = useContext(AuthContext);
  const navigation = useNavigation<any>();
  const [reminderTime, setReminderTime] = useState('08:00');
  const [notificationStatus, setNotificationStatus] = useState(getNotificationPermission());
  const [savingReminder, setSavingReminder] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null | undefined>(undefined);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
  let mounted = true;

  async function loadReminderSettings() {
    setNotificationStatus(getNotificationPermission());

    try {
      const { data } = await api.get('/push/settings');

      if (!mounted) return;

      if (typeof data?.reminderTime === 'string' && validTime(data.reminderTime)) {
        setReminderTime(data.reminderTime);
      }

      if (typeof data?.reminderEnabled === 'boolean') {
        setNotificationStatus(getNotificationPermission());
      }
    } catch (error) {
      console.log('[PUSH] Não foi possível carregar configurações do lembrete:', error);
    }
  }

  loadReminderSettings();

  return () => {
    mounted = false;
  };
}, []);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setProfilePhoto(undefined);
  }, [user?.name, user?.email, user?.photoUrl]);

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

  const saveProfile = async () => {
    const name = profileName.trim();
    const email = profileEmail.trim().toLowerCase();
    if (name.length < 2) {
      Alert.alert('Nome invalido', 'Informe pelo menos 2 caracteres.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('E-mail invalido', 'Informe um e-mail valido.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(name, email, profilePhoto);
      Alert.alert('Perfil atualizado', 'Seus dados foram salvos.');
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Nao foi possivel atualizar seus dados.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const pickProfilePhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permissao necessaria', 'Permita acesso as fotos para escolher uma imagem.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
        base64: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert('Foto indisponivel', 'Nao foi possivel ler a imagem escolhida.');
        return;
      }
      const mimeType = asset.mimeType || 'image/jpeg';
      setProfilePhoto(`data:${mimeType};base64,${asset.base64}`);
      setAvatarFailed(false);
    } catch (error) {
      Alert.alert('Erro', 'Nao foi possivel escolher a foto.');
    }
  };

  const removeProfilePhoto = () => {
    setProfilePhoto(null);
    setAvatarFailed(false);
  };

  const avatarSource = useMemo<ImageSourcePropType | null>(() => {
    if (profilePhoto !== undefined) return profilePhoto ? { uri: profilePhoto } : null;
    return getStudentPhotoSource(user);
  }, [profilePhoto, user]);
  const avatarInitials = useMemo(() => initialsFromStudentName(user?.name) || 'EA', [user?.name]);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarSource]);

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView style={shared.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />

        <View style={styles.headerAccent} />
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.subtitle}>Dados básicos e configurações do aluno.</Text>

        {user && (
          <View style={styles.profileHero}>
          <View style={styles.avatarOuter}>
              <View style={styles.avatarCircle}>
                {avatarSource && !avatarFailed ? (
                  <Image
                    source={avatarSource}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <Text style={styles.avatarText}>{avatarInitials}</Text>
                )}
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{user.name}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
              <View style={styles.roleChip}>
                <Text style={styles.roleText}>{user.profile === 'student' ? 'Aluno' : 'Professor'}</Text>
              </View>
            </View>
            <Pressable style={styles.avatarEditButton} onPress={pickProfilePhoto}>
              <MaterialCommunityIcons name="camera-outline" size={18} color={colors.text} />
            </Pressable>
          </View>
        )}

        <View style={styles.accountCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHalo}>
              <MaterialCommunityIcons name="account-edit-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Dados da conta</Text>
              <Text style={styles.reminderIntro}>Atualize seu nome e e-mail de acesso.</Text>
            </View>
          </View>

          <View style={styles.accountField}>
            <Text style={styles.inputLabel}>Nome</Text>
            <TextInput
              style={styles.accountInput}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Seu nome"
              placeholderTextColor={colors.subtle}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.photoActions}>
            <Pressable style={styles.photoButton} onPress={pickProfilePhoto}>
              <MaterialCommunityIcons name="image-edit-outline" size={21} color={colors.primary} />
              <Text style={styles.photoButtonText}>Escolher foto</Text>
            </Pressable>
            <Pressable style={styles.photoButton} onPress={removeProfilePhoto}>
              <MaterialCommunityIcons name="trash-can-outline" size={21} color={colors.danger} />
              <Text style={styles.photoButtonText}>Remover</Text>
            </Pressable>
          </View>

          <View style={styles.accountField}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <TextInput
              style={styles.accountInput}
              value={profileEmail}
              onChangeText={setProfileEmail}
              placeholder="seu@email.com"
              placeholderTextColor={colors.subtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <Pressable style={[styles.secondaryButton, savingProfile && styles.disabled]} onPress={saveProfile} disabled={savingProfile}>
            <MaterialCommunityIcons name="content-save-outline" size={23} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>{savingProfile ? 'Salvando...' : 'Salvar dados'}</Text>
          </Pressable>
        </View>

        <View style={styles.reminderCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconHalo}>
              <MaterialCommunityIcons name="bell-sleep-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Lembrete de sono</Text>
              <Text style={styles.reminderIntro}>Escolha o horário para receber o lembrete de registrar a noite anterior.</Text>
            </View>
          </View>

          <View style={styles.timeBox}>
            <Text style={styles.inputLabel}>Horário do lembrete</Text>
            <View style={styles.timeInputShell}>
              <MaterialCommunityIcons name="clock-outline" size={24} color={colors.primary} />
              <TextInput
                style={styles.timeInput}
                value={reminderTime}
                onChangeText={(value) => setReminderTime(formatClockInput(value))}
                onBlur={() => setReminderTime(normalizeClockOnBlur(reminderTime))}
                placeholder="0800"
                placeholderTextColor={colors.subtle}
                keyboardType="numeric"
                maxLength={5}
              />
              <MaterialCommunityIcons name="calendar-clock" size={25} color={colors.primary} />
            </View>
            <View style={styles.hintRow}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.subtle} />
              <Text style={styles.hint}>Digite só números. Exemplo: 2130 vira 21:30.</Text>
            </View>
          </View>

          <View style={styles.statusGrid}>
            <View style={styles.statusPill}>
              <MaterialCommunityIcons name="shield-check-outline" size={30} color={colors.primary} />
              <View>
                <Text style={styles.statusLabel}>Permissão</Text>
                <Text style={styles.statusValue}>{notificationStatus}</Text>
              </View>
            </View>
            <View style={styles.statusPill}>
              <MaterialCommunityIcons name="earth" size={30} color={colors.primary} />
              <View style={styles.statusTextWrap}>
                <Text style={styles.statusLabel}>Fuso</Text>
                <Text style={styles.statusValue} numberOfLines={1}>America/Sao_Paulo</Text>
              </View>
            </View>
          </View>

          <Pressable style={[styles.primaryButton, savingReminder && styles.disabled]} onPress={activateReminder} disabled={savingReminder}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color={colors.white} />
            <Text style={styles.primaryButtonText}>{savingReminder ? 'Salvando...' : 'Ativar lembrete'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={disableReminder} disabled={savingReminder}>
            <MaterialCommunityIcons name="bell-off-outline" size={23} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Desativar lembrete</Text>
          </Pressable>

          {notificationStatus === 'negado' && <Text style={styles.warning}>Permissão negada. Ative manualmente as notificações nas configurações do navegador.</Text>}
        </View>

        <View style={styles.teacherGoalsNotice}>
          <View style={styles.noticeIcon}>
            <MaterialCommunityIcons name="lock-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.noticeTextWrap}>
            <Text style={styles.noticeTitle}>Metas de sono</Text>
            <Text style={styles.noticeText}>As metas são definidas pelo professor e aparecem nas áreas de acompanhamento.</Text>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Pressable style={styles.actionRow} onPress={() => navigation.navigate('Insights')}>
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name="chart-line" size={24} color={colors.primary} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Insights</Text>
              <Text style={styles.actionSubtitle}>Análises do seu acompanhamento.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={28} color={colors.subtle} />
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={logout}>
            <MaterialCommunityIcons name="logout" size={22} color={colors.text} />
            <Text style={styles.logoutText}>Sair</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 116,
    backgroundColor: colors.background,
  },
  glowOne: {
    position: 'absolute',
    top: -82,
    right: -92,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139,92,246,0.16)',
  },
  glowTwo: {
    position: 'absolute',
    top: 92,
    left: -120,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(56,189,248,0.08)',
  },
  headerAccent: {
    width: 2,
    height: 34,
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  profileHero: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 26,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 4,
  },
  avatarOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.66)',
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  avatarEditButton: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: { color: colors.text, fontSize: 30, fontWeight: '900' },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 5, letterSpacing: -0.4 },
  profileEmail: { color: colors.muted, fontSize: 14, lineHeight: 19, marginBottom: 10 },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  photoButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  photoButtonText: { color: colors.text, fontWeight: '900', fontSize: 13 },
  accountCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 3,
  },
  accountField: {
    marginBottom: 12,
  },
  accountInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.045)',
    fontSize: 16,
    fontWeight: '800',
  },
  roleChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primarySoft,
  },
  roleText: { color: colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  reminderCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 4,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  iconHalo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  cardHeaderText: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginBottom: 6, letterSpacing: -0.2 },
  reminderIntro: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  timeBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  inputLabel: { color: colors.muted, fontSize: 14, fontWeight: '900', marginBottom: 9 },
  timeInputShell: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139,92,246,0.12)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  timeInput: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    paddingVertical: 4,
  },
  hintRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 },
  hint: { color: colors.subtle, fontSize: 12, lineHeight: 18, flex: 1 },
  statusGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statusPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 12,
    minHeight: 76,
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusTextWrap: { flex: 1, minWidth: 0 },
  statusLabel: { color: colors.muted, fontSize: 13, marginBottom: 3 },
  statusValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  primaryButton: {
    minHeight: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 4,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  secondaryButton: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  teacherGoalsNotice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  noticeTextWrap: { flex: 1, minWidth: 0 },
  noticeTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 4 },
  noticeText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  actionsCard: { marginBottom: 10 },
  actionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  actionTextWrap: { flex: 1, minWidth: 0 },
  actionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 3 },
  actionSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  logoutText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  warning: { color: colors.warning, marginTop: 10, lineHeight: 18 },
  disabled: { opacity: 0.6 },
});
