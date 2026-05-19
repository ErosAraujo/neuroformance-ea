const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "araujo.eros@hotmail.com"; 
  const password = await bcrypt.hash("123456", 10); 

  const student = await prisma.user.upsert({
    where: { email },
    update: {
      password,
      profile: "student",
      name: "Eros Carneiro",
      teacherId: 1
    },
    create: {
      name: "Eros Carneiro",
      email,
      password,
      profile: "student",
      teacherId: 1
    },
    select: {
      id: true,
      name: true,
      email: true,
      profile: true,
      teacherId: true
    }
  });

  console.log("Aluno pronto para login:");
  console.log(student);
}

main()
  .catch((err) => {
    console.error("Erro ao preparar aluno:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
