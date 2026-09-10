-- Tropini Platform: impianti, interventi operativi, disponibilità, ruoli tecnico

-- Enums nuovi (CREATE TYPE è usabile nella stessa transazione)
CREATE TYPE "StatoIntervento" AS ENUM (
  'DA_PIANIFICARE',
  'DA_CONTATTARE',
  'CONTATTATO',
  'DISPONIBILITA_RICEVUTA',
  'APPUNTAMENTO_PROPOSTO',
  'CONFERMATO',
  'PIANIFICATO',
  'IN_CORSO',
  'COMPLETATO',
  'ANNULLATO',
  'DA_RICONTATTARE'
);

CREATE TYPE "TipoIntervento" AS ENUM (
  'MANUTENZIONE',
  'ASSISTENZA',
  'INSTALLAZIONE',
  'SOPRALLUOGO',
  'PRONTO_INTERVENTO'
);

CREATE TYPE "PrioritaIntervento" AS ENUM ('BASSA', 'MEDIA', 'ALTA', 'URGENTE');

CREATE TYPE "TipoDisponibilita" AS ENUM (
  'DISPONIBILE_FASCIA',
  'DISPONIBILE_GIORNO',
  'NON_DISPONIBILE',
  'RICHIAMARE'
);

CREATE TYPE "PeriodoGiorno" AS ENUM ('MATTINA', 'POMERIGGIO', 'SERA', 'TUTTO_IL_GIORNO');

CREATE TYPE "TipoImpianto" AS ENUM ('STUFA', 'CALDAIA', 'TERMOCAMINO', 'POMPA_CALORE', 'ALTRO');

-- Ruolo tecnico (non usato in UPDATE in questa transazione)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TECNICO';

-- User: anagrafica tecnico
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "nome" TEXT,
  ADD COLUMN IF NOT EXISTS "cognome" TEXT,
  ADD COLUMN IF NOT EXISTS "telefono" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "attivo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "note" TEXT;

-- Client: campi anagrafici Tropini / import
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "codiceCliente" TEXT,
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "ragioneSociale" TEXT,
  ADD COLUMN IF NOT EXISTS "codiceFiscale" TEXT,
  ADD COLUMN IF NOT EXISTS "partitaIva" TEXT,
  ADD COLUMN IF NOT EXISTS "civico" TEXT,
  ADD COLUMN IF NOT EXISTS "geoStatus" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_organizationId_codiceCliente_key"
  ON "Client"("organizationId", "codiceCliente");

CREATE INDEX IF NOT EXISTS "Client_organizationId_citta_idx" ON "Client"("organizationId", "citta");
CREATE INDEX IF NOT EXISTS "Client_organizationId_externalId_idx" ON "Client"("organizationId", "externalId");

-- Address
CREATE TABLE IF NOT EXISTS "Address" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "label" TEXT,
    "indirizzo" TEXT NOT NULL,
    "civico" TEXT,
    "cap" TEXT,
    "citta" TEXT,
    "provincia" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Address_clientId_idx" ON "Address"("clientId");
CREATE INDEX IF NOT EXISTS "Address_organizationId_idx" ON "Address"("organizationId");

ALTER TABLE "Address"
  ADD CONSTRAINT "Address_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Address"
  ADD CONSTRAINT "Address_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Plant
CREATE TABLE IF NOT EXISTS "Plant" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "externalId" TEXT,
    "marca" TEXT,
    "modello" TEXT,
    "matricola" TEXT,
    "tipologia" "TipoImpianto" NOT NULL DEFAULT 'STUFA',
    "annoInstallazione" INTEGER,
    "dataUltimoIntervento" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Plant_clientId_idx" ON "Plant"("clientId");
CREATE INDEX IF NOT EXISTS "Plant_organizationId_idx" ON "Plant"("organizationId");
CREATE INDEX IF NOT EXISTS "Plant_organizationId_matricola_idx" ON "Plant"("organizationId", "matricola");

ALTER TABLE "Plant"
  ADD CONSTRAINT "Plant_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Plant"
  ADD CONSTRAINT "Plant_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Impianto da marca/modello già presenti sul cliente
INSERT INTO "Plant" (
  "organizationId", "clientId", "marca", "modello", "tipologia",
  "dataUltimoIntervento", "createdAt", "updatedAt"
)
SELECT
  c."organizationId",
  c."id",
  c."marcaStufa",
  c."modelloStufa",
  'STUFA'::"TipoImpianto",
  c."ultimaVisita"::date,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Client" c
WHERE (c."marcaStufa" IS NOT NULL AND btrim(c."marcaStufa") <> '')
   OR (c."modelloStufa" IS NOT NULL AND btrim(c."modelloStufa") <> '');

-- Intervento: modello operativo
ALTER TABLE "Intervento"
  ADD COLUMN IF NOT EXISTS "plantId" INTEGER,
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "tipo" "TipoIntervento" NOT NULL DEFAULT 'MANUTENZIONE',
  ADD COLUMN IF NOT EXISTS "priorita" "PrioritaIntervento" NOT NULL DEFAULT 'MEDIA',
  ADD COLUMN IF NOT EXISTS "durataStimata" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "stato" "StatoIntervento" NOT NULL DEFAULT 'DA_PIANIFICARE',
  ADD COLUMN IF NOT EXISTS "dataRichiesta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "note" TEXT;

ALTER TABLE "Intervento" ALTER COLUMN "data" DROP NOT NULL;

UPDATE "Intervento"
SET
  "stato" = 'COMPLETATO',
  "dataRichiesta" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "data" IS NOT NULL;

-- Collega impianti esistenti dove possibile (primo impianto del cliente)
UPDATE "Intervento" i
SET "plantId" = p."id"
FROM (
  SELECT DISTINCT ON ("clientId") "id", "clientId"
  FROM "Plant"
  ORDER BY "clientId", "id"
) p
WHERE i."clientId" = p."clientId" AND i."plantId" IS NULL;

CREATE INDEX IF NOT EXISTS "Intervento_organizationId_stato_idx" ON "Intervento"("organizationId", "stato");
CREATE INDEX IF NOT EXISTS "Intervento_plantId_idx" ON "Intervento"("plantId");
CREATE INDEX IF NOT EXISTS "Intervento_technicianId_idx" ON "Intervento"("technicianId");

ALTER TABLE "Intervento"
  ADD CONSTRAINT "Intervento_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Appointment → Intervento (inverte la FK precedente)
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "interventoId" INTEGER;

UPDATE "Appointment" a
SET "interventoId" = i."id"
FROM "Intervento" i
WHERE i."appointmentId" = a."id";

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_interventoId_key" ON "Appointment"("interventoId");

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_interventoId_fkey"
  FOREIGN KEY ("interventoId") REFERENCES "Intervento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Intervento" DROP CONSTRAINT IF EXISTS "Intervento_appointmentId_fkey";
DROP INDEX IF EXISTS "Intervento_appointmentId_key";
ALTER TABLE "Intervento" DROP COLUMN IF EXISTS "appointmentId";

-- Note: una sola entità alla volta
ALTER TABLE "ClientNote" ADD COLUMN IF NOT EXISTS "plantId" INTEGER;
ALTER TABLE "ClientNote" ADD COLUMN IF NOT EXISTS "interventoId" INTEGER;
ALTER TABLE "ClientNote" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ClientNote" ALTER COLUMN "clientId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "ClientNote_plantId_idx" ON "ClientNote"("plantId");
CREATE INDEX IF NOT EXISTS "ClientNote_interventoId_idx" ON "ClientNote"("interventoId");

ALTER TABLE "ClientNote"
  ADD CONSTRAINT "ClientNote_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientNote"
  ADD CONSTRAINT "ClientNote_interventoId_fkey"
  FOREIGN KEY ("interventoId") REFERENCES "Intervento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientNote" DROP CONSTRAINT IF EXISTS "ClientNote_one_entity";
ALTER TABLE "ClientNote"
  ADD CONSTRAINT "ClientNote_one_entity" CHECK (
    ((CASE WHEN "clientId" IS NOT NULL THEN 1 ELSE 0 END)
   + (CASE WHEN "plantId" IS NOT NULL THEN 1 ELSE 0 END)
   + (CASE WHEN "interventoId" IS NOT NULL THEN 1 ELSE 0 END)) = 1
  );

-- Disponibilità cliente
CREATE TABLE IF NOT EXISTS "CustomerAvailability" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "interventoId" INTEGER,
    "tipo" "TipoDisponibilita" NOT NULL,
    "date" DATE,
    "startMin" INTEGER,
    "endMin" INTEGER,
    "weekday" INTEGER,
    "periodo" "PeriodoGiorno",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAvailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomerAvailability_clientId_idx" ON "CustomerAvailability"("clientId");
CREATE INDEX IF NOT EXISTS "CustomerAvailability_interventoId_idx" ON "CustomerAvailability"("interventoId");
CREATE INDEX IF NOT EXISTS "CustomerAvailability_organizationId_date_idx" ON "CustomerAvailability"("organizationId", "date");

ALTER TABLE "CustomerAvailability"
  ADD CONSTRAINT "CustomerAvailability_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAvailability"
  ADD CONSTRAINT "CustomerAvailability_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAvailability"
  ADD CONSTRAINT "CustomerAvailability_interventoId_fkey"
  FOREIGN KEY ("interventoId") REFERENCES "Intervento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stub suggerimento giornata
CREATE TABLE IF NOT EXISTS "PlanningSuggestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlanningSuggestion_organizationId_technicianId_date_idx"
  ON "PlanningSuggestion"("organizationId", "technicianId", "date");

ALTER TABLE "PlanningSuggestion"
  ADD CONSTRAINT "PlanningSuggestion_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
