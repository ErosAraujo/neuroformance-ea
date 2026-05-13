import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../theme';
import ReadinessRing from './ReadinessRing';
import { getIndicatorCopy, HomeMetricResult, MetricDefinition, normalizeClassification } from '../utils/indicatorMeaning';

type Props = {
  metric: MetricDefinition;
  data: HomeMetricResult | null;
  color: string;
  confidenceText: string;
  baseText: string;
};

export default function ExpandedIndicatorCard({ metric, data, color, confidenceText, baseText }: Props) {
  const value = typeof data?.value === 'number' && Number.isFinite(data.value) ? data.value : null;
  const classification = normalizeClassification(data?.classification);
  const copy = getIndicatorCopy(metric.key, value, data?.classification);

  return (
    <View style={[styles.card, { borderColor: color === colors.muted ? colors.border : color }]}> 
      <View style={styles.topRow}>
        <View style={styles.ringWrap}>
          <ReadinessRing value={value} color={color === colors.muted ? colors.primary : color} size={128} strokeWidth={13} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <View style={styles.emojiBubble}><Text style={styles.emoji}>{metric.emoji}</Text></View>
            <Text style={styles.title}>{metric.title}</Text>
          </View>
          <Text style={styles.label}>Estado atual</Text>
          <Text style={[styles.state, { color }]}>{classification.toUpperCase()}</Text>
          <Text style={styles.recommendation}>{copy.recommendation}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.blockTitle}>Como interpretar</Text>
      <View style={styles.interpretationBlock}>
        <View style={styles.miniIcon}><MaterialCommunityIcons name="dumbbell" size={19} color={colors.success} /></View>
        <View style={styles.interpretationBody}>
          <Text style={styles.interpretationTitle}>Para o treino</Text>
          <Text style={styles.interpretationText}>{copy.training}</Text>
        </View>
      </View>
      <View style={styles.interpretationBlock}>
        <View style={styles.miniIcon}><MaterialCommunityIcons name="account-heart-outline" size={19} color={colors.primary} /></View>
        <View style={styles.interpretationBody}>
          <Text style={styles.interpretationTitle}>Para a vida</Text>
          <Text style={styles.interpretationText}>{copy.life}</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.success} />
          <Text style={styles.badgeText}>{confidenceText}</Text>
        </View>
        <View style={styles.badgeSecondary}>
          <MaterialCommunityIcons name="calendar-range" size={16} color={colors.secondary} />
          <Text style={styles.badgeText}>{baseText}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 9,
  },
  emojiBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: {
    fontSize: 19,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  state: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  recommendation: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 15,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  interpretationBlock: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(8,13,30,0.58)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  miniIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interpretationBody: {
    flex: 1,
  },
  interpretationTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  interpretationText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 4,
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
});
