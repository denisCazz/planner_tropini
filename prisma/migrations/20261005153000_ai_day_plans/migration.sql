-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('BOZZA', 'CONFERMA', 'PRONTO', 'INVIATO');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('DA_CHIAMARE', 'SMS_INVIATO', 'CONFERMATO', 'NON_DISPONIBILE', 'NESSUNA_RISPOSTA');

-- CreateEnum
CREATE TYPE "SmsDirection" AS ENUM ('OUT', 'IN');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "companyName" TEXT NOT NULL DEFAULT 'Tropini',
ADD COLUMN "smsTemplate" TEXT NOT NULL DEFAULT 'Buongiorno {nome}, siamo {azienda}. Il tecnico {operatore} passerebbe {giorno} per la manutenzione. Risponda SI per confermare o NO se non e'' disponibile.';

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "technicianId" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "zonaLat" DOUBLE PRECISION NOT NULL,
    "zonaLng" DOUBLE PRECISION NOT NULL,
    "raggioKm" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "numeroClienti" INTEGER NOT NULL,
    "note" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'BOZZA',
    "geometry" JSONB,
    "totalDistance" DOUBLE PRECISION,
    "totalDuration" INTEGER,
    "publicToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanStop" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "ordine" INTEGER,
    "status" "StopStatus" NOT NULL DEFAULT 'DA_CHIAMARE',
    "orario" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "distanzaKm" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" SERIAL NOT NULL,
    "direction" "SmsDirection" NOT NULL,
    "clientId" INTEGER,
    "stopId" INTEGER,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "providerId" TEXT,
    "intent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_publicToken_key" ON "Plan"("publicToken");
CREATE INDEX "Plan_organizationId_data_idx" ON "Plan"("organizationId", "data");
CREATE INDEX "Plan_batchId_idx" ON "Plan"("batchId");
CREATE UNIQUE INDEX "PlanStop_planId_clientId_key" ON "PlanStop"("planId", "clientId");
CREATE INDEX "SmsMessage_from_idx" ON "SmsMessage"("from");

ALTER TABLE "Plan" ADD CONSTRAINT "Plan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanStop" ADD CONSTRAINT "PlanStop_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanStop" ADD CONSTRAINT "PlanStop_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "PlanStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
