import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import api, { getApiErrorMessage } from '../services/api';
import { Insight } from '../types';
import { colors, shared } from '../theme';

type SectionKey = 'today' | 'week' | 'month';
type InsightsPayload = {
  insufficientDataMessage?: string | null;
  insights?: Insight[];
  blocks?: Array<{ id: string; title: string; value?: string | number | null; message?: string; severity?: string; priority?: string }>;
};
type DisplayInsight = {
  id: string;
  title: string;
  message: string;
  severity?: string;
  recommendedAction?: string;
  value?: string | number | null;
};
type InsightSection = {
  key: SectionKey;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  items: DisplayInsight[];
  loading: boolean;
  error: string | null;
  emptyMessage: string | null;
};

function normalizeInsightPayload(data: any): InsightsPayload {
  if (Array.isArray(data)) return { insights: data };
  return {
    insufficientDataMessage: data?.insufficientDataMessage || null,
    insights: Array.isArray(data?.insights) ? data.insights : [],
    blocks: Array.isArray(data?.blocks) ? data.blocks : [],
  };
}

function severityStyle(severity?: string) {
  const value = String(severity || '').toLowerCase();
  if (value.includes('critical')) return styles.critical;
  if (value.includes('warning')) return styles.warning;
  if (value.includes('attention')) return styles.attention;
  if (value.includes('positive')) return styles.positive;
  return styles.neutral;
}

function payloadToItems(payload: InsightsPayload, prefix: string): DisplayInsight[] {
  const blockItems = (payload.blocks || []).map((block) => ({
    id: `${prefix}-block-${block.id}`,
    title: block.title,
    value: block.value,
    message: block.message || 'Registre mais noites para uma análise mais confiável.',
    severity: block.severity,
  }));
  const insightItems = (payload.insights || []).map((item) => ({
    id: `${prefix}-insight-${item.id}`,
    title: item.title,
    message: item.message || item.description || 'Registre mais noites para uma análise mais confiável.',
    severity: item.severity,
    recommendedAction: item.recommendedAction,
  }));
  return [...blockItems, ...insightItems].filter((item) => item.title && item.message);
}

async function getPayload(path: string) {
  const response = await api.get(path);
  return normalizeInsightPayload(response.data);
}

const emptyText = 'Ainda não há registros suficientes para gerar este grupo de insights.';

export default function InsightsScreen() {
  const [activeSection, setActiveSection] = useState<SectionKey>('today');
  const [sections, setSections] = useState<Record<SectionKey, InsightSection>>({
    today: { key: 'today', title: 'Insights de hoje', subtitle: 'Leitura baseada no registro mais recente.', icon: 'white-balance-sunny', items: [], loading: true, error: null, emptyMessage: null },
    week: { key: 'week', title: 'Insights da semana', subtitle: 'Resumo dos últimos 7 dias.', icon: 'calendar-week', items: [], loading: true, error: null, emptyMessage: null },
    month: { key: 'month', title: 'Insights mensais', subtitle: 'Histórico e tendências dos últimos 30 dias.', icon: 'calendar-month-outline', items: [], loading: true, error: null, emptyMessage: null },
  });

  const fetchInsights = useCallback(async () => {
    setSections((current) => ({
      today: { ...current.today, loading: true, error: null },
      week: { ...current.week, loading: true, error: null },
      month: { ...current.month, loading: true, error: null },
    }));

    const [todayRes, weekRes, historyRes, chartRes] = await Promise.allSettled([
      getPayload('/student/insights?days=1'),
      getPayload('/student/insights?days=7'),
      getPayload('/insights/history?days=30'),
      getPayload('/insights/charts?days=30'),
    ]);

    setSections((current) => {
      const todayPayload = todayRes.status === 'fulfilled' ? todayRes.value : { insights: [] };
      const weekPayload = weekRes.status === 'fulfilled' ? weekRes.value : { insights: [] };
      const historyPayload = historyRes.status === 'fulfilled' ? historyRes.value : { insights: [] };
      const chartPayload = chartRes.status === 'fulfilled' ? chartRes.value : { insights: [] };
      const todayItems = payloadToItems(todayPayload, 'today');
      const weekItems = payloadToItems(weekPayload, 'week');
      const monthItems = [
        ...payloadToItems(historyPayload, 'month-history'),
        ...payloadToItems(chartPayload, 'month-chart'),
      ];

      return {
        today: {
          ...current.today,
          items: todayItems,
          loading: false,
          error: todayRes.status === 'rejected' ? getApiErrorMessage(todayRes.reason, 'Não foi possível carregar os insights de hoje.') : null,
          emptyMessage: todayPayload.insufficientDataMessage || (!todayItems.length ? emptyText : null),
        },
        week: {
          ...current.week,
          items: weekItems,
          loading: false,
          error: weekRes.status === 'rejected' ? getApiErrorMessage(weekRes.reason, 'Não foi possível carregar os insights da semana.') : null,
          emptyMessage: weekPayload.insufficientDataMessage || (!weekItems.length ? emptyText : null),
        },
        month: {
          ...current.month,
          items: monthItems,
          loading: false,
          error: historyRes.status === 'rejected' && chartRes.status === 'rejected'
            ? 'Não foi possível carregar os insights mensais.'
            : null,
          emptyMessage: (!monthItems.length ? emptyText : null),
        },
      };
    });
  }, []);

  useFocusEffect(useCallback(() => { fetchInsights(); }, [fetchInsights]));

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'left', 'right']}>
      <ScrollView style={shared.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={shared.title}>Insights</Text>
        <Text style={shared.subtitle}>Leituras curtas baseadas nos seus registros reais.</Text>
        <View style={styles.sectionSelector}>
          {(Object.keys(sections) as SectionKey[]).map((key) => {
            const section = sections[key];
            const active = activeSection === key;
            return (
              <Pressable key={key} style={[styles.selectorCard, active && styles.selectorCardActive]} onPress={() => setActiveSection(active ? key : key)}>
                <MaterialCommunityIcons name={section.icon} size={20} color={active ? colors.white : colors.subtle} />
                <Text style={[styles.selectorTitle, active && styles.selectorTitleActive]}>{section.title}</Text>
                <Text style={styles.selectorCount}>{section.loading ? '...' : `${section.items.length}`}</Text>
              </Pressable>
            );
          })}
        </View>

        {(Object.keys(sections) as SectionKey[]).map((key) => {
          const section = sections[key];
          const expanded = activeSection === key;
          return (
            <View key={key} style={styles.sectionBlock}>
              <Pressable style={[styles.sectionHeader, expanded && styles.sectionHeaderActive]} onPress={() => setActiveSection(key)}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                </View>
                <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color={colors.text} />
              </Pressable>
              {expanded && (
                <View style={styles.sectionContent}>
                  {section.loading ? (
                    <Text style={shared.muted}>Carregando...</Text>
                  ) : section.error ? (
                    <View style={[shared.card, styles.errorCard]}>
                      <Text style={styles.errorTitle}>Falha ao carregar</Text>
                      <Text style={shared.muted}>{section.error}</Text>
                      <Pressable style={shared.outlineButton} onPress={fetchInsights}><Text style={shared.outlineText}>Tentar novamente</Text></Pressable>
                    </View>
                  ) : section.items.length ? (
                    section.items.map((item) => <InsightCard key={item.id} item={item} />)
                  ) : (
                    <View style={shared.card}>
                      <Text style={shared.muted}>{section.emptyMessage || emptyText}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function InsightCard({ item }: { item: DisplayInsight }) {
  return (
    <View style={[styles.insightCard, severityStyle(item.severity)]}>
      <Text style={styles.insightTitle}>{item.title}</Text>
      {item.value !== undefined && item.value !== null && <Text style={styles.insightValue}>{item.value}</Text>}
      <Text style={styles.insightMessage}>{item.message}</Text>
      {!!item.recommendedAction && <Text style={styles.action}>Ação: {item.recommendedAction}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 170 },
  sectionSelector: { gap: 10, marginBottom: 18 },
  selectorCard: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectorCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectorTitle: { color: colors.text, flex: 1, fontWeight: '900', fontSize: 15 },
  selectorTitleActive: { color: colors.white },
  selectorCount: { color: colors.text, fontWeight: '900' },
  sectionBlock: { marginBottom: 14 },
  sectionHeader: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderActive: { borderColor: colors.borderStrong, backgroundColor: 'rgba(139,92,246,0.16)' },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  sectionSubtitle: { color: colors.muted, marginTop: 4, lineHeight: 18 },
  sectionContent: { marginTop: 10 },
  insightCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, backgroundColor: colors.surfaceAlt, marginBottom: 10 },
  insightTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 6 },
  insightValue: { color: colors.primary, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  insightMessage: { color: colors.muted, lineHeight: 20 },
  positive: { borderColor: colors.success },
  neutral: { borderColor: colors.border },
  attention: { borderColor: colors.warning },
  warning: { borderColor: colors.warning },
  critical: { borderColor: colors.danger },
  action: { color: colors.text, fontWeight: '900', marginTop: 8, lineHeight: 19 },
  errorCard: { borderColor: colors.danger },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 16, marginBottom: 8 },
});
