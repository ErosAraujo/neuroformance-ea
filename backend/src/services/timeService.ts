export function parseDateOnly(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Data inválida. Use AAAA-MM-DD.');
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const normalized = parsed.toISOString().slice(0, 10);
  if (Number.isNaN(parsed.getTime()) || normalized !== date) {
    throw new Error('Data inválida. Use uma data real no formato AAAA-MM-DD.');
  }
  return parsed;
}

export function assertNotFutureDate(date: Date) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) {
    throw new Error('Não é permitido registrar sono em data futura.');
  }
}

export function parseDateTimeUtc(date: string, time: string, addDay = false): Date {
  parseDateOnly(date);
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Horário inválido. Use HH:MM.');
  }
  const [hour, minute] = time.split(':').map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Horário fora do intervalo válido.');
  }
  const parsed = new Date(`${date}T${time}:00.000Z`);
  if (addDay) parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed;
}

export function calculateTotalHours(date: string, sleepTime: string, wakeTime: string): { totalHours: number; sleepDateTime: Date; wakeDateTime: Date } {
  const sleepDate = parseDateOnly(date);
  assertNotFutureDate(sleepDate);
  const sleepDateTime = parseDateTimeUtc(date, sleepTime, false);
  let wakeDateTime = parseDateTimeUtc(date, wakeTime, false);
  if (wakeDateTime <= sleepDateTime) {
    wakeDateTime = parseDateTimeUtc(date, wakeTime, true);
  }
  const diffMs = wakeDateTime.getTime() - sleepDateTime.getTime();
  const totalHours = diffMs / (1000 * 60 * 60);
  if (totalHours <= 0 || totalHours > 18) {
    throw new Error('Intervalo de sono incoerente. Revise os horários informados.');
  }
  return { totalHours: Number(totalHours.toFixed(2)), sleepDateTime, wakeDateTime };
}

export function minutesFromDate(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function circularMinuteDiff(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 1440 - diff);
}

export function parseClockOnDate(date: string, time: string): Date {
  return parseDateTimeUtc(date, time, false);
}

export function getTodayRange(reference = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export function getPreviousNightRange(reference = new Date()): { start: Date; end: Date } {
  const { start: todayStart } = getTodayRange(reference);
  const start = new Date(todayStart);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export function getRollingLast7DaysRange(reference = new Date()): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  const { start: todayStart, end } = getTodayRange(reference);
  const start = new Date(todayStart);
  start.setUTCDate(start.getUTCDate() - 6);

  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  previousEnd.setUTCHours(23, 59, 59, 999);

  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousEnd.getUTCDate() - 6);
  previousStart.setUTCHours(0, 0, 0, 0);

  return { start, end, previousStart, previousEnd };
}

// Mantido apenas por compatibilidade. Para métricas de produto, usar getRollingLast7DaysRange.
export function getClosedWeekRange(reference = new Date()): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  return getRollingLast7DaysRange(reference);
}
