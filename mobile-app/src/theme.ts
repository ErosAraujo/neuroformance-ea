import { StyleSheet } from 'react-native';

export const colors = {
  background: '#070B18',
  backgroundAlt: '#0B1020',
  surface: 'rgba(255,255,255,0.065)',
  surfaceAlt: 'rgba(255,255,255,0.095)',
  border: 'rgba(255,255,255,0.14)',
  borderStrong: 'rgba(139,92,246,0.48)',
  text: '#F8FAFC',
  muted: '#CBD5E1',
  subtle: '#94A3B8',
  primary: '#8B5CF6',
  primarySoft: 'rgba(139,92,246,0.22)',
  secondary: '#38BDF8',
  secondarySoft: 'rgba(56,189,248,0.18)',
  success: '#22C55E',
  successSoft: 'rgba(34,197,94,0.18)',
  warning: '#FACC15',
  warningSoft: 'rgba(250,204,21,0.18)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.18)',
  regular: '#FACC15',
  white: '#FFFFFF',
};

export function scoreColor(classification?: string) {
  switch (classification) {
    case 'Excelente':
    case 'Alto':
    case 'Bom':
    case 'Boa':
      return colors.success;
    case 'Médio':
    case 'Moderada':
    case 'Regular':
      return colors.regular;
    case 'Baixo':
    case 'Baixa':
    case 'Ruim':
      return colors.warning;
    case 'Crítico':
    case 'Crítica':
      return colors.danger;
    default:
      return colors.muted;
  }
}

export function recoveryColor(level?: string | null) {
  switch (level) {
    case 'Excelente':
    case 'Alto':
    case 'Boa':
      return colors.success;
    case 'Médio':
    case 'Moderada':
      return colors.regular;
    case 'Baixo':
    case 'Baixa':
      return colors.warning;
    case 'Crítico':
    case 'Crítica':
      return colors.danger;
    default:
      return colors.muted;
  }
}

export function riskColor(risk?: string | null) {
  switch (risk) {
    case 'Muito Baixo':
    case 'Muito Baixa':
    case 'Muito baixo':
    case 'Muito Baixo':
    case 'Controlada':
    case 'Controlado':
      return colors.success;
    case 'Baixo':
    case 'Baixa':
      return colors.secondary;
    case 'Moderado':
    case 'Moderada':
      return colors.regular;
    case 'Alto':
    case 'Alta':
      return colors.warning;
    case 'Muito Alto':
    case 'Elevado':
    case 'Crítico':
    case 'Crítica':
      return colors.danger;
    default:
      return colors.muted;
  }
}

export function positiveIndicatorColor(classification?: string | null) {
  switch (classification) {
    case 'Excelente':
    case 'Boa':
    case 'Alto':
    case 'Bom':
      return colors.success;
    case 'Moderada':
    case 'Médio':
    case 'Regular':
      return colors.regular;
    case 'Baixa':
    case 'Baixo':
      return colors.warning;
    case 'Muito Alto':
    case 'Elevado':
    case 'Crítica':
    case 'Crítico':
      return colors.danger;
    default:
      return colors.muted;
  }
}

export function negativeIndicatorColor(classification?: string | null) {
  switch (classification) {
    case 'Muito Baixa':
    case 'Muito baixo':
    case 'Muito Baixo':
    case 'Controlada':
    case 'Controlado':
      return colors.success;
    case 'Baixa':
    case 'Baixo':
      return colors.secondary;
    case 'Moderada':
    case 'Moderado':
      return colors.regular;
    case 'Alta':
    case 'Alto':
      return colors.warning;
    case 'Muito Alto':
    case 'Elevado':
    case 'Crítica':
    case 'Crítico':
      return colors.danger;
    default:
      return colors.muted;
  }
}

export function translucentForStatus(status?: string | null, negative = false) {
  const color = negative ? negativeIndicatorColor(status) : positiveIndicatorColor(status);
  if (color === colors.success) return colors.successSoft;
  if (color === colors.secondary) return colors.secondarySoft;
  if (color === colors.warning || color === colors.regular) return colors.warningSoft;
  if (color === colors.danger) return colors.dangerSoft;
  return 'rgba(255,255,255,0.08)';
}

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 170 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 6, letterSpacing: -0.4 },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 18, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 4,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 8, letterSpacing: 0.3 },
  sectionTitle: { color: colors.muted, fontSize: 13, fontWeight: '900', marginBottom: 12, letterSpacing: 0.9 },
  text: { color: colors.text },
  muted: { color: colors.muted, lineHeight: 19 },
  input: { backgroundColor: colors.surfaceAlt, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 12 },
  label: { color: colors.muted, fontWeight: '800', marginBottom: 6 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 3,
  },
  buttonText: { color: colors.white, fontWeight: '900' },
  outlineButton: { borderWidth: 1, borderColor: colors.border, paddingVertical: 13, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  outlineText: { color: colors.text, fontWeight: '800' },
});
