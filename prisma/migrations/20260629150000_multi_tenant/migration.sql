-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateTable Organization
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default organizations
INSERT INTO "Organization" ("id", "name", "slug", "isDemo", "createdAt", "updatedAt")
VALUES
  ('org_tropini', 'Tropini', 'tropini', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('org_demo', 'Demo', 'demo', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add organizationId to Client
ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;
UPDATE "Client" SET "organizationId" = 'org_tropini';
ALTER TABLE "Client" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate Settings: new table structure
CREATE TABLE "Settings_new" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL DEFAULT 44.7089,
    "startLng" DOUBLE PRECISION NOT NULL DEFAULT 7.6617,
    "startLabel" TEXT NOT NULL DEFAULT 'Via San Giorgio 14, Cavallermaggiore',
    "nearestNeighbours" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "Settings_new_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Settings_new_organizationId_key" ON "Settings_new"("organizationId");

INSERT INTO "Settings_new" ("id", "organizationId", "startLat", "startLng", "startLabel", "nearestNeighbours")
SELECT
  'set_tropini',
  'org_tropini',
  COALESCE("startLat", 44.7089),
  COALESCE("startLng", 7.6617),
  COALESCE("startLabel", 'Via San Giorgio 14, Cavallermaggiore'),
  COALESCE("nearestNeighbours", 4)
FROM "Settings"
WHERE "id" = 'default'
LIMIT 1;

INSERT INTO "Settings_new" ("id", "organizationId", "startLat", "startLng", "startLabel", "nearestNeighbours")
SELECT 'set_tropini', 'org_tropini', 44.7089, 7.6617, 'Via San Giorgio 14, Cavallermaggiore', 4
WHERE NOT EXISTS (SELECT 1 FROM "Settings_new");

INSERT INTO "Settings_new" ("id", "organizationId", "startLat", "startLng", "startLabel", "nearestNeighbours")
VALUES ('set_demo', 'org_demo', 45.0703, 7.6869, 'Torino, Piazza Castello', 4);

DROP TABLE "Settings";
ALTER TABLE "Settings_new" RENAME TO "Settings";
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RouteHistory organizationId
ALTER TABLE "RouteHistory" ADD COLUMN "organizationId" TEXT;
UPDATE "RouteHistory" SET "organizationId" = 'org_tropini';
ALTER TABLE "RouteHistory" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "RouteHistory_organizationId_idx" ON "RouteHistory"("organizationId");
ALTER TABLE "RouteHistory" ADD CONSTRAINT "RouteHistory_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Demo sample clients (isolated from Tropini data)
INSERT INTO "Client" (
  "organizationId", "nome", "cognome", "email", "telefono", "indirizzo", "cap", "citta", "provincia",
  "marcaStufa", "modelloStufa", "stato", "urgente", "lat", "lng", "createdAt", "updatedAt"
) VALUES
  ('org_demo', 'Mario', 'Rossi', 'mario.rossi@demo.it', '3331234567', 'Via Roma 1', '10100', 'Torino', 'TO', 'MCZ', 'Star 3.0', 'ATTIVO', false, 45.0703, 7.6869, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('org_demo', 'Laura', 'Bianchi', 'laura.bianchi@demo.it', '3477654321', 'Corso Vittorio Emanuele 50', '10123', 'Torino', 'TO', 'Palazzetti', 'Ecomix', 'PROSPECT', true, 45.0626, 7.6781, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('org_demo', 'Giuseppe', 'Verdi', NULL, '3209988776', 'Via Garibaldi 12', '10024', 'Moncalieri', 'TO', 'Edilkamin', 'Blade', 'ATTIVO', false, 44.9984, 7.6826, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
