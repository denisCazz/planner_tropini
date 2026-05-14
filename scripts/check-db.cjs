const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const total = await p.client.count();
  const withPhone = await p.client.count({ where: { telefono: { not: null } } });
  const withCitta = await p.client.count({ where: { citta: { not: null } } });
  const withMarca = await p.client.count({ where: { marcaStufa: { not: null } } });
  const prospect = await p.client.count({ where: { stato: 'PROSPECT' } });
  const attivo = await p.client.count({ where: { stato: 'ATTIVO' } });
  const inattivo = await p.client.count({ where: { stato: 'INATTIVO' } });
  const urgenti = await p.client.count({ where: { urgente: true } });
  const sample = await p.client.findMany({
    where: { telefono: { not: null }, citta: { not: null } },
    take: 3,
    select: { nome: true, cognome: true, telefono: true, citta: true, provincia: true, marcaStufa: true, stato: true }
  });
  console.log(JSON.stringify({ total, withPhone, withCitta, withMarca, stato: { prospect, attivo, inattivo }, urgenti }, null, 2));
  console.log('Sample:', JSON.stringify(sample, null, 2));
  await p.$disconnect();
}
main();
