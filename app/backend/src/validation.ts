export function assertFiniteNumber(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} precisa ser um número válido.`);
  }
  return parsed;
}

export function assertRange(value: unknown, min: number, max: number, label: string): number {
  const parsed = assertFiniteNumber(value, label);
  if (parsed < min || parsed > max) {
    throw new Error(`${label} deve estar entre ${min} e ${max}.`);
  }
  return parsed;
}

export function parseOptionalNumber(value: unknown, min: number, max: number, label: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return assertRange(value, min, max, label);
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * Remove qualquer marcação HTML simples de uma string para evitar XSS.
 * Isto não substitui uma biblioteca completa de sanitização, mas impede
 * a inserção de tags como <script> e <img onerror> no banco.
 * @param input texto original fornecido pelo usuário
 */
export function sanitizeString(input: string): string {
  // Remove todas as tags HTML de abertura/fechamento. Expressões regulares não cobrem
  // todos os casos de XSS, mas ajudam a prevenir inserção direta de scripts.
  return input.replace(/<[^>]*>/g, '');
}

export function validateLimitedText(value: unknown, label: string, maxLength = 1000, minLength = 0): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  // Converte para string, remove espaços e sanitiza tags HTML.
  const raw = String(value).trim();
  const text = sanitizeString(raw);
  if (text.length < minLength) throw new Error(`${label} deve ter pelo menos ${minLength} caracteres.`);
  if (text.length > maxLength) throw new Error(`${label} deve ter no máximo ${maxLength} caracteres.`);
  return text || undefined;
}

export function normalizeProfile(profile?: string): 'student' | 'teacher' {
  if (profile === 'teacher' || profile === 'professor') return 'teacher';
  return 'student';
}

export function normalizeEmail(email: string): string {
  return String(email).trim().toLowerCase();
}

export function validateRegisterFields(name: unknown, email: unknown, password: unknown, profile?: string, teacherCode?: unknown) {
  if (!name || !email || !password) throw new Error('Nome, e-mail e senha são obrigatórios.');
  if (String(name).trim().length < 2) throw new Error('Nome deve ter pelo menos 2 caracteres.');
  if (!/^\S+@\S+\.\S+$/.test(String(email))) throw new Error('E-mail inválido.');
  if (String(password).length < 6) throw new Error('Senha deve ter pelo menos 6 caracteres.');
  const normalizedProfile = normalizeProfile(profile);
  if (normalizedProfile === 'student') {
    if (teacherCode === undefined || teacherCode === null || String(teacherCode).trim() === '') {
      throw new Error('Código do professor é obrigatório para cadastro de aluno.');
    }
    const clean = String(teacherCode).trim();
    if (!/^\d+$/.test(clean)) throw new Error('Código de professor inválido. Use apenas o código numérico informado pelo professor.');
  }
}
