-- CreateEnum
CREATE TYPE "CategoriaSpesa" AS ENUM ('CARBURANTE', 'RICAMBI', 'ATTREZZATURA', 'PEDAGGI', 'ALLOGGIO', 'MARKETING', 'VARIE');

-- CreateTable
CREATE TABLE "Intervento" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "technicianId" TEXT,
    "appointmentId" INTEGER,
    "data" DATE NOT NULL,
    "ricavo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "descrizione" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spesa" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "categoria" "CategoriaSpesa" NOT NULL DEFAULT 'VARIE',
    "importo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "descrizione" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spesa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Intervento_appointmentId_key" ON "Intervento"("appointmentId");

-- CreateIndex
CREATE INDEX "Intervento_organizationId_data_idx" ON "Intervento"("organizationId", "data");

-- CreateIndex
CREATE INDEX "Intervento_clientId_idx" ON "Intervento"("clientId");

-- CreateIndex
CREATE INDEX "Spesa_organizationId_data_idx" ON "Spesa"("organizationId", "data");

-- AddForeignKey
ALTER TABLE "Intervento" ADD CONSTRAINT "Intervento_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervento" ADD CONSTRAINT "Intervento_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervento" ADD CONSTRAINT "Intervento_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervento" ADD CONSTRAINT "Intervento_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spesa" ADD CONSTRAINT "Spesa_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
