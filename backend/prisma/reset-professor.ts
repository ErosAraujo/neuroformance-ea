import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'erosaraujopersonal@gmail.com';
  const password = await bcrypt.hash('Xuxa123', 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Eros Araújo',
      password,
      profile: 'teacher',
      active: true,
    },
    create: {
      name: 'Eros Araújo',
      email,
      password,
      profile: 'teacher',
      active: true,
    },
  });

  const teacher = await prisma.teacher.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log('Professor ajustado com sucesso.');
  console.log({ userId: user.id, teacherId: teacher.id, email });
  console.log('Senha: Xuxa123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    prisma.$disconnect();
  });
