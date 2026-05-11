-- CreateEnum
CREATE TYPE "StatoCliente" AS ENUM ('ATTIVO', 'INATTIVO', 'PROSPECT');

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "telefono" TEXT,
    "indirizzo" TEXT,
    "note" TEXT,
    "stato" "StatoCliente" NOT NULL DEFAULT 'PROSPECT',
    "ultimaVisita" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "startLat" DOUBLE PRECISION NOT NULL DEFAULT 44.7089,
    "startLng" DOUBLE PRECISION NOT NULL DEFAULT 7.6617,
    "startLabel" TEXT NOT NULL DEFAULT 'Via San Giorgio 14, Cavallermaggiore',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
