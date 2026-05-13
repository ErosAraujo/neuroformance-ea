import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SleepRecord } from '../types';
import { colors, scoreColor, shared } from '../theme';
import { buildHistoricalIndicatorPoints } from '../utils/historicalIndicators';
import { getStatusClassification, getStatusColor } from '../utils/indicatorMeaning';

function strongestHelp(record: SleepRecord) {
  if (record.totalHours >= 7 && record.totalHours <= 8.5) return 'Boa duração de sono';
  if (record.perceivedQuality >= 4) return 'Boa qualidade percebida';
  if (record.awakenings <= 1) return 'Poucos despertares';
  if (record.scoreRegularity >= 10) return 'Horário relativamente regular';
  return 'Registro feito com consistência';
}

function strongestProblem(record: SleepRecord) {
  if (record.totalHours < 6) return 'Poucas horas dormidas';
  if (record.totalHours > 9.5) return 'Duração acima do ideal planejado';
  if (record.awakenings >= 3) return 'Sono muito interrompido';
  if (record.generalPain && record.generalPain >= 4) return 'Dor muscular elevada';
  if (record.bodyHeaviness && record.bodyHeaviness >= 4) return 'Corpo pesado ao acordar';
  if (record.stress && record.stress >= 4) return 'Estresse alto no dia anterior';
  if (record.screenBeforeSleep) return 'Tela antes de dormir';
  if (record.caffeine) return 'Cafeína à noite';
  if (record.alcohol) return 'Álcool próximo ao sono';
  if (record.scoreRegularity <= 5) return 'Horário irregular';
  return 'Nenhum grande bloqueio registrado';
}

const scaleValue = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) ? `${value}/5` : 'Não informado';
const yesNo = (value?: boolean | null) => value ? 'Sim' : 'Não';
const metricValue = (value?: number | null, inverted = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Sem dados';
  return inverted ? `${value}/100, menor é melhor` : `${value}/100`;
};

export default function ResultsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const record: SleepRecord | undefined = route.params?.record;

  const point = useMemo(() => record ? buildHistoricalIndicatorPoints([record]).slice(-1)[0] : null, [record]);

  if (!record) {
    return (
      <SafeAreaView style={shared.screen} edges={['left', 'right']}>
        <View style={[shared.screen, shared.content]}>
          <Text style={shared.muted}>Nenhum resultado disponível.</Text>
          <Pressable style={shared.button} onPress={() => navigation.goBack()}><Text style={shared.buttonText}>Voltar</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const pillColor = scoreColor(record.classification);
  const statusClassification = getStatusClassification(point?.statusGeneral ?? null);
  const statusColor = getStatusColor(statusClassification);

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.title}>Resultado da noite</Text>
        <Text style={shared.subtitle}>Score calculado pelo backend. Os indicadores da Home são recalculados com base nas últimas noites registradas.</Text>
        <View style={[shared.card, styles.hero]}>
          <Text style={[styles.score, { color: pillColor }]}>{record.scoreTotal}</Text>
          <Text style={[styles.classification, { color: pillColor }]}>{record.classification}</Text>
          <Text style={shared.muted}>{Number(record.totalHours).toFixed(1)}h dormidas</Text>
        </View>

        {point?.statusGeneral !== null && point?.statusGeneral !== undefined && (
          <View style={shared.card}>
            <Text style={shared.cardTitle}>Status geral estimado neste registro</Text>
            <Text style={[styles.statusGeneral, { color: statusColor }]}>{Math.round(point.statusGeneral)}%</Text>
            <Text style={[styles.classification, { color: statusColor }]}>{statusClassification || 'Em cálculo'}</Text>
            <Text style={shared.muted}>Este valor é uma leitura do registro salvo. A Home usa a base mais recente disponível na API.</Text>
          </View>
        )}

        <View style={shared.card}>
          <Text style={shared.cardTitle}>Leitura prática da noite</Text>
          <Text style={styles.help}>+ O que mais ajudou hoje: {strongestHelp(record)}</Text>
          <Text style={styles.problem}>- O que mais atrapalhou hoje: {strongestProblem(record)}</Text>
        </View>

        <View style={shared.card}>
          <Text style={shared.cardTitle}>Campos comportamentais registrados</Text>
          <Info label="Energia ao acordar" value={scaleValue(record.energy)} />
          <Info label="Estresse do dia anterior" value={scaleValue(record.stress)} />
          <Info label="Humor ao acordar" value={scaleValue(record.mood)} />
          <Info label="Dor muscular geral" value={scaleValue(record.generalPain)} />
          <Info label="Sensação de corpo pesado" value={scaleValue(record.bodyHeaviness)} />
          <Info label="Cochilo no dia anterior" value={yesNo(record.nap)} />
          <Info label="Cafeína após 18h" value={yesNo(record.caffeine)} />
          <Info label="Álcool no dia anterior" value={yesNo(record.alcohol)} />
          <Info label="Tela antes de dormir" value={yesNo(record.screenBeforeSleep)} />
          <Info label="Dor ao acordar" value={yesNo(record.pain)} />
        </View>

        {point && (
          <View style={shared.card}>
            <Text style={shared.cardTitle}>Indicadores estimados</Text>
            <Info label="Prontidão para treino" value={metricValue(point.readiness)} />
            <Info label="Recuperação corporal" value={metricValue(point.recovery)} />
            <Info label="Fadiga geral" value={metricValue(point.fatigue, true)} />
            <Info label="Estado de alerta" value={metricValue(point.alertness)} />
            <Info label="Foco mental" value={metricValue(point.mentalFocus)} />
            <Info label="Risco de sobrecarga" value={metricValue(point.overloadRisk, true)} />
          </View>
        )}

        <View style={shared.card}>
          <Text style={shared.cardTitle}>Pontuação por pilares</Text>
          <Pillar label="Duração" value={record.scoreDuration} max={25} />
          <Pillar label="Qualidade percebida" value={record.scoreQuality} max={25} />
          <Pillar label="Continuidade" value={record.scoreContinuity} max={20} />
          <Pillar label="Estado ao acordar" value={record.scoreState} max={15} />
          <Pillar label="Regularidade" value={record.scoreRegularity} max={15} />
        </View>
        <Text style={styles.disclaimer}>Informação comportamental. Não é diagnóstico, tratamento ou recomendação de remédio.</Text>
        <Pressable style={shared.button} onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}><Text style={shared.buttonText}>Voltar para home</Text></Pressable>
        <Pressable style={shared.outlineButton} onPress={() => navigation.navigate('DetalheRegistro', { id: record.id, record })}><Text style={shared.outlineText}>Ver detalhe completo</Text></Pressable>
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

function Pillar({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={styles.pillar}>
      <View style={styles.pillarHeader}><Text style={shared.text}>{label}</Text><Text style={shared.muted}>{value}/{max}</Text></View>
      <View style={styles.bar}><View style={[styles.fill, { width: `${percent}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  score: { fontSize: 72, fontWeight: '900', lineHeight: 80 },
  classification: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  statusGeneral: { fontSize: 48, fontWeight: '900', lineHeight: 56 },
  help: { color: colors.success, fontWeight: '900', marginBottom: 8, lineHeight: 20 },
  problem: { color: colors.warning, fontWeight: '900', lineHeight: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 9 },
  infoLabel: { color: colors.muted, flex: 1, lineHeight: 19 },
  infoValue: { color: colors.text, fontWeight: '900', textAlign: 'right', flex: 1, lineHeight: 19 },
  pillar: { marginBottom: 14 },
  pillarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bar: { height: 10, backgroundColor: colors.surfaceAlt, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.primary, borderRadius: 999 },
  disclaimer: { color: colors.muted, fontSize: 12, textAlign: 'center', marginBottom: 12 },
});
