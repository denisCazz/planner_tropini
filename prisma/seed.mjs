import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const TROPINI_ORG_ID = "org_tropini";
const TROPINI_ORG_SLUG = "tropini-service";
const TROPINI_ORG_NAME = "Tropini Service";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const tropini = await prisma.organization.upsert({
    where: { slug: TROPINI_ORG_SLUG },
    update: { name: TROPINI_ORG_NAME, isDemo: false },
    create: {
      id: TROPINI_ORG_ID,
      name: TROPINI_ORG_NAME,
      slug: TROPINI_ORG_SLUG,
      isDemo: false,
    },
  });

  await prisma.settings.upsert({
    where: { organizationId: tropini.id },
    update: {
      startLat: 44.7089,
      startLng: 7.6617,
      startLabel: "Via San Giorgio 14, Cavallermaggiore",
    },
    create: {
      id: "set_tropini",
      organizationId: tropini.id,
      startLat: 44.7089,
      startLng: 7.6617,
      startLabel: "Via San Giorgio 14, Cavallermaggiore",
    },
  });

  const adminUser = process.env.AUTH_USERNAME ?? "admin";
  const adminPass = process.env.AUTH_PASSWORD ?? "admin123";

  await prisma.user.upsert({
    where: { username: adminUser },
    update: {
      passwordHash: hashPassword(adminPass),
      role: "ADMIN",
      organizationId: tropini.id,
      attivo: true,
    },
    create: {
      username: adminUser,
      passwordHash: hashPassword(adminPass),
      role: "ADMIN",
      organizationId: tropini.id,
      attivo: true,
    },
  });

  const removed = await prisma.organization.deleteMany({
    where: { slug: { not: TROPINI_ORG_SLUG } },
  });
  if (removed.count > 0) {
    console.log(`Rimosse ${removed.count} società non Tropini`);
  }

  console.log(`Seed Tropini Service ok (admin: ${adminUser})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
