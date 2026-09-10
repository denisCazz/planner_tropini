-- CreateEnum
CREATE TYPE "StatoAppuntamento" AS ENUM ('PIANIFICATO', 'CONFERMATO', 'COMPLETATO', 'ANNULLATO');

-- CreateEnum
CREATE TYPE "TipoAppuntamento" AS ENUM ('MANUTENZIONE', 'INSTALLAZIONE', 'SOPRALLUOGO', 'PRONTO_INTERVENTO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "workingHours" JSONB;

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "technicianId" TEXT,
    "date" DATE NOT NULL,
    "startMin" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "stato" "StatoAppuntamento" NOT NULL DEFAULT 'PIANIFICATO',
    "tipo" "TipoAppuntamento" NOT NULL DEFAULT 'MANUTENZIONE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_organizationId_date_idx" ON "Appointment"("organizationId", "date");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_technicianId_idx" ON "Appointment"("organizationId", "technicianId");

-- CreateIndex
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
