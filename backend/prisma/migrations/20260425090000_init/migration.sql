-- Migração inicial PostgreSQL do APP DE CONTROLE DO SONO.
-- Compatível com datasource provider = "postgresql" no schema.prisma.

CREATE TABLE IF NOT EXISTS "User" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "profile" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Teacher" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Teacher_userId_key" ON "Teacher"("userId");

CREATE TABLE IF NOT EXISTS "Student" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "teacherId" INTEGER,
  "dateOfBirth" TIMESTAMP(3),
  "gender" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Student_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Student_userId_key" ON "Student"("userId");
CREATE INDEX IF NOT EXISTS "Student_teacherId_idx" ON "Student"("teacherId");

CREATE TABLE IF NOT EXISTS "SleepRecord" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "sleepTime" TIMESTAMP(3) NOT NULL,
  "wakeTime" TIMESTAMP(3) NOT NULL,
  "totalHours" DOUBLE PRECISION NOT NULL,
  "perceivedQuality" INTEGER NOT NULL,
  "awakenings" INTEGER NOT NULL,
  "morningState" INTEGER NOT NULL,
  "energy" INTEGER NOT NULL,
  "timeToSleep" INTEGER,
  "nap" BOOLEAN,
  "caffeine" BOOLEAN,
  "alcohol" BOOLEAN,
  "screenBeforeSleep" BOOLEAN,
  "stress" INTEGER,
  "pain" BOOLEAN,
  "mood" INTEGER,
  "notes" TEXT,
  "scoreDuration" INTEGER NOT NULL,
  "scoreQuality" INTEGER NOT NULL,
  "scoreContinuity" INTEGER NOT NULL,
  "scoreState" INTEGER NOT NULL,
  "scoreRegularity" INTEGER NOT NULL,
  "scoreTotal" INTEGER NOT NULL,
  "classification" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SleepRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SleepRecord_studentId_date_key" ON "SleepRecord"("studentId", "date");
CREATE INDEX IF NOT EXISTS "SleepRecord_studentId_date_idx" ON "SleepRecord"("studentId", "date");

CREATE TABLE IF NOT EXISTS "SleepGoal" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "hoursGoal" DOUBLE PRECISION NOT NULL,
  "sleepTimeGoal" TIMESTAMP(3) NOT NULL,
  "wakeTimeGoal" TIMESTAMP(3) NOT NULL,
  "regularityGoal" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SleepGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SleepGoal_studentId_active_idx" ON "SleepGoal"("studentId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "SleepGoal_one_active_per_student" ON "SleepGoal"("studentId") WHERE "active" = true;

CREATE TABLE IF NOT EXISTS "Alert" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "Alert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Alert_studentId_resolved_idx" ON "Alert"("studentId", "resolved");

CREATE TABLE IF NOT EXISTS "Observation" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "teacherId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "text" TEXT NOT NULL,
  CONSTRAINT "Observation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Observation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Observation_studentId_teacherId_idx" ON "Observation"("studentId", "teacherId");
