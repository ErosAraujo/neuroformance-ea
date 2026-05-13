import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import api, { getApiErrorMessage } from '../services/api';
import { SleepRecord } from '../types';
import { colors, shared } from '../theme';
import { buildHistoricalIndicatorPoints, HistoricalIndicatorPoint } from '../utils/historicalIndicators';

type ChartConfigItem = {
  key: keyof HistoricalIndicatorPoint;
  title: string;
  description: string;
  suffix?: string;
  decimals?: number;
  negative?: boolean;
  boolean?: boolean;
};

const charts: ChartConfigItem[] = [
  { key: 'scoreTotal', title: 'Score total', description: 'Score real salvo em cada noite registrada pelo backend.' },
  { key: 'statusGeneral', title: 'Status geral', description: 'Média normalizada dos indicadores do dia, invertendo fadiga e risco.' },
  { key: 'readiness', title: 'Prontidão para treino', description: 'Estimativa de preparo do corpo para treinar com base nos registros recentes.' },
  { key: 'recovery', title: 'Recuperação corporal', description: 'Leitura de recuperação baseada em sono, energia, estado ao acordar e fadiga.' },
  { key: 'fatigue', title: 'Fadiga geral', description: 'Indicador invertido: quanto menor, melhor. O gráfico mostra o valor real da fadiga.', negative: true },
  { key: 'alertness', title: 'Estado de alerta', description: 'Leitura de alerta mental e resposta para o dia.' },
  { key: 'mentalFocus', title: 'Foco mental', description: 'Leitura de clareza mental, humor, estresse e estado de alerta.' },
  { key: 'overloadRisk', title: 'Risco de sobrecarga', description: 'Indicador invertido: quanto menor, melhor. O gráfico mostra o risco real.', negative: true },
  { key: 'totalHours', title: 'Horas dormidas', description: 'Total de horas calculadas entre o horário de dormir e acordar.', suffix: 'h', decimals: 1 },
  { key: 'perceivedQuality', title: 'Qualidade percebida', description: 'Nota marcada pelo aluno de 1 a 5.' },
  { key: 'morningState', title: 'Como acordou', description: 'Nota marcada pelo aluno: 1 muito cansado, 5 bem descansado.' },
  { key: 'energy', title: 'Energia ao acordar', description: 'Nota marcada pelo aluno de 1 a 5.' },
  { key: 'awakenings', title: 'Despertares à noite', description: 'Quantidade de despertares. Quanto menor, melhor.', negative: true },
  { key: 'stress', title: 'Estresse do dia', description: 'Estresse do dia anterior. Quanto menor, melhor.', negative: true },
  { key: 'mood', title: 'Humor ao acordar', description: 'Nota marcada pelo aluno de 1 a 5.' },
  { key: 'generalPain', title: 'Dor muscular geral', description: 'Dor muscular geral. Quanto menor, melhor.', negative: true },
  { key: 'bodyHeaviness', title: 'Sensação de corpo pesado', description: 'Sensação de corpo pesado. Quanto menor, melhor.', negative: true },
  { key: 'regularity', title: 'Regularidade', description: 'Pontuação de regularidade do sono calculada pelo backend.' },
  { key: 'nap', title: 'Cochilo no dia anterior', description: '0 = não marcou; 1 = marcou.', negative: true, boolean: true },
  { key: 'caffeine', title: 'Cafeína após 18h', description: '0 = não marcou; 1 = marcou.', negative: true, boolean: true },
  { key: 'alcohol', title: 'Álcool no dia anterior', description: '0 = não marcou; 1 = marcou.', negative: true, boolean: true },
  { key: 'screenBeforeSleep', title: 'Tela antes de dormir', description: '0 = não marcou; 1 = marcou.', negative: true, boolean: true },
  { key: 'pain', title: 'Dor ao acordar', description: '0 = não marcou; 1 = marcou.', negative: true, boolean: true },
];

export default function GraphScreen() {
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(280, Math.min(windowWidth - 36, 680));

  const fetchRecords = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const res = await api.get('/sleep-records?days=30');
      const list = Array.isArray(res.data) ? [...res.data] : [];
      setRecords(list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Não foi possível carregar os gráficos.'));
      setRecords([]);
    }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchRecords(); }, [fetchRecords]));

  const points = useMemo(() => buildHistoricalIndicatorPoints(records), [records]);

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.title}>Gráficos</Text>
        <Text style={shared.subtitle}>Evolução dos últimos registros com Score Total, Status Geral, indicadores da Home e campos do registro. Tudo com dados reais, porque número inventado é fanfic com planilha.</Text>
        {loadError && (
          <View style={[shared.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>Falha ao carregar gráficos</Text>
            <Text style={shared.muted}>{loadError}</Text>
            <Pressable style={shared.outlineButton} onPress={fetchRecords}><Text style={shared.outlineText}>Tentar novamente</Text></Pressable>
          </View>
        )}
        {loading ? (
          <Text style={shared.muted}>Carregando...</Text>
        ) : points.length ? (
          charts.map((chart) => (
            <Chart
              key={chart.key}
              title={chart.title}
              description={chart.description}
              labels={points.map((point) => point.date.slice(5, 10))}
              data={points.map((point) => point[chart.key] as number | null)}
              suffix={chart.suffix || ''}
              valueSuffix={chart.suffix || ''}
              decimals={chart.decimals ?? 0}
              width={chartWidth}
              negative={Boolean(chart.negative)}
              boolean={Boolean(chart.boolean)}
            />
          ))
        ) : (
          <Text style={shared.muted}>{loadError ? 'Gráficos indisponíveis até a API responder.' : 'Nenhum registro para exibir.'}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatValue(value: number, decimals: number, suffix: string, booleanValue = false) {
  if (booleanValue) return value >= 1 ? 'Sim' : 'Não';
  return `${value.toFixed(decimals)}${suffix}`;
}

function Chart({ title, description, labels, data, suffix, valueSuffix, decimals, width, negative, boolean: booleanValue }: { title: string; description: string; labels: string[]; data: Array<number | null>; suffix: string; valueSuffix: string; decimals: number; width: number; negative: boolean; boolean: boolean }) {
  const valid = data
    .map((value, index) => ({ value, label: labels[index] || '' }))
    .filter((item): item is { value: number; label: string } => typeof item.value === 'number' && Number.isFinite(item.value));

  if (!valid.length) {
    return (
      <View style={shared.card}>
        <Text style={shared.cardTitle}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={shared.muted}>Sem dados suficientes para montar este gráfico.</Text>
      </View>
    );
  }

  const step = valid.length > 7 ? Math.ceil(valid.length / 6) : 1;
  const chartLabels = valid.map((item, index) => (index % step === 0 || index === valid.length - 1 ? item.label : ''));
  const chartValues = valid.map((item) => Number(item.value.toFixed(decimals)));
  const safeValues = chartValues.length === 1 ? [chartValues[0], chartValues[0]] : chartValues;
  const safeLabels = chartValues.length === 1 ? [valid[0].label, ''] : chartLabels;
  const latest = valid[valid.length - 1];
  const max = Math.max(...valid.map((item) => item.value));
  const min = Math.min(...valid.map((item) => item.value));
  const best = negative ? min : max;
  const worst = negative ? max : min;
  const chartConfig = {
    backgroundColor: '#0B1020',
    backgroundGradientFrom: '#0B1020',
    backgroundGradientTo: '#10182E',
    decimalPlaces: decimals,
    color: (opacity = 1) => `rgba(56, 189, 248, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(248, 250, 252, ${opacity})`,
    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
    propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.08)' },
  };
  return (
    <View style={shared.card}>
      <Text style={shared.cardTitle}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.chartWrap}>
        <LineChart
          data={{ labels: safeLabels, datasets: [{ data: safeValues }] }}
          width={width}
          height={220}
          yAxisSuffix={booleanValue ? '' : suffix}
          chartConfig={chartConfig}
          bezier
          fromZero
          style={styles.chart}
        />
      </View>
      <View style={styles.statsRow}>
        <MiniStat label="Atual" value={formatValue(latest.value, decimals, valueSuffix, booleanValue)} accent={colors.success} />
        <MiniStat label={negative ? 'Melhor' : 'Maior'} value={formatValue(best, decimals, valueSuffix, booleanValue)} />
        <MiniStat label={negative ? 'Pior pico' : 'Menor'} value={formatValue(worst, decimals, valueSuffix, booleanValue)} />
      </View>
      <View style={styles.valuesStrip}>
        {valid.slice(-7).map((item) => (
          <View key={`${title}-${item.label}`} style={styles.valuePill}>
            <Text style={styles.valueDate}>{item.label}</Text>
            <Text style={styles.valueText}>{formatValue(item.value, decimals, valueSuffix, booleanValue)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MiniStat({ label, value, accent = colors.text }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniValue, { color: accent }]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { alignItems: 'center', overflow: 'hidden', marginTop: 4 },
  chart: { borderRadius: 18, marginTop: 8 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  miniStat: { flex: 1, minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: 8 },
  miniValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  miniLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  valuesStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  valuePill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 9, backgroundColor: 'rgba(255,255,255,0.055)' },
  valueDate: { color: colors.subtle, fontSize: 10, fontWeight: '800' },
  valueText: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 1 },
  errorCard: { borderColor: colors.danger },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 16, marginBottom: 8 },
});
