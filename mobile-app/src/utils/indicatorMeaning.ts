import { DailyIndicators } from '../types';
import { colors, negativeIndicatorColor, positiveIndicatorColor } from '../theme';

export type MetricKey = 'readiness' | 'recovery' | 'fatigue' | 'alertness' | 'mentalFocus' | 'overloadRisk';

export type MetricDefinition = {
  key: MetricKey;
  title: string;
  emoji: string;
  negative?: boolean;
  valueSuffix?: '%' | '/100';
};

export type HomeMetricResult = {
  value: number | null;
  classification: string | null;
  confidence?: number | null;
  base?: string | null;
};

export type IndicatorCopy = {
  training: string;
  life: string;
  recommendation: string;
};

export type StatusGeneralResult = {
  score: number | null;
  componentsCount: number;
};

export const metricDefinitions: MetricDefinition[] = [
  { key: 'readiness', title: 'Prontidão para treino', emoji: '⚡', valueSuffix: '%' },
  { key: 'recovery', title: 'Recuperação corporal', emoji: '🔋', valueSuffix: '/100' },
  { key: 'fatigue', title: 'Fadiga geral', emoji: '😵‍💫', negative: true, valueSuffix: '/100' },
  { key: 'alertness', title: 'Estado de alerta', emoji: '👁️', valueSuffix: '/100' },
  { key: 'mentalFocus', title: 'Foco mental', emoji: '🧠', valueSuffix: '/100' },
  { key: 'overloadRisk', title: 'Risco de sobrecarga', emoji: '🚨', negative: true, valueSuffix: '/100' },
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function lower(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function valueClassification(value: number | null | undefined, negative = false, key?: MetricKey) {
  if (!isFiniteNumber(value)) return null;
  const score = clampScore(value);

  if (negative) {
    if (key === 'fatigue') {
      if (score <= 19) return 'Muito Baixa';
      if (score <= 39) return 'Controlada';
      if (score <= 59) return 'Moderada';
      if (score <= 79) return 'Alta';
      return 'Crítica';
    }
    if (score <= 19) return 'Muito baixo';
    if (score <= 39) return 'Controlada';
    if (score <= 59) return 'Moderado';
    if (score <= 79) return 'Alto';
    return 'Muito Alto';
  }

  if (score >= 85) return 'Excelente';
  if (score >= 70) return key === 'readiness' || key === 'recovery' || key === 'mentalFocus' ? 'Boa' : 'Bom';
  if (score >= 55) return key === 'readiness' || key === 'recovery' ? 'Moderada' : 'Moderado';
  if (score >= 40) return key === 'readiness' || key === 'recovery' ? 'Baixa' : 'Baixo';
  return key === 'readiness' || key === 'recovery' || key === 'mentalFocus' ? 'Crítica' : 'Crítico';
}

export function getConfidence(indicators: DailyIndicators | null) {
  if (!indicators) return null;
  const values = [
    indicators.alertness?.confidence,
    indicators.fatigue?.confidence,
    indicators.mentalFocus?.confidence,
    indicators.recovery?.confidence,
    indicators.overloadRisk?.confidence,
  ].filter((value): value is number => isFiniteNumber(value));
  if (!values.length) return null;
  return Math.round(Math.min(...values));
}

export function normalizeClassification(value?: string | null) {
  return value || '--';
}

export function getMetric(indicators: DailyIndicators | null, key: MetricKey): HomeMetricResult | null {
  if (!indicators) return null;

  if (key === 'readiness') {
    const value = isFiniteNumber(indicators.readinessScore) ? clampScore(indicators.readinessScore) : null;
    return {
      value,
      classification: indicators.readinessClassification || valueClassification(value, false, key),
      confidence: getConfidence(indicators),
      base: indicators.recordsUsed ? `últimas ${indicators.recordsUsed} noite${indicators.recordsUsed > 1 ? 's' : ''}` : null,
    };
  }

  const raw = indicators[key];
  if (!raw) return null;
  const definition = metricDefinitions.find((item) => item.key === key);
  const value = isFiniteNumber(raw.value) ? clampScore(raw.value) : null;
  return {
    value,
    classification: raw.classification || valueClassification(value, Boolean(definition?.negative), key),
    confidence: isFiniteNumber(raw.confidence) ? raw.confidence : null,
    base: raw.base || null,
  };
}

export function getStatusGeneralScore(indicators: DailyIndicators | null): StatusGeneralResult {
  if (!indicators) return { score: null, componentsCount: 0 };

  const values: number[] = [];
  const addPositive = (value?: number | null) => {
    if (isFiniteNumber(value)) values.push(clampScore(value));
  };
  const addNegative = (value?: number | null) => {
    if (isFiniteNumber(value)) values.push(100 - clampScore(value));
  };

  addPositive(indicators.readinessScore);
  addPositive(indicators.recovery?.value);
  addNegative(indicators.fatigue?.value);
  addPositive(indicators.alertness?.value);
  addPositive(indicators.mentalFocus?.value);
  addNegative(indicators.overloadRisk?.value);

  if (!values.length) return { score: null, componentsCount: 0 };
  return { score: roundOne(values.reduce((sum, value) => sum + value, 0) / values.length), componentsCount: values.length };
}

export function getStatusClassification(score?: number | null) {
  if (!isFiniteNumber(score)) return null;
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bom';
  if (score >= 55) return 'Moderado';
  if (score >= 40) return 'Baixo';
  return 'Crítico';
}

export function getStatusColor(classification?: string | null) {
  switch (classification) {
    case 'Excelente':
    case 'Bom':
      return colors.success;
    case 'Moderado':
      return colors.warning;
    case 'Baixo':
      return '#FB923C';
    case 'Crítico':
      return colors.danger;
    default:
      return colors.muted;
  }
}

export function getStatusGeneralRecommendation(classification?: string | null) {
  switch (classification) {
    case 'Excelente':
      return 'Corpo e mente estão em ótimo estado para lidar com o dia e treinar com qualidade.';
    case 'Bom':
      return 'Seu estado geral está favorável, com boa condição para rotina e treino.';
    case 'Moderado':
      return 'Seu estado está razoável, mas pede controle de esforço e atenção aos sinais do corpo.';
    case 'Baixo':
      return 'Seu estado está abaixo do ideal; reduza o ritmo e priorize escolhas mais seguras.';
    case 'Crítico':
      return 'Seu estado exige cuidado; priorize recuperação, descanso e evite excesso de esforço.';
    default:
      return 'Registre mais noites para o app calcular seu estado geral com segurança.';
  }
}

function positiveCategory(classification?: string | null, value?: number | null) {
  const text = lower(classification);
  if (text.includes('excel')) return 'excellent';
  if (text.includes('boa') || text.includes('bom') || text.includes('alto')) return 'good';
  if (text.includes('moder') || text.includes('médio') || text.includes('medio') || text.includes('regular')) return 'moderate';
  if (text.includes('baix') || text.includes('ruim')) return 'low';
  if (text.includes('crít') || text.includes('crit')) return 'critical';

  if (isFiniteNumber(value)) {
    if (value >= 85) return 'excellent';
    if (value >= 70) return 'good';
    if (value >= 55) return 'moderate';
    if (value >= 40) return 'low';
    return 'critical';
  }
  return 'unknown';
}

function fatigueCategory(classification?: string | null, value?: number | null) {
  const text = lower(classification);
  if (text.includes('muito baixa')) return 'veryLow';
  if (text.includes('control') || text === 'baixa' || text === 'baixo') return 'low';
  if (text.includes('moder')) return 'moderate';
  if (text === 'alta' || text === 'alto') return 'high';
  if (text.includes('crít') || text.includes('crit') || text.includes('elev')) return 'critical';

  if (isFiniteNumber(value)) {
    if (value <= 19) return 'veryLow';
    if (value <= 39) return 'low';
    if (value <= 59) return 'moderate';
    if (value <= 79) return 'high';
    return 'critical';
  }
  return 'unknown';
}

function overloadCategory(classification?: string | null, value?: number | null) {
  const text = lower(classification);
  if (text.includes('muito baixo')) return 'veryLow';
  if (text.includes('control') || text === 'baixo' || text === 'baixa') return 'low';
  if (text.includes('moder')) return 'moderate';
  if (text === 'alto' || text === 'alta') return 'high';
  if (text.includes('muito alto') || text.includes('elev') || text.includes('crít') || text.includes('crit')) return 'veryHigh';

  if (isFiniteNumber(value)) {
    if (value <= 19) return 'veryLow';
    if (value <= 39) return 'low';
    if (value <= 59) return 'moderate';
    if (value <= 79) return 'high';
    return 'veryHigh';
  }
  return 'unknown';
}

export function getIndicatorColor(classification?: string | null, negative = false, value?: number | null, key?: MetricKey) {
  if (!classification && isFiniteNumber(value)) {
    const derived = valueClassification(value, negative, key);
    return negative ? negativeIndicatorColor(derived) : positiveIndicatorColor(derived);
  }
  return negative ? negativeIndicatorColor(classification) : positiveIndicatorColor(classification);
}

export function getIndicatorCopy(key: MetricKey, value?: number | null, classification?: string | null): IndicatorCopy {
  if (!isFiniteNumber(value)) {
    return {
      training: 'Ainda não há dados suficientes para interpretar este indicador com segurança.',
      life: 'Registre mais noites para transformar sensação em leitura útil, porque o app não lê mente, por enquanto.',
      recommendation: 'Registre mais noites para completar a base de cálculo.',
    };
  }

  if (key === 'readiness') {
    const category = positiveCategory(classification, value);
    const recommendationByCategory: Record<string, string> = {
      excellent: 'Seu corpo está em ótimo estado para treinar. Você pode buscar uma sessão mais forte, mantendo técnica, controle e boa execução.',
      good: 'Seu corpo está bem preparado para treinar. Faça o treino normalmente, mantendo controle de carga e atenção à qualidade do movimento.',
      moderate: 'Seu corpo está funcional, mas não no melhor ponto. Treine com atenção, evite exageros e ajuste a intensidade se sentir queda de energia.',
      low: 'Seu corpo mostra sinais de recuperação limitada. Reduza volume ou intensidade e priorize execução, mobilidade e controle.',
      critical: 'Seu corpo está pedindo recuperação. Evite treino intenso hoje e priorize descanso, sono, hidratação e uma atividade leve, se fizer sentido.',
      unknown: 'Registre mais noites para o app interpretar sua prontidão para treino com segurança.',
    };
    return {
      training: 'Mostra o quanto seu corpo parece preparado hoje para treinar com qualidade, considerando sono, energia, fadiga e recuperação.',
      life: 'Resume como seu sono, energia e cansaço podem influenciar seu foco, humor e produtividade hoje.',
      recommendation: recommendationByCategory[category],
    };
  }

  if (key === 'recovery') {
    const category = positiveCategory(classification, value);
    const recommendationByCategory: Record<string, string> = {
      excellent: 'Seu corpo está muito bem preparado para treinar. É um bom dia para manter ou buscar melhor desempenho, respeitando o planejamento.',
      good: 'Seu corpo está em boas condições para treinar. O treino pode seguir normalmente, com atenção aos sinais de cansaço.',
      moderate: 'Seu corpo ainda mostra sinais de recuperação incompleta. O treino pode acontecer, mas talvez seja melhor controlar carga, volume ou intensidade.',
      low: 'Seu corpo não está bem recuperado para esforço alto. O ideal é reduzir intensidade, evitar excesso de carga e priorizar uma sessão mais controlada.',
      critical: 'Seu corpo está muito desgastado para treinar forte. O mais seguro é priorizar recuperação, mobilidade leve ou descanso, dependendo do caso.',
      unknown: 'Registre mais noites para interpretar sua recuperação corporal com segurança.',
    };
    return {
      training: 'Mostra se seu corpo está recuperado o suficiente para treinar com qualidade, segurança e boa resposta ao esforço.',
      life: 'Resume como seu corpo está hoje em relação a energia, dores, cansaço e sensação geral de recuperação.',
      recommendation: recommendationByCategory[category],
    };
  }

  if (key === 'fatigue') {
    const category = fatigueCategory(classification, value);
    const recommendationByCategory: Record<string, string> = {
      veryLow: 'Sua fadiga está muito baixa. É um bom cenário para treinar com qualidade e buscar bom desempenho, respeitando o planejamento.',
      low: 'Sua fadiga está bem controlada. O treino pode seguir normalmente, com atenção a sinais leves de cansaço.',
      moderate: 'Sua fadiga está intermediária. O treino pode acontecer, mas talvez seja melhor controlar carga, volume ou intensidade.',
      high: 'Sua fadiga está alta. O ideal é reduzir a intensidade, evitar treino muito pesado e priorizar uma sessão mais segura.',
      critical: 'Sua fadiga está muito elevada. Treino forte não é indicado; priorize recuperação, mobilidade leve ou descanso, conforme orientação do professor.',
      unknown: 'Registre mais noites para interpretar sua fadiga com segurança.',
    };
    return {
      training: 'Mostra se o nível de cansaço atual pode atrapalhar seu desempenho, força, resistência ou concentração no treino.',
      life: 'Indica o quanto seu corpo e sua mente parecem desgastados para lidar com rotina, trabalho e tarefas diárias.',
      recommendation: recommendationByCategory[category],
    };
  }

  if (key === 'alertness') {
    const category = positiveCategory(classification, value);
    const recommendationByCategory: Record<string, string> = {
      excellent: 'Você está bem atento e responsivo. É um bom cenário para treinos com maior exigência técnica, coordenação e intensidade.',
      good: 'Seu nível de alerta está bom para treinar. A execução tende a ser segura, com boa capacidade de concentração.',
      moderate: 'Seu alerta está razoável, mas pode oscilar. O treino pode acontecer, com atenção maior à técnica e ao controle dos movimentos.',
      low: 'Seu alerta está reduzido. O ideal é evitar exercícios muito complexos, cargas máximas ou treinos que exijam muita reação.',
      critical: 'Seu alerta está muito baixo. Treinos intensos ou técnicos não são indicados; priorize algo leve, simples e seguro.',
      unknown: 'Registre mais noites para interpretar seu estado de alerta com segurança.',
    };
    return {
      training: 'Indica se sua mente está desperta o suficiente para manter foco, controle corporal e qualidade de execução no treino.',
      life: 'Resume o quanto sua mente parece ativa, desperta e preparada para responder bem ao que acontece no dia.',
      recommendation: recommendationByCategory[category],
    };
  }

  if (key === 'mentalFocus') {
    const category = positiveCategory(classification, value);
    const recommendationByCategory: Record<string, string> = {
      excellent: 'Sua mente está clara e bem focada. A tendência é ter boa concentração, organização e facilidade para lidar com tarefas e decisões.',
      good: 'Seu foco mental está adequado. Você deve conseguir manter atenção na rotina, mesmo com pequenas distrações.',
      moderate: 'Seu foco está oscilando. Pode haver distrações, lentidão mental ou dificuldade para manter concentração por muito tempo.',
      low: 'Seu foco está reduzido. Tarefas simples podem parecer mais cansativas, e manter atenção pode exigir mais esforço.',
      critical: 'Seu foco está muito comprometido. O ideal é evitar excesso de demandas mentais, decisões importantes e atividades que exijam alta concentração.',
      unknown: 'Registre mais noites para interpretar seu foco mental com segurança.',
    };
    return {
      training: 'Indica sua capacidade de focar na execução dos exercícios, controlar movimentos e seguir o treino com atenção.',
      life: 'Resume seu nível de clareza mental, concentração e controle da atenção durante o dia.',
      recommendation: recommendationByCategory[category],
    };
  }

  const category = overloadCategory(classification, value);
  const recommendationByCategory: Record<string, string> = {
    veryLow: 'O risco de sobrecarga está muito baixo. É um bom cenário para treinar normalmente e manter o planejamento.',
    low: 'O risco está controlado. O treino pode seguir bem, com atenção a sinais leves de fadiga.',
    moderate: 'O risco está em nível intermediário. O treino pode acontecer, mas é melhor controlar carga, volume e intensidade.',
    high: 'O risco está alto. Evite treinos pesados, cargas máximas e excesso de volume; prefira uma sessão mais leve e segura.',
    veryHigh: 'O risco está muito alto. Treino intenso não é indicado; priorize recuperação, mobilidade leve ou descanso, conforme orientação do professor.',
    unknown: 'Registre mais noites para interpretar seu risco de sobrecarga com segurança.',
  };
  return {
    training: 'Resume o risco de o treino gerar mais desgaste do que benefício, ajudando a ajustar carga, volume e intensidade.',
    life: 'Resume o quanto seu corpo pode estar sobrecarregado hoje e se precisa de mais cuidado, descanso ou redução de esforço.',
    recommendation: recommendationByCategory[category],
  };
}

export function getInterpretation(readinessScore?: number | null) {
  const score = isFiniteNumber(readinessScore) ? readinessScore : null;
  if (score === null) {
    return {
      training: 'Registre mais noites para o app traduzir sua prontidão de treino com segurança.',
      life: 'Sem base suficiente ainda. O universo insiste em pedir dados antes de produzir clareza.',
    };
  }
  if (score >= 85) {
    return {
      training: 'Pode treinar forte, mantendo técnica e boa execução.',
      life: 'Alta energia para rotina, foco e tarefas exigentes.',
    };
  }
  if (score >= 70) {
    return {
      training: 'Treino normal liberado. Mantenha controle de carga e técnica.',
      life: 'Boa disposição geral para rotina, trabalho, estudos e foco.',
    };
  }
  if (score >= 55) {
    return {
      training: 'Treino moderado. Evite exageros e observe sinais de fadiga.',
      life: 'Dia funcional, mas com atenção à energia e organização.',
    };
  }
  if (score >= 40) {
    return {
      training: 'Reduza volume ou intensidade. Priorize execução e recuperação.',
      life: 'Energia mais baixa. Organize tarefas importantes e preserve pausas.',
    };
  }
  return {
    training: 'Evite treino intenso. Priorize recuperação, mobilidade leve ou descanso.',
    life: 'Corpo em estado de baixa recuperação. Reduza sobrecarga e respeite sinais.',
  };
}
