import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const tropini = await prisma.organization.upsert({
    where: { slug: "tropini" },
    update: {},
    create: { id: "org_tropini", name: "Tropini", slug: "tropini", isDemo: false },
  });

  const demo = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: { id: "org_demo", name: "Demo", slug: "demo", isDemo: true },
  });

  await prisma.settings.upsert({
    where: { organizationId: tropini.id },
    update: {},
    create: { id: "set_tropini", organizationId: tropini.id },
  });

  await prisma.settings.upsert({
    where: { organizationId: demo.id },
    update: {},
    create: {
      id: "set_demo",
      organizationId: demo.id,
      startLat: 45.0703,
      startLng: 7.6869,
      startLabel: "Torino, Piazza Castello",
    },
  });

  const adminUser = process.env.AUTH_USERNAME ?? "admin";
  const adminPass = process.env.AUTH_PASSWORD ?? "admin123";
  const tropiniUser = process.env.TROPINI_USERNAME ?? "tropini";
  const tropiniPass = process.env.TROPINI_PASSWORD ?? adminPass;

  await prisma.user.upsert({
    where: { username: adminUser },
    update: {
      passwordHash: hashPassword(adminPass),
      role: "ADMIN",
      organizationId: tropini.id,
    },
    create: {
      username: adminUser,
      passwordHash: hashPassword(adminPass),
      role: "ADMIN",
      organizationId: tropini.id,
    },
  });

  await prisma.user.upsert({
    where: { username: tropiniUser },
    update: {
      passwordHash: hashPassword(tropiniPass),
      role: "USER",
      organizationId: tropini.id,
    },
    create: {
      username: tropiniUser,
      passwordHash: hashPassword(tropiniPass),
      role: "USER",
      organizationId: tropini.id,
    },
  });

  await prisma.user.upsert({
    where: { username: "demo" },
    update: {
      passwordHash: hashPassword("demo1234!"),
      role: "USER",
      organizationId: demo.id,
    },
    create: {
      username: "demo",
      passwordHash: hashPassword("demo1234!"),
      role: "USER",
      organizationId: demo.id,
    },
  });

  const demoClientCount = await prisma.client.count({ where: { organizationId: demo.id } });
  if (demoClientCount === 0) {
    await prisma.client.createMany({
      data: [
        {
          organizationId: demo.id,
          nome: "Mario",
          cognome: "Rossi",
          email: "mario.rossi@demo.it",
          telefono: "3331234567",
          indirizzo: "Via Roma 1",
          cap: "10100",
          citta: "Torino",
          provincia: "TO",
          marcaStufa: "MCZ",
          modelloStufa: "Star 3.0",
          stato: "ATTIVO",
          lat: 45.0703,
          lng: 7.6869,
        },
        {
          organizationId: demo.id,
          nome: "Laura",
          cognome: "Bianchi",
          email: "laura.bianchi@demo.it",
          telefono: "3477654321",
          indirizzo: "Corso Vittorio Emanuele 50",
          cap: "10123",
          citta: "Torino",
          provincia: "TO",
          marcaStufa: "Palazzetti",
          modelloStufa: "Ecomix",
          stato: "PROSPECT",
          urgente: true,
          lat: 45.0626,
          lng: 7.6781,
        },
        {
          organizationId: demo.id,
          nome: "Giuseppe",
          cognome: "Verdi",
          telefono: "3209988776",
          indirizzo: "Via Garibaldi 12",
          cap: "10024",
          citta: "Moncalieri",
          provincia: "TO",
          marcaStufa: "Edilkamin",
          modelloStufa: "Blade",
          stato: "ATTIVO",
          lat: 44.9984,
          lng: 7.6826,
        },
      ],
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
