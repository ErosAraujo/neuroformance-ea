import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import api, { getApiErrorMessage } from '../services/api';
import { SleepRecord } from '../types';
import { colors, scoreColor, shared } from '../theme';
import { buildHistoricalIndicatorPoints } from '../utils/historicalIndicators';

const scaleValue = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) ? `${value}/5` : 'Não informado';
const yesNo = (value?: boolean | null) => value ? 'Sim' : 'Não';
const metricValue = (value?: number | null, inverted = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Sem dados';
  return inverted ? `${value}/100, menor é melhor` : `${value}/100`;
};
const clockValue = (value?: string | null) => {
  if (!value) return 'Não informado';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Não informado' : parsed.toISOString().slice(11, 16);
};

export default function SleepRecordDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [record, setRecord] = useState<SleepRecord | null>(route.params?.record || null);
  const [loading, setLoading] = useState(!record);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRecord = useCallback(async () => {
    if (!route.params?.id) return;
    setLoading(!record);
    setLoadError(null);
    try {
      const response = await api.get(`/sleep-records/${route.params.id}`);
      setRecord(response.data);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Não foi possível carregar o registro.'));
    } finally {
      setLoading(false);
    }
  }, [route.params?.id, record]);

  useFocusEffect(useCallback(() => { fetchRecord(); }, [fetchRecord]));

  const point = useMemo(() => record ? buildHistoricalIndicatorPoints([record]).slice(-1)[0] : null, [record]);

  if (loading && !record) {
    return (
      <SafeAreaView style={shared.screen} edges={['top', 'left', 'right']}>
        <View style={[shared.screen, shared.content]}><Text style={shared.muted}>Carregando...</Text></View>
      </SafeAreaView>
    );
  }

  if (loadError && !record) {
    return (
      <SafeAreaView style={shared.screen} edges={['top', 'left', 'right']}>
        <View style={[shared.screen, shared.content]}>
          <Text style={styles.errorTitle}>Falha ao carregar registro</Text>
          <Text style={shared.muted}>{loadError}</Text>
          <Pressable style={shared.outlineButton} onPress={fetchRecord}><Text style={shared.outlineText}>Tentar novamente</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={shared.screen} edges={['top', 'left', 'right']}>
        <View style={[shared.screen, shared.content]}><Text style={shared.muted}>Registro não encontrado.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'left', 'right']}>
      <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
        <Text style={shared.title}>{String(record.date).slice(0, 10)}</Text>
        <Text style={shared.subtitle}>Detalhe completo da noite registrada e dos campos que alimentam os indicadores.</Text>
        {loadError && (
          <View style={[shared.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>Não foi possível atualizar os dados</Text>
            <Text style={shared.muted}>{loadError}</Text>
            <Pressable style={shared.outlineButton} onPress={fetchRecord}><Text style={shared.outlineText}>Tentar novamente</Text></Pressable>
          </View>
        )}

        <View style={[shared.card, styles.hero]}>
          <Text style={[styles.score, { color: scoreColor(record.classification) }]}>{record.scoreTotal}</Text>
          <Text style={[styles.classification, { color: scoreColor(record.classification) }]}>{record.classification}</Text>
          <Text style={shared.muted}>Score total da noite</Text>
        </View>

        <View style={shared.card}>
          <Text style={shared.cardTitle}>Dados principais da noite</Text>
          <Item label="Data da noite" value={String(record.date).slice(0, 10)} />
          <Item label="Dormiu" value={clockValue(record.sleepTime)} />
          <Item label="Acordou" value={clockValue(record.wakeTime)} />
          <Item label="Horas dormidas" value={`${Number(record.totalHours).toFixed(2)}h`} />
          <Item label="Qualidade percebida" value={`${record.perceivedQuality}/5`} />
          <Item label="Despertares" value={record.awakenings >= 5 ? '5+' : String(record.awakenings)} />
          <Item label="Como acordou" value={`${record.morningState}/5`} />
          <Item label="Energia ao acordar" value={scaleValue(record.energy)} />
        </View>

        <View style={shared.card}>
          <Text style={shared.cardTitle}>Campos comportamentais</Text>
          <Item label="Estresse do dia anterior" value={scaleValue(record.stress)} />
          <Item label="Humor ao acordar" value={scaleValue(record.mood)} />
          <Item label="Dor muscular geral" value={scaleValue(record.generalPain)} />
          <Item label="Sensação de corpo pesado" value={scaleValue(record.bodyHeaviness)} />
          <Item label="Cochilo no dia anterior" value={yesNo(record.nap)} />
          <Item label="Cafeína após 18h" value={yesNo(record.caffeine)} />
          <Item label="Álcool no dia anterior" value={yesNo(record.alcohol)} />
          <Item label="Tela antes de dormir" value={yesNo(record.screenBeforeSleep)} />
          <Item label="Dor ao acordar" value={yesNo(record.pain)} />
        </View>

        {point && (
          <View style={shared.card}>
            <Text style={shared.cardTitle}>Indicadores estimados neste registro</Text>
            <Item label="Status geral" value={metricValue(point.statusGeneral)} />
            <Item label="Prontidão para treino" value={metricValue(point.readiness)} />
            <Item label="Recuperação corporal" value={metricValue(point.recovery)} />
            <Item label="Fadiga geral" value={metricValue(point.fatigue, true)} />
            <Item label="Estado de alerta" value={metricValue(point.alertness)} />
            <Item label="Foco mental" value={metricValue(point.mentalFocus)} />
            <Item label="Risco de sobrecarga" value={metricValue(point.overloadRisk, true)} />
          </View>
        )}

        <View style={shared.card}>
          <Text style={shared.cardTitle}>Pontuação por pilares</Text>
          <Item label="Duração" value={`${record.scoreDuration}/25`} />
          <Item label="Qualidade" value={`${record.scoreQuality}/25`} />
          <Item label="Continuidade" value={`${record.scoreContinuity}/20`} />
          <Item label="Estado" value={`${record.scoreState}/15`} />
          <Item label="Regularidade" value={`${record.scoreRegularity}/15`} />
        </View>

        <View style={shared.card}>
          <Text style={shared.cardTitle}>Observação</Text>
          <Text style={shared.muted}>{record.notes || 'Sem observação.'}</Text>
        </View>
        <Pressable style={shared.button} onPress={() => navigation.navigate('EditarRegistro', { record })}><Text style={shared.buttonText}>Editar esta noite</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 170 },
  hero: { alignItems: 'center' },
  score: { fontSize: 54, fontWeight: '900', lineHeight: 62 },
  classification: { fontSize: 20, fontWeight: '900' },
  item: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 9, gap: 12 },
  itemLabel: { color: colors.muted, flex: 1, lineHeight: 19 },
  itemValue: { color: colors.text, fontWeight: '900', textAlign: 'right', flex: 1, lineHeight: 19 },
  errorCard: { borderColor: colors.danger },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 16, marginBottom: 8 },
});
