import React, { useContext, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, StatusBar } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import api, { getApiErrorMessage, getApiBaseUrl } from '../services/api';
import { Alert as SleepAlert, DailyIndicators, RecoverySummary, SleepRecord, WeeklySummary } from '../types';
import { colors } from '../theme';
import ReadinessRing from '../components/ReadinessRing';
import MetricCard from '../components/MetricCard';
import WeeklyChart from '../components/WeeklyChart';
import ExpandedIndicatorCard from '../components/ExpandedIndicatorCard';
import {
  getConfidence,
  getIndicatorColor,
  getMetric,
  getStatusClassification,
  getStatusColor,
  getStatusGeneralRecommendation,
  getStatusGeneralScore,
  MetricKey,
  metricDefinitions,
  normalizeClassification,
} from '../utils/indicatorMeaning';
import { buildWeeklyStatusPoints } from '../utils/historicalIndicators';

type HomeErrors = Partial<Record<'record' | 'summary' | 'recovery' | 'alerts' | 'history' | 'indicators', string>>;

type SummaryCardProps = {
  value: string;
  label: string;
  accent?: string;
};

function formatTrend(value?: string | null) {
  if (!value) return '--';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatAverageHours(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  const [lastRecord, setLastRecord] = useState<SleepRecord | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [recoverySummary, setRecoverySummary] = useState<RecoverySummary | null>(null);
  const [indicators, setIndicators] = useState<DailyIndicators | null>(null);
  const [baseReduced, setBaseReduced] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<SleepAlert[]>([]);
  const [historyRecords, setHistoryRecords] = useState<SleepRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<HomeErrors>({});
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<MetricKey | null>(null);

  const fetchHomeData = useCallback(async () => {
    setLoading(true);
    const nextErrors: HomeErrors = {};

    const [recordRes, summaryRes, recoveryRes, alertsRes, historyRes, indicatorsRes] = await Promise.allSettled([
      api.get('/sleep-records/last'),
      api.get('/sleep-records/weekly-summary'),
      api.get('/sleep-records/recovery-summary'),
      api.get('/alerts/mine'),
      api.get('/sleep-records?days=7'),
      api.get('/indicators/daily'),
    ]);

    if (recordRes.status === 'fulfilled') setLastRecord(recordRes.value.data);
    else nextErrors.record = getApiErrorMessage(recordRes.reason, 'Não foi possível carregar o último registro.');

    if (summaryRes.status === 'fulfilled') setWeeklySummary(summaryRes.value.data);
    else nextErrors.summary = getApiErrorMessage(summaryRes.reason, 'Não foi possível carregar o resumo semanal.');

    if (recoveryRes.status === 'fulfilled') setRecoverySummary(recoveryRes.value.data);
    else nextErrors.recovery = getApiErrorMessage(recoveryRes.reason, 'Não foi possível carregar a recuperação.');

    if (alertsRes.status === 'fulfilled') setAlerts(Array.isArray(alertsRes.value.data) ? alertsRes.value.data : []);
    else nextErrors.alerts = getApiErrorMessage(alertsRes.reason, 'Não foi possível carregar os alertas.');

    if (historyRes.status === 'fulfilled') setHistoryRecords(Array.isArray(historyRes.value.data) ? historyRes.value.data : []);
    else nextErrors.history = getApiErrorMessage(historyRes.reason, 'Não foi possível carregar a evolução semanal.');

    if (indicatorsRes.status === 'fulfilled') {
      const data = indicatorsRes.value.data as DailyIndicators;
      if (data && data.hasData) {
        setIndicators(data);
        setBaseReduced(Boolean(data.baseReduced));
      } else {
        setIndicators(null);
        setBaseReduced(true);
      }
    } else {
      nextErrors.indicators = getApiErrorMessage(indicatorsRes.reason, 'Não foi possível carregar os indicadores diários.');
      setIndicators(null);
      setBaseReduced(true);
    }

    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchHomeData(); }, [fetchHomeData]));

  const confidence = getConfidence(indicators);
  const confidenceText = confidence !== null ? `Confiança: ${confidence}%` : 'Confiança: em cálculo';
  const recordsBaseText = indicators?.recordsUsed ? `Base: últimas ${indicators.recordsUsed} noite${indicators.recordsUsed > 1 ? 's' : ''}` : lastRecord ? 'Base: último registro disponível' : 'Base: aguardando registros';
  const statusGeneral = useMemo(() => getStatusGeneralScore(indicators), [indicators]);
  const statusClassification = getStatusClassification(statusGeneral.score);
  const statusColor = getStatusColor(statusClassification);
  const statusRecommendation = getStatusGeneralRecommendation(statusClassification);
  const hasErrors = Object.keys(errors).length > 0;
  const weeklyAverageHours = formatAverageHours(weeklySummary?.averageHours);
  const selectedDefinition = metricDefinitions.find((metric) => metric.key === selectedIndicatorKey) || null;
  const selectedData = selectedDefinition ? getMetric(indicators, selectedDefinition.key) : null;
  const selectedColor = selectedDefinition ? getIndicatorColor(selectedData?.classification, selectedDefinition.negative, selectedData?.value, selectedDefinition.key) : colors.muted;
  const weeklyStatusPoints = useMemo(() => buildWeeklyStatusPoints(historyRecords, statusGeneral.score), [historyRecords, statusGeneral.score]);

  const toggleIndicator = (key: MetricKey) => {
    setSelectedIndicatorKey((current) => current === key ? null : key);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchHomeData} tintColor={colors.primary} />}
      >
        <View pointerEvents="none" style={styles.glowOne} />
        <View pointerEvents="none" style={styles.glowTwo} />

        <View style={styles.appHeader}>
          <View style={styles.brandBlock}>
            <View style={styles.logoBox}>
              <MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.success} />
            </View>
            <View style={styles.brandTextBlock}>
              <Text style={styles.brandTitle}>Neuroformance EA</Text>
              <Text style={styles.brandSubtitle}>Sistema de prontidão, reflexo e performance</Text>
            </View>
          </View>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greetingSmall}>Bom dia,</Text>
          <Text style={styles.greetingName}>{user?.name || 'Aluno'}!</Text>
          <Text style={styles.greetingText}>Seu corpo fala. Nós traduzimos.</Text>
        </View>

        {hasErrors && (
          <View style={[styles.glassCard, styles.errorCard]}>
            <Text style={styles.errorTitle}>Alguns dados não carregaram</Text>
            {Object.values(errors).map((msg) => <Text key={msg} style={styles.errorText}>• {msg}</Text>)}
            <Text style={styles.apiHint}>API configurada: {getApiBaseUrl()}</Text>
            <Pressable style={styles.retryButton} onPress={fetchHomeData}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        )}

        {selectedDefinition ? (
          <ExpandedIndicatorCard
            metric={selectedDefinition}
            data={selectedData}
            color={selectedColor}
            confidenceText={confidenceText}
            baseText={recordsBaseText}
          />
        ) : (
          <View style={[styles.mainCard, { borderColor: statusColor === colors.muted ? colors.border : statusColor }]}> 
            <View style={styles.mainCardContent}>
              <View style={styles.mainRingBlock}>
                <ReadinessRing value={statusGeneral.score} color={statusColor === colors.muted ? colors.primary : statusColor} size={136} strokeWidth={14} />
                <View style={styles.statusEmojiBadge}><Text style={styles.statusEmoji}>💪🎯</Text></View>
              </View>
              <View style={styles.mainInfo}>
                <Text style={styles.mainLabel}>Seu STATUS GERAL</Text>
                <Text style={[styles.mainStatus, { color: statusColor }]}>{normalizeClassification(statusClassification).toUpperCase()}</Text>
                <Text style={styles.mainDescription}>Resumo geral do seu estado físico e mental hoje, com base nos sinais de recuperação, energia, foco, fadiga e risco de sobrecarga.</Text>
              </View>
            </View>
            <View style={styles.recommendationBox}>
              <Text style={styles.recommendationTitle}>Recomendação de hoje</Text>
              <Text style={styles.recommendationText}>{statusRecommendation}</Text>
            </View>
            <View style={styles.mainDivider} />
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <MaterialCommunityIcons name="shield-check-outline" size={17} color={colors.success} />
                <Text style={styles.badgeText}>{confidenceText}</Text>
              </View>
              <View style={styles.badgeSecondary}>
                <MaterialCommunityIcons name="calendar-range" size={17} color={colors.secondary} />
                <Text style={styles.badgeText}>{recordsBaseText}</Text>
              </View>
            </View>
            {statusGeneral.componentsCount > 0 && <Text style={styles.componentsText}>Cálculo feito com {statusGeneral.componentsCount} indicador{statusGeneral.componentsCount > 1 ? 'es' : ''} disponível{statusGeneral.componentsCount > 1 ? 'is' : ''}.</Text>}
            {baseReduced && <Text style={styles.reducedBaseText}>Base reduzida: cálculo feito com menos de 3 noites registradas.</Text>}
          </View>
        )}

        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Registrar', { resetFormNonce: Date.now() })}>
          <MaterialCommunityIcons name="weather-night" size={22} color={colors.white} />
          <Text style={styles.primaryButtonText}>Registrar noite anterior</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>SEUS INDICADORES HOJE</Text>
        <View style={styles.metricsGrid}>
          {metricDefinitions.map((metric) => {
            const data = getMetric(indicators, metric.key);
            const color = getIndicatorColor(data?.classification, metric.negative, data?.value, metric.key);
            return (
              <MetricCard
                key={metric.key}
                title={metric.title}
                emoji={metric.emoji}
                value={data?.value}
                classification={data?.classification}
                color={color}
                negative={metric.negative}
                valueSuffix={metric.valueSuffix}
                selected={selectedIndicatorKey === metric.key}
                onPress={() => toggleIndicator(metric.key)}
              />
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>STATUS GERAL — ÚLTIMOS 7 DIAS</Text>
        <WeeklyChart points={weeklyStatusPoints} />
        {errors.history && <Text style={styles.inlineWarning}>{errors.history}</Text>}

        {weeklySummary ? (
          <>
            <Text style={styles.sectionTitle}>RESUMO DA SEMANA</Text>
            <View style={styles.summaryGrid}>
              <SummaryCard value={Number(weeklySummary.averageScore).toFixed(1)} label="Média" />
              <SummaryCard value={formatTrend(weeklySummary.trend)} label="Tendência" accent={colors.secondary} />
              <SummaryCard value={String(weeklySummary.goodNights)} label="Boas noites" />
              {weeklyAverageHours && <SummaryCard value={weeklyAverageHours} label="Média de sono" accent={colors.primary} />}
              {typeof weeklySummary.adherence === 'number' && <SummaryCard value={`${Number(weeklySummary.adherence).toFixed(0)}%`} label="Adesão" />}
              {typeof weeklySummary.badNights === 'number' && <SummaryCard value={String(weeklySummary.badNights)} label="Noite ruim" />}
            </View>
          </>
        ) : errors.summary ? (
          <Text style={styles.inlineWarning}>{errors.summary}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>ALERTAS ATIVOS</Text>
        <View style={[styles.glassCard, styles.alertCard]}>
          <View style={styles.alertHeader}>
            <View style={styles.alertIcon}>
              <MaterialCommunityIcons name="shield-check-outline" size={21} color={alerts.length ? colors.warning : colors.success} />
            </View>
            <View style={styles.alertBody}>
              <Text style={styles.alertTitle}>{alerts.length ? 'Atenção aos alertas' : 'Tudo sob controle'}</Text>
              {errors.alerts ? (
                <Text style={styles.errorText}>{errors.alerts}</Text>
              ) : alerts.length ? (
                alerts.slice(0, 4).map((alert) => <Text key={alert.id} style={styles.alertText}>• {alert.description}</Text>)
              ) : (
                <Text style={styles.alertText}>Nenhum alerta crítico no momento.</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ value, label, accent = colors.text }: SummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 112,
  },
  glowOne: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(139,92,246,0.22)',
  },
  glowTwo: {
    position: 'absolute',
    top: 40,
    right: -130,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  brandTextBlock: {
    flex: 1,
  },
  brandTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  brandSubtitle: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
    maxWidth: 260,
  },
  greetingBlock: {
    marginBottom: 22,
  },
  greetingSmall: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  greetingName: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  greetingText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.065)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 4,
  },
  mainCard: {
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    marginBottom: 18,
    width: '100%',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 5,
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mainRingBlock: {
    position: 'relative',
  },
  statusEmojiBadge: {
    position: 'absolute',
    right: -2,
    top: -6,
    minWidth: 45,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusEmoji: {
    fontSize: 17,
  },
  mainInfo: {
    flex: 1,
    minWidth: 0,
  },
  mainLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  mainStatus: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  mainDescription: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  recommendationBox: {
    backgroundColor: 'rgba(8,13,30,0.55)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 13,
    marginTop: 15,
    alignSelf: 'stretch',
    width: '100%',
  },
  recommendationTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recommendationText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  mainDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.32)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56,189,248,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  componentsText: {
    color: colors.subtle,
    fontSize: 12,
    marginTop: 9,
    lineHeight: 18,
  },
  reducedBaseText: {
    color: colors.warning,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: 0.9,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    width: '31.8%',
    minHeight: 78,
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '700',
  },
  alertCard: {
    borderColor: 'rgba(34,197,94,0.35)',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  alertHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  alertBody: {
    flex: 1,
  },
  alertTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 4,
  },
  alertText: {
    color: colors.text,
    lineHeight: 19,
    fontSize: 12,
  },
  errorCard: {
    borderColor: colors.warning,
  },
  errorTitle: {
    color: colors.warning,
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 8,
  },
  errorText: {
    color: colors.warning,
    lineHeight: 20,
    marginBottom: 4,
  },
  apiHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  retryText: {
    color: colors.warning,
    fontWeight: '900',
  },
  inlineWarning: {
    color: colors.warning,
    lineHeight: 19,
    marginBottom: 14,
  },
});
