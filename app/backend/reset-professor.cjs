const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "erosaraujopersonal@gmail.com";
  const password = await bcrypt.hash("Xuxa123", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password,
      profile: "teacher",
      name: "Eros Araújo"
    },
    create: {
      name: "Eros Araújo",
      email,
      password,
      profile: "teacher"
    },
    select: {
      id: true,
      name: true,
      email: true,
      profile: true
    }
  });

  console.log("Professor pronto para login:");
  console.log(user);
}

main()
  .catch((err) => {
    console.error("Erro ao preparar professor:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
