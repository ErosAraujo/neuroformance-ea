const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const teacherEmail = "erosaraujopersonal@gmail.com";
  const studentEmail = "araujo.eros@hotmail.com";
  const passwordHash = await bcrypt.hash("Xuxa123", 10);

  const teacherUser = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {
      name: "Eros Araújo",
      password: passwordHash,
      profile: "teacher",
      active: true
    },
    create: {
      name: "Eros Araújo",
      email: teacherEmail,
      password: passwordHash,
      profile: "teacher",
      active: true
    }
  });

  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id
    }
  });

  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {
      name: "Eros Carneiro",
      password: passwordHash,
      profile: "student",
      active: true
    },
    create: {
      name: "Eros Carneiro",
      email: studentEmail,
      password: passwordHash,
      profile: "student",
      active: true
    }
  });

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {
      teacherId: teacher.id,
      active: true,
      status: "active"
    },
    create: {
      userId: studentUser.id,
      teacherId: teacher.id,
      active: true,
      status: "active"
    },
    include: {
      user: true,
      teacher: {
        include: {
          user: true
        }
      }
    }
  });

  const existingGoal = await prisma.sleepGoal.findFirst({
    where: {
      studentId: student.id,
      active: true
    }
  });

  if (!existingGoal) {
    const today = new Date();
    const sleepTimeGoal = new Date(today);
    sleepTimeGoal.setHours(23, 0, 0, 0);

    const wakeTimeGoal = new Date(today);
    wakeTimeGoal.setDate(wakeTimeGoal.getDate() + 1);
    wakeTimeGoal.setHours(6, 30, 0, 0);

    await prisma.sleepGoal.create({
      data: {
        studentId: student.id,
        hoursGoal: 7.5,
        sleepTimeGoal,
        wakeTimeGoal,
        regularityGoal: 60,
        active: true
      }
    });
  }

  console.log("Professor e aluno prontos para login:");
  console.log({
    professor: {
      userId: teacherUser.id,
      teacherId: teacher.id,
      name: teacherUser.name,
      email: teacherUser.email,
      profile: teacherUser.profile
    },
    aluno: {
      userId: studentUser.id,
      studentId: student.id,
      name: student.user.name,
      email: student.user.email,
      profile: student.user.profile,
      teacherId: student.teacherId
    },
    senha: "Xuxa123"
  });
}

main()
  .catch((err) => {
    console.error("Erro ao preparar usuários:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
