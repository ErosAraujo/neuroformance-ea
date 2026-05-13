import React, { useState, useContext } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme';
import { getApiErrorMessage } from '../services/api';

const logoIcon = require('../../assets/logo-icon.png');

const metricCards = [
  { icon: '💚', title: 'Recuperação corporal', value: '78%', status: 'Boa', color: colors.success },
  { icon: '⚡', title: 'Fadiga geral', value: '35%', status: 'Moderada', color: '#FBBF24' },
  { icon: '👁️', title: 'Estado de alerta', value: '74%', status: 'Bom', color: '#3B82F6' },
  { icon: '🧠', title: 'Foco mental', value: '68%', status: 'Bom', color: colors.primary },
];

const benefits = [
  ['🌙', 'Registro da noite anterior', 'Informe seu sono e como você se sentiu.'],
  ['〽️', 'Indicadores do dia', 'Veja seus níveis de recuperação, alerta e foco.'],
  ['🗓️', 'Histórico pessoal', 'Acompanhe sua evolução ao longo do tempo.'],
  ['🎯', 'Mais clareza para treinar', 'Entenda seu estado atual e treine com propósito.'],
];

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim() || !password) return setError('Preencha e-mail/nome e senha.');
    setLoading(true);
    try { setError(null); await login(email.trim(), password); }
    catch (err: any) { setError(getApiErrorMessage(err, 'Login/e-mail ou senha inválidos.')); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroColumn}>
            <Image source={logoIcon} style={styles.logo} resizeMode="cover" />
            <Text style={styles.brand}>Neuroformance <Text style={styles.brandAccent}>EA</Text></Text>
            <Text style={styles.brandSubtitle}>Sistema de prontidão, reflexo e performance</Text>

            <Text style={styles.heroTitle}>Seu acompanhamento diário em uma <Text style={styles.heroAccent}>única tela.</Text></Text>
            <Text style={styles.heroText}>Registre seu sono, acompanhe sua recuperação e entenda seu status do dia sem complicação.</Text>

            <View style={styles.benefitsList}>
              {benefits.map(([icon, title, text]) => (
                <View style={styles.benefitRow} key={title}>
                  <View style={styles.benefitIcon}><Text style={styles.benefitIconText}>{icon}</Text></View>
                  <View style={styles.benefitCopy}><Text style={styles.benefitTitle}>{title}</Text><Text style={styles.benefitText}>{text}</Text></View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.previewColumn}>
            <View style={styles.statusPanel}>
              <View style={styles.panelHeader}>
                <View><Text style={styles.panelGreeting}>Olá, aluno! 👋</Text><Text style={styles.panelSubtitle}>Aqui está o seu status de hoje.</Text></View>
                <View style={styles.datePill}><Text style={styles.dateText}>📅 13 de Maio, 2026</Text></View>
              </View>

              <Text style={styles.sectionTitle}>Visão geral do dia</Text>
              <View style={styles.generalCard}>
                <View style={styles.ring}><Text style={styles.ringValue}>72%</Text><Text style={styles.ringLabel}>Prontidão geral</Text><Text style={styles.ringStatus}>Boa</Text></View>
                <View style={styles.generalCopy}><Text style={styles.star}>✫</Text><Text style={styles.generalTitle}>Você está bem preparado para o dia!</Text><Text style={styles.generalText}>Mantenha o foco, hidrate-se e respeite seus sinais do corpo.</Text></View>
              </View>

              <View style={styles.metricGrid}>
                {metricCards.map((item) => (
                  <View style={[styles.metricCard, { borderColor: item.color + '55' }]} key={item.title}>
                    <View style={[styles.metricIcon, { backgroundColor: item.color + '22' }]}><Text style={styles.metricIconText}>{item.icon}</Text></View>
                    <View style={styles.metricCopy}><Text style={styles.metricTitle}>{item.title}</Text><Text style={styles.metricValue}>{item.value} <Text style={[styles.metricStatus, { color: item.color }]}>{item.status}</Text></Text><View style={styles.track}><View style={[styles.fill, { backgroundColor: item.color, width: item.value as any }]} /></View></View>
                  </View>
                ))}
              </View>

              <View style={styles.riskCard}><Text style={styles.riskIcon}>🛡️</Text><View style={styles.riskCopy}><Text style={styles.metricTitle}>Risco de sobrecarga</Text><Text style={styles.lowRisk}>Baixo</Text></View><Text style={styles.riskValue}>18%</Text></View>
              <View style={styles.historyButton}><Text style={styles.historyText}>▥ Ver histórico completo</Text><Text style={styles.historyArrow}>›</Text></View>
            </View>
          </View>

          <View style={styles.loginColumn}>
            <View style={styles.loginCard}>
              <View style={styles.tabs}><Pressable style={styles.tabActive} onPress={() => undefined}><Text style={styles.tabActiveText}>Entrar</Text></Pressable><Pressable style={styles.tab} onPress={() => navigation.navigate('Register')} disabled={loading}><Text style={styles.tabText}>Criar conta</Text></Pressable></View>
              <Text style={styles.label}>E-mail ou nome do aluno</Text>
              <TextInput style={styles.input} placeholder="E-mail ou nome" placeholderTextColor="#8791A8" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="default" editable={!loading} />
              <Text style={styles.label}>Senha</Text>
              <TextInput style={styles.input} placeholder="Senha" placeholderTextColor="#8791A8" value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />
              <View style={styles.optionsRow}><Pressable style={styles.remember} onPress={() => setRemember(v => !v)} disabled={loading}><View style={[styles.checkbox, remember && styles.checkboxActive]} /><Text style={styles.rememberText}>Lembrar login</Text></Pressable><Text style={styles.forgot}>Esqueci minha senha</Text></View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable style={[styles.button, loading && styles.disabled]} onPress={handleLogin} disabled={loading}><Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text></Pressable>
              <View style={styles.lockSeal}><Text style={styles.lockSealText}>🔒</Text></View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#030716' },
  scroll: { minHeight: '100%', paddingHorizontal: 18, paddingVertical: 22, gap: 22, backgroundColor: '#030716' },
  heroColumn: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  previewColumn: { width: '100%', maxWidth: 660, alignSelf: 'center' },
  loginColumn: { width: '100%', maxWidth: 420, alignSelf: 'center', paddingBottom: 18 },
  logo: { width: 112, height: 112, borderRadius: 28, marginBottom: 16, shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 30 },
  brand: { color: colors.text, fontSize: 28, fontStyle: 'italic', fontWeight: '900', letterSpacing: -0.8 },
  brandAccent: { color: '#7A7CFF' },
  brandSubtitle: { color: '#C7D2FE', fontSize: 13, marginTop: 4, marginBottom: 34 },
  heroTitle: { color: colors.text, fontSize: 36, lineHeight: 45, fontWeight: '900', letterSpacing: -1.2, marginBottom: 18 },
  heroAccent: { color: colors.primary },
  heroText: { color: '#D5DBEA', fontSize: 17, lineHeight: 28, marginBottom: 30 },
  benefitsList: { gap: 18 },
  benefitRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  benefitIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, backgroundColor: 'rgba(24,17,55,0.78)' },
  benefitIconText: { fontSize: 25 },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 4 },
  benefitText: { color: '#B7C0D6', fontSize: 13.5, lineHeight: 19 },
  statusPanel: { borderWidth: 1, borderColor: 'rgba(139,92,246,0.72)', borderRadius: 28, padding: 20, backgroundColor: 'rgba(8,13,29,0.94)', shadowColor: colors.primary, shadowOpacity: 0.32, shadowRadius: 30 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 22 },
  panelGreeting: { color: colors.text, fontWeight: '900', fontSize: 19 },
  panelSubtitle: { color: '#AEB7CC', marginTop: 4 },
  datePill: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  dateText: { color: '#CBD5E1', fontSize: 12 },
  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 16, marginBottom: 12 },
  generalCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18, flexDirection: 'row', gap: 18, alignItems: 'center', backgroundColor: 'rgba(2,6,18,0.35)' },
  ring: { width: 140, height: 140, borderRadius: 70, borderWidth: 13, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,18,0.48)' },
  ringValue: { color: colors.text, fontSize: 34, fontWeight: '900' },
  ringLabel: { color: colors.text, fontWeight: '800', fontSize: 12 },
  ringStatus: { color: colors.primary, fontWeight: '900', marginTop: 4 },
  generalCopy: { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 18 },
  star: { color: '#7BA5FF', fontSize: 22, marginBottom: 10 },
  generalTitle: { color: colors.text, fontWeight: '900', marginBottom: 9 },
  generalText: { color: '#C2CADB', lineHeight: 20 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  metricCard: { width: '48%', minWidth: 230, flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12, backgroundColor: 'rgba(8,13,29,0.74)' },
  metricIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  metricIconText: { fontSize: 24 },
  metricCopy: { flex: 1 },
  metricTitle: { color: colors.text, fontWeight: '900', fontSize: 13, marginBottom: 6 },
  metricValue: { color: colors.text, fontWeight: '900', fontSize: 25 },
  metricStatus: { fontSize: 12, fontWeight: '900' },
  track: { height: 7, borderRadius: 999, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  fill: { height: 7, borderRadius: 999 },
  riskCard: { borderWidth: 1, borderColor: 'rgba(250,204,21,0.35)', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, backgroundColor: 'rgba(8,13,29,0.72)' },
  riskIcon: { fontSize: 29 },
  riskCopy: { flex: 1 },
  lowRisk: { color: colors.success, fontWeight: '900' },
  riskValue: { color: colors.success, fontSize: 23, fontWeight: '900' },
  historyButton: { marginTop: 14, height: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: 'rgba(88,54,185,0.28)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  historyText: { color: colors.text, fontWeight: '900' },
  historyArrow: { color: colors.muted, fontSize: 28 },
  loginCard: { borderWidth: 1, borderColor: 'rgba(139,92,246,0.78)', borderRadius: 26, padding: 22, backgroundColor: 'rgba(8,13,29,0.96)', shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 28 },
  tabs: { height: 56, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 26 },
  tabActive: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: colors.primary },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabActiveText: { color: colors.text, fontWeight: '900', fontSize: 17 },
  tabText: { color: '#A7B0C6', fontWeight: '800', fontSize: 17 },
  label: { color: colors.text, fontWeight: '900', marginBottom: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.055)', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 16 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: colors.primary },
  checkboxActive: { backgroundColor: colors.primary },
  rememberText: { color: '#D7DDEE', fontWeight: '700' },
  forgot: { color: '#B36BFF', fontWeight: '800' },
  error: { color: colors.danger, marginBottom: 12, fontWeight: '800' },
  button: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 13, alignItems: 'center', marginTop: 2, shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 18 },
  buttonText: { color: colors.white, fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.65 },
  lockSeal: { alignSelf: 'center', marginTop: 26, width: 78, height: 78, borderRadius: 39, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,29,58,0.7)' },
  lockSealText: { fontSize: 28 },
});
