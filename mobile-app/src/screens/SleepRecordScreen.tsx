import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, Switch, Pressable } from 'react-native';
import { differenceInMinutes, parse } from 'date-fns';
import api, { getApiErrorMessage } from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, shared } from '../theme';
import { SleepRecord } from '../types';

const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => formatLocalDate(new Date());
const previousNightDate = () => { const date = new Date(); date.setDate(date.getDate() - 1); return formatLocalDate(date); };
const scaleOptions = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']];
const awakeningOptions = [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5+']];
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const toClock = (value: string) => {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(11, 16);
};
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const parseLocalDate = (value: string) => {
  if (!validDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const futureDate = (value: string) => value > today();
const validTime = (value: string) => /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) <= 23 && Number(value.slice(3)) <= 59;
const inRange = (value: string, min: number, max: number) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
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
const clampFivePlusAwakenings = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return String(Math.max(0, Math.min(5, Math.round(parsed))));
};
const clampScale = (value: unknown, fallback = '3') => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(Math.max(1, Math.min(5, Math.round(parsed))));
};

function initialRecordValues(record?: SleepRecord | null) {
  return {
    date: record ? String(record.date).slice(0, 10) : previousNightDate(),
    sleepTime: record ? toClock(record.sleepTime) : '23:00',
    wakeTime: record ? toClock(record.wakeTime) : '06:30',
    quality: record ? clampScale(record.perceivedQuality) : '3',
    awakenings: record ? clampFivePlusAwakenings(record.awakenings) : '0',
    morningState: record ? clampScale(record.morningState) : '3',
    energy: record ? clampScale(record.energy) : '3',
    nap: Boolean(record?.nap),
    caffeine: Boolean(record?.caffeine),
    alcohol: Boolean(record?.alcohol),
    screenBeforeSleep: Boolean(record?.screenBeforeSleep),
    stress: record?.stress !== undefined && record?.stress !== null ? clampScale(record.stress) : '',
    pain: Boolean(record?.pain),
    generalPain: record?.generalPain !== undefined && record?.generalPain !== null ? clampScale(record.generalPain) : '',
    bodyHeaviness: record?.bodyHeaviness !== undefined && record?.bodyHeaviness !== null ? clampScale(record.bodyHeaviness) : '',
    mood: record?.mood !== undefined && record?.mood !== null ? clampScale(record.mood) : '',
    notes: record?.notes || '',
  };
}

export default function SleepRecordScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const routeRecord: SleepRecord | null = route.params?.record || null;
  const resetFormNonce = route.params?.resetFormNonce;
  const initial = initialRecordValues(routeRecord);
  const [editRecord, setEditRecord] = useState<SleepRecord | null>(routeRecord);
  const [date, setDate] = useState(initial.date);
  const [sleepTime, setSleepTime] = useState(initial.sleepTime);
  const [wakeTime, setWakeTime] = useState(initial.wakeTime);
  const [quality, setQuality] = useState(initial.quality);
  const [awakenings, setAwakenings] = useState(initial.awakenings);
  const [morningState, setMorningState] = useState(initial.morningState);
  const [energy, setEnergy] = useState(initial.energy);
  const [nap, setNap] = useState(initial.nap);
  const [caffeine, setCaffeine] = useState(initial.caffeine);
  const [alcohol, setAlcohol] = useState(initial.alcohol);
  const [screenBeforeSleep, setScreenBeforeSleep] = useState(initial.screenBeforeSleep);
  const [stress, setStress] = useState(initial.stress);
  const [pain, setPain] = useState(initial.pain);
  const [generalPain, setGeneralPain] = useState(initial.generalPain);
  const [bodyHeaviness, setBodyHeaviness] = useState(initial.bodyHeaviness);
  const [mood, setMood] = useState(initial.mood);
  const [notes, setNotes] = useState(initial.notes.slice(0, 200));
  const [saving, setSaving] = useState(false);

  const applyRecordToForm = useCallback((record: SleepRecord | null) => {
    const values = initialRecordValues(record);
    setEditRecord(record);
    setDate(values.date);
    setSleepTime(values.sleepTime);
    setWakeTime(values.wakeTime);
    setQuality(values.quality);
    setAwakenings(values.awakenings);
    setMorningState(values.morningState);
    setEnergy(values.energy);
    setNap(values.nap);
    setCaffeine(values.caffeine);
    setAlcohol(values.alcohol);
    setScreenBeforeSleep(values.screenBeforeSleep);
    setStress(values.stress);
    setPain(values.pain);
    setGeneralPain(values.generalPain);
    setBodyHeaviness(values.bodyHeaviness);
    setMood(values.mood);
    setNotes(values.notes.slice(0, 200));
  }, []);

  useEffect(() => {
    if (!resetFormNonce) return;
    applyRecordToForm(null);
    try { navigation.setParams?.({ record: undefined, resetFormNonce: undefined }); } catch {}
  }, [resetFormNonce, applyRecordToForm, navigation]);

  useEffect(() => {
    if (routeRecord?.id && routeRecord.id !== editRecord?.id) applyRecordToForm(routeRecord);
  }, [routeRecord?.id, editRecord?.id, applyRecordToForm]);

  const goToNewRecordForm = () => {
    applyRecordToForm(null);
    try { navigation.setParams?.({ record: undefined, resetFormNonce: undefined }); } catch {}
    navigation.navigate('Tabs', { screen: 'Registrar', params: { record: undefined, resetFormNonce: Date.now() } });
  };

  const calculateTotalHours = () => {
    try {
      if (!validTime(sleepTime) || !validTime(wakeTime)) return '0.00';
      const sleep = parse(sleepTime, 'HH:mm', new Date());
      const wake = parse(wakeTime, 'HH:mm', new Date());
      let diff = differenceInMinutes(wake, sleep);
      if (diff <= 0) diff += 24 * 60;
      return (diff / 60).toFixed(2);
    } catch { return '0.00'; }
  };

  const validate = () => {
    if (!validDate(date)) return 'Data inválida. Use uma data real no formato AAAA-MM-DD.';
    if (futureDate(date)) return 'Não é permitido registrar sono em data futura.';
    if (!validTime(sleepTime) || !validTime(wakeTime)) return 'Horário inválido. Digite quatro números, como 2300 ou 0630.';
    try {
      const sleep = parse(sleepTime, 'HH:mm', new Date());
      const wake = parse(wakeTime, 'HH:mm', new Date());
      let diff = differenceInMinutes(wake, sleep);
      if (diff <= 0) diff += 24 * 60;
      if (diff > 18 * 60) return 'O intervalo total de sono não pode ser superior a 18 horas.';
    } catch { /* validação de horário já cobre o formato */ }
    if (!inRange(quality, 1, 5)) return 'Qualidade deve ficar entre 1 e 5.';
    if (!inRange(awakenings, 0, 5)) return 'Despertares deve ficar entre 0 e 5+.';
    if (!inRange(morningState, 1, 5)) return 'Como acordou deve ficar entre 1 e 5.';
    if (!inRange(energy, 1, 5)) return 'Energia deve ficar entre 1 e 5.';
    if (stress && !inRange(stress, 1, 5)) return 'Estresse deve ficar entre 1 e 5.';
    if (mood && !inRange(mood, 1, 5)) return 'Humor deve ficar entre 1 e 5.';
    if (generalPain && !inRange(generalPain, 1, 5)) return 'Dor muscular geral deve ficar entre 1 e 5.';
    if (bodyHeaviness && !inRange(bodyHeaviness, 1, 5)) return 'Sensação de corpo pesado deve ficar entre 1 e 5.';
    if (notes.length > 200) return 'Observação deve ter no máximo 200 caracteres.';
    return null;
  };

  const findExistingRecordByDate = async (recordDate: string) => {
    const response = await api.get(`/sleep-records?start=${recordDate}&end=${recordDate}`);
    const records = Array.isArray(response.data) ? response.data : [];
    return records.find((record: SleepRecord) => String(record.date).slice(0, 10) === recordDate) || null;
  };

  const handleSave = async () => {
    if (saving) return;
    const validationError = validate();
    if (validationError) return Alert.alert('Ajuste o registro', validationError);
    setSaving(true);
    try {
      if (!editRecord) {
        const existingRecord = await findExistingRecordByDate(date);
        if (existingRecord) {
          Alert.alert('Registro já existente', 'Já existe uma noite registrada para esta data. Abra esse registro para editar em vez de criar outro.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Editar registro', onPress: () => navigation.navigate('EditarRegistro', { record: existingRecord }) },
          ]);
          return;
        }
      }
      const body = {
        date, sleepTime, wakeTime,
        perceivedQuality: Number(quality), awakenings: Number(awakenings), morningState: Number(morningState), energy: Number(energy),
        nap, caffeine, alcohol, screenBeforeSleep,
        stress: stress ? Number(stress) : undefined,
        pain,
        generalPain: generalPain ? Number(generalPain) : undefined,
        bodyHeaviness: bodyHeaviness ? Number(bodyHeaviness) : undefined,
        mood: mood ? Number(mood) : undefined,
        notes,
      };
      const response = editRecord ? await api.put(`/sleep-records/${editRecord.id}`, body) : await api.post('/sleep-records', body);
      const savedRecord = response.data?.record || response.data;
      setEditRecord(savedRecord);
      navigation.navigate('Results', {
        record: savedRecord,
        indicators: response.data?.indicators,
        postRecordInsights: response.data?.postRecordInsights || [],
      });
    } catch (error: any) {
      Alert.alert('Erro ao salvar', getApiErrorMessage(error, 'Não foi possível salvar o registro.'));
    } finally { setSaving(false); }
  };

  const handleSleepTimeChange = (value: string) => setSleepTime(formatClockInput(value));
  const handleWakeTimeChange = (value: string) => setWakeTime(formatClockInput(value));

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'left', 'right']}>
    <ScrollView style={shared.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={shared.title}>{editRecord ? 'Editar sono' : 'Registrar noite anterior'}</Text>
      <Text style={shared.subtitle}>Registre a noite que acabou. Escolha a data no calendário e preencha as escalas com números. Sim, sem hieróglifos emocionais.</Text>
      {editRecord && <Pressable style={shared.outlineButton} onPress={goToNewRecordForm} disabled={saving}><Text style={shared.outlineText}>Criar novo registro da noite anterior</Text></Pressable>}
      <View style={shared.card}>
        <Text style={shared.cardTitle}>Noite registrada</Text>
        <Text style={shared.label}>Data da noite</Text>
        <TextInput style={shared.input} placeholder="AAAA-MM-DD" placeholderTextColor={colors.muted} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        <CalendarSelector selectedDate={date} onSelect={setDate} />
        <Text style={shared.muted}>Para o painel do professor, “registrou hoje” corresponde à noite anterior registrada hoje.</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={shared.label}>Dormiu</Text>
            <TextInput
              style={shared.input}
              placeholder="2300"
              placeholderTextColor={colors.muted}
              value={sleepTime}
              onChangeText={handleSleepTimeChange}
              onBlur={() => setSleepTime(normalizeClockOnBlur(sleepTime))}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
          <View style={styles.half}>
            <Text style={shared.label}>Acordou</Text>
            <TextInput
              style={shared.input}
              placeholder="0630"
              placeholderTextColor={colors.muted}
              value={wakeTime}
              onChangeText={handleWakeTimeChange}
              onBlur={() => setWakeTime(normalizeClockOnBlur(wakeTime))}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        </View>
        <Text style={styles.inputHint}>Digite apenas números. Exemplo: 2300 vira 23:00, porque dois-pontos são uma exigência burocrática da civilização.</Text>
        <View style={styles.totalBox}><Text style={styles.totalLabel}>Horas calculadas</Text><Text style={styles.totalValue}>{calculateTotalHours()}h</Text></View>
      </View>

      <OptionSelector order={1} label="Qualidade percebida" description="Onde 1 significa péssima qualidade do sono e 5 ótima qualidade do sono." value={quality} onChange={setQuality} options={scaleOptions} />
      <OptionSelector order={2} label="Como acordou" description="Onde 1 significa muito cansado e 5 significa bem descansado." value={morningState} onChange={setMorningState} options={scaleOptions} />
      <OptionSelector order={3} label="Energia ao acordar" description="Onde 1 significa sem energia e 5 significa energia alta ao acordar." value={energy} onChange={setEnergy} options={scaleOptions} />
      <OptionSelector order={4} label="Despertares à noite" description="Onde 0 significa que não acordou e 5+ significa cinco ou mais despertares." value={awakenings} onChange={setAwakenings} options={awakeningOptions} />
      <OptionSelector order={5} label="Estresse do dia" description="Baseado no estresse de ontem: 1 significa muito baixo e 5 muito alto." value={stress} onChange={setStress} options={scaleOptions} />
      <OptionSelector order={6} label="Humor ao acordar hoje" description="Onde 1 significa humor muito ruim e 5 significa humor muito bom." value={mood} onChange={setMood} options={scaleOptions} />
      <OptionSelector order={7} label="Dor muscular geral" description="Onde 1 significa sem dor relevante e 5 significa dor muscular muito alta." value={generalPain} onChange={setGeneralPain} options={scaleOptions} />
      <OptionSelector order={8} label="Sensação de corpo pesado" description="Onde 1 significa corpo leve e 5 significa corpo muito pesado." value={bodyHeaviness} onChange={setBodyHeaviness} options={scaleOptions} />

      <Toggle order={9} label="Cochilo no dia anterior?" description="Marque se cochilou durante o dia anterior ao sono registrado." value={nap} onValueChange={setNap} />
      <Toggle order={10} label="Cafeína após as 18 horas?" description="Marque se consumiu café, energético, pré-treino ou outra fonte de cafeína depois das 18h." value={caffeine} onValueChange={setCaffeine} />
      <Toggle order={11} label="Ingeriu álcool no dia de ontem?" description="Marque se ingeriu bebida alcoólica no dia anterior à noite registrada." value={alcohol} onValueChange={setAlcohol} />
      <Toggle order={12} label="Tela antes de dormir?" description="Marque se usou celular, televisão, computador ou tela próxima do horário de dormir." value={screenBeforeSleep} onValueChange={setScreenBeforeSleep} />
      <Toggle order={13} label="Alguma dor ao acordar?" description="Marque se acordou com dor relevante, incômodo ou desconforto físico." value={pain} onValueChange={setPain} />

      <View style={shared.card}>
        <Text style={shared.cardTitle}>Opção 14 - Obs. livre</Text>
        <Text style={styles.description}>Use este campo para registrar qualquer detalhe importante da noite.</Text>
        <TextInput style={[shared.input, styles.notesInput]} placeholder="Observação livre" placeholderTextColor={colors.muted} value={notes} onChangeText={setNotes} multiline maxLength={200} />
        <Text style={shared.muted}>{notes.length}/200 caracteres</Text>
      </View>

      <Pressable style={[shared.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}><Text style={shared.buttonText}>{saving ? 'Salvando...' : editRecord ? 'Salvar alterações' : 'Salvar e ver resultado'}</Text></Pressable>
      <Text style={styles.disclaimer}>Este app usa linguagem comportamental e não substitui avaliação médica.</Text>
    </ScrollView>
    </SafeAreaView>
  );
}

function CalendarSelector({ selectedDate, onSelect }: { selectedDate: string; onSelect: (value: string) => void }) {
  const initialMonth = useMemo(() => parseLocalDate(selectedDate) || new Date(), [selectedDate]);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));

  useEffect(() => {
    const parsed = parseLocalDate(selectedDate);
    if (parsed) setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [selectedDate]);

  const weeks = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 6 }, (_, weekIndex) => (
      Array.from({ length: 7 }, (_, dayIndex) => {
        const day = new Date(start);
        day.setDate(start.getDate() + weekIndex * 7 + dayIndex);
        return day;
      })
    ));
  }, [visibleMonth]);

  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <View style={styles.calendarBox}>
      <View style={styles.calendarHeader}>
        <Pressable style={styles.calendarNav} onPress={() => changeMonth(-1)}><Text style={styles.calendarNavText}>‹</Text></Pressable>
        <Text style={styles.calendarTitle}>{monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</Text>
        <Pressable style={styles.calendarNav} onPress={() => changeMonth(1)}><Text style={styles.calendarNavText}>›</Text></Pressable>
      </View>
      <View style={styles.weekRow}>{weekdays.map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}</View>
      <View style={styles.daysGrid}>
        {weeks.map((week, weekIndex) => (
          <View key={`week-${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${weekIndex}`} style={styles.calendarWeek}>
            {week.map((day) => {
              const value = formatLocalDate(day);
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              const selected = value === selectedDate;
              const disabled = value > today();
              return (
                <Pressable
                  key={value}
                  onPress={() => !disabled && onSelect(value)}
                  disabled={disabled}
                  style={[styles.dayButton, selected && styles.daySelected, (!inMonth || disabled) && styles.dayMuted]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected, (!inMonth || disabled) && styles.dayTextMuted]}>{day.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function OptionSelector({ order, label, description, value, onChange, options }: { order: number; label: string; description: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return (
    <View style={shared.card}>
      <Text style={shared.cardTitle}>Opção {order} - {label}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.options}>
        {options.map(([optionValue, optionLabel]) => (
          <Pressable key={`${label}-${optionValue}`} onPress={() => onChange(optionValue)} style={[styles.option, value === optionValue && styles.optionActive]}>
            <Text style={[styles.optionText, value === optionValue && styles.optionTextActive]}>{optionLabel}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function Toggle({ order, label, description, value, onValueChange }: { order: number; label: string; description: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={shared.card}>
      <View style={styles.switchRow}>
        <View style={styles.switchTextBlock}>
          <Text style={shared.cardTitle}>Opção {order} - {label}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <Switch value={value} onValueChange={onValueChange} thumbColor={value ? colors.primary : colors.muted} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 170 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  half: { flex: 1, minWidth: 0 },
  totalBox: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginTop: 12, marginBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: colors.muted, fontWeight: '800' },
  totalValue: { color: colors.primary, fontWeight: '900', fontSize: 24 },
  inputHint: { color: colors.subtle, fontSize: 12, lineHeight: 18, marginTop: -4, marginBottom: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  switchTextBlock: { flex: 1, minWidth: 0 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minWidth: 52, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.text, fontWeight: '900' },
  optionTextActive: { color: colors.white },
  notesInput: { height: 90, textAlignVertical: 'top' },
  calendarBox: { backgroundColor: 'rgba(8,13,30,0.55)', borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 12, marginBottom: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calendarNav: { width: 36, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  calendarNavText: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 26 },
  calendarTitle: { color: colors.text, fontWeight: '900', fontSize: 15, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekText: { flex: 1, textAlign: 'center', color: colors.subtle, fontSize: 11, fontWeight: '800' },
  daysGrid: { gap: 2 },
  calendarWeek: { flexDirection: 'row' },
  dayButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginVertical: 1 },
  daySelected: { backgroundColor: colors.primary },
  dayMuted: { opacity: 0.42 },
  dayText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  dayTextSelected: { color: colors.white },
  dayTextMuted: { color: colors.subtle },
  buttonDisabled: { opacity: 0.65 },
  disclaimer: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
