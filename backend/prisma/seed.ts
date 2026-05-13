import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateSleepScore } from '../src/services/scoreService';

const prisma = new PrismaClient();

const RESET_DEMO = String(process.env.RESET_DEMO || '').toLowerCase() === 'true';
const DEFAULT_TEACHER_EMAIL = process.env.SEED_TEACHER_EMAIL || 'erosaraujopersonal@gmail.com';
const DEFAULT_TEACHER_PASSWORD = process.env.SEED_TEACHER_PASSWORD || 'Xuxa123';
const DEFAULT_STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD || '123456';

const TEACHER_SEED = {
  name: process.env.SEED_TEACHER_NAME || 'Eros Araújo',
  email: DEFAULT_TEACHER_EMAIL,
  password: DEFAULT_TEACHER_PASSWORD,
};

const STUDENT_SEED = [
  { name: 'Eros Carneiro', email: 'araujo.eros@hotmail.com', password: DEFAULT_STUDENT_PASSWORD, withDemoRecords: true },
];

const LEGACY_DEMO_EMAILS = ['aluno.excelente@exemplo.com', 'aluno.regular@exemplo.com'];

function dateOnly(daysAgo: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function dateWithTime(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
}

function wakeDateWithTime(date: Date, sleepTime: string, wakeTime: string) {
  const sleep = dateWithTime(date, sleepTime);
  const wake = dateWithTime(date, wakeTime);
  if (wake <= sleep) wake.setUTCDate(wake.getUTCDate() + 1);
  return wake;
}

function hoursBetween(start: Date, end: Date) {
  return Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100;
}

async function deleteStudentData(studentId: number) {
  await prisma.alert.deleteMany({ where: { studentId } });
  await prisma.sleepRecord.deleteMany({ where: { studentId } });
  await prisma.sleepGoal.deleteMany({ where: { studentId } });
  await prisma.observation.deleteMany({ where: { studentId } });
  await prisma.pushSubscription.deleteMany({ where: { studentId } });
}

async function deleteUserStudentByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { student: true } });
  if (!user) return;
  if (user.student) {
    await deleteStudentData(user.student.id);
    await prisma.student.delete({ where: { id: user.student.id } });
  }
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

async function cleanupLegacyDemoData() {
  for (const email of LEGACY_DEMO_EMAILS) await deleteUserStudentByEmail(email);

  const demoProfessor = await prisma.user.findUnique({
    where: { email: 'professor@exemplo.com' },
    include: { teacher: true },
  });

  if (demoProfessor?.teacher) {
    await prisma.observation.deleteMany({ where: { teacherId: demoProfessor.teacher.id } });
    await prisma.student.updateMany({ where: { teacherId: demoProfessor.teacher.id }, data: { teacherId: 1 } });
    await prisma.teacher.delete({ where: { id: demoProfessor.teacher.id } });
  }

  if (demoProfessor) {
    await prisma.pushSubscription.deleteMany({ where: { userId: demoProfessor.id } });
    await prisma.user.delete({ where: { id: demoProfessor.id } });
  }
}

async function ensureTeacher() {
  const teacherPassword = await bcrypt.hash(TEACHER_SEED.password, 10);

  const professorUser = await prisma.user.upsert({
    where: { email: TEACHER_SEED.email },
    update: {
      name: TEACHER_SEED.name,
      password: teacherPassword,
      profile: 'teacher',
      active: true,
    },
    create: {
      name: TEACHER_SEED.name,
      email: TEACHER_SEED.email,
      password: teacherPassword,
      profile: 'teacher',
      active: true,
    },
  });

  const currentTeacher = await prisma.teacher.findUnique({ where: { userId: professorUser.id } });
  if (currentTeacher?.id === 1) return currentTeacher;

  const teacherOne = await prisma.teacher.findUnique({ where: { id: 1 } });

  if (currentTeacher && currentTeacher.id !== 1) {
    await prisma.observation.updateMany({ where: { teacherId: currentTeacher.id }, data: { teacherId: 1 } });
    await prisma.student.updateMany({ where: { teacherId: currentTeacher.id }, data: { teacherId: 1 } });
    await prisma.teacher.delete({ where: { id: currentTeacher.id } });
  }

  if (teacherOne) {
    return prisma.teacher.update({ where: { id: 1 }, data: { userId: professorUser.id } });
  }

  return prisma.teacher.create({ data: { id: 1, userId: professorUser.id } });
}

async function ensureStudent(studentData: typeof STUDENT_SEED[number], teacherId: number) {
  const studentPassword = await bcrypt.hash(studentData.password, 10);

  const user = await prisma.user.upsert({
    where: { email: studentData.email },
    update: {
      name: studentData.name,
      password: studentPassword,
      profile: 'student',
      active: true,
    },
    create: {
      name: studentData.name,
      email: studentData.email,
      password: studentPassword,
      profile: 'student',
      active: true,
    },
  });

  const student = await prisma.student.upsert({
    where: { userId: user.id },
    update: {
      teacherId,
      active: true,
      status: 'active',
      archivedAt: null,
      deletedAt: null,
    },
    create: {
      userId: user.id,
      teacherId,
      active: true,
      status: 'active',
    },
  });

  if (RESET_DEMO) await deleteStudentData(student.id);
  return student;
}

async function ensureSleepGoal(studentId: number) {
  const goalDate = dateOnly(0);
  const existingGoal = await prisma.sleepGoal.findFirst({ where: { studentId, active: true } });
  if (existingGoal && !RESET_DEMO) return existingGoal;

  if (RESET_DEMO) await prisma.sleepGoal.updateMany({ where: { studentId }, data: { active: false } });

  return prisma.sleepGoal.create({
    data: {
      studentId,
      hoursGoal: 7.5,
      sleepTimeGoal: dateWithTime(goalDate, '23:00'),
      wakeTimeGoal: wakeDateWithTime(goalDate, '23:00', '06:30'),
      regularityGoal: 60,
      active: true,
    },
  });
}

async function upsertDemoRecord(studentId: number, daysAgo: number, input: {
  sleepTime: string;
  wakeTime: string;
  perceivedQuality: number;
  awakenings: number;
  morningState: number;
  energy: number;
  stress: number;
  mood: number;
  generalPain: number;
  bodyHeaviness: number;
  nap?: boolean;
  caffeine?: boolean;
  alcohol?: boolean;
  screenBeforeSleep?: boolean;
  pain?: boolean;
  notes?: string;
}) {
  const date = dateOnly(daysAgo);
  const sleep = dateWithTime(date, input.sleepTime);
  const wake = wakeDateWithTime(date, input.sleepTime, input.wakeTime);
  const totalHours = hoursBetween(sleep, wake);
  const score = calculateSleepScore({
    totalHours,
    perceivedQuality: input.perceivedQuality,
    awakenings: input.awakenings,
    morningState: input.morningState,
    regularityVariation: 30,
  });

  return prisma.sleepRecord.upsert({
    where: { studentId_date: { studentId, date } },
    update: {
      sleepTime: sleep,
      wakeTime: wake,
      totalHours,
      perceivedQuality: input.perceivedQuality,
      awakenings: input.awakenings,
      morningState: input.morningState,
      energy: input.energy,
      stress: input.stress,
      mood: input.mood,
      generalPain: input.generalPain,
      bodyHeaviness: input.bodyHeaviness,
      nap: input.nap ?? false,
      caffeine: input.caffeine ?? false,
      alcohol: input.alcohol ?? false,
      screenBeforeSleep: input.screenBeforeSleep ?? false,
      pain: input.pain ?? false,
      notes: input.notes,
      scoreDuration: score.duration,
      scoreQuality: score.quality,
      scoreContinuity: score.continuity,
      scoreState: score.state,
      scoreRegularity: score.regularity,
      scoreTotal: score.total,
      classification: score.classification,
    },
    create: {
      studentId,
      date,
      sleepTime: sleep,
      wakeTime: wake,
      totalHours,
      perceivedQuality: input.perceivedQuality,
      awakenings: input.awakenings,
      morningState: input.morningState,
      energy: input.energy,
      stress: input.stress,
      mood: input.mood,
      generalPain: input.generalPain,
      bodyHeaviness: input.bodyHeaviness,
      nap: input.nap ?? false,
      caffeine: input.caffeine ?? false,
      alcohol: input.alcohol ?? false,
      screenBeforeSleep: input.screenBeforeSleep ?? false,
      pain: input.pain ?? false,
      notes: input.notes,
      scoreDuration: score.duration,
      scoreQuality: score.quality,
      scoreContinuity: score.continuity,
      scoreState: score.state,
      scoreRegularity: score.regularity,
      scoreTotal: score.total,
      classification: score.classification,
    },
  });
}

async function ensureDemoRecords(_studentName: string, studentId: number) {
  await ensureSleepGoal(studentId);

  const records = [
    { daysAgo: 1, sleepTime: '23:10', wakeTime: '06:40', perceivedQuality: 4, awakenings: 1, morningState: 4, energy: 4, stress: 2, mood: 4, generalPain: 1, bodyHeaviness: 1, notes: 'Registro inicial de Eros Carneiro: noite anterior.' },
    { daysAgo: 0, sleepTime: '23:10', wakeTime: '06:40', perceivedQuality: 4, awakenings: 1, morningState: 4, energy: 4, stress: 2, mood: 4, generalPain: 1, bodyHeaviness: 1, notes: 'Registro inicial de Eros Carneiro: dia atual.' },
  ];

  for (const record of records) await upsertDemoRecord(studentId, record.daysAgo, record);
}

async function main() {
  await cleanupLegacyDemoData();
  const teacher = await ensureTeacher();

  for (const studentSeed of STUDENT_SEED) {
    const student = await ensureStudent(studentSeed, teacher.id);
    if (studentSeed.withDemoRecords) await ensureDemoRecords(studentSeed.name, student.id);
  }

  console.log('Seed concluído com segurança.');
  console.log(`Professor: ${TEACHER_SEED.email} / senha: ${TEACHER_SEED.password}`);
  for (const student of STUDENT_SEED) console.log(`Aluno: ${student.email} / senha: ${student.password}`);
  console.log(`Código do professor: ${teacher.id}`);
  console.log(`RESET_DEMO=${RESET_DEMO ? 'true' : 'false'}${RESET_DEMO ? ' - dados demo foram recriados.' : ' - dados existentes foram preservados.'}`);
}

main()
  .catch((error) => {
    console.error('Erro ao executar seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
