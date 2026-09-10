-- Documenti cliente

CREATE TABLE "ClientDocument" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientDocument_clientId_idx" ON "ClientDocument"("clientId");
CREATE INDEX "ClientDocument_organizationId_idx" ON "ClientDocument"("organizationId");

ALTER TABLE "ClientDocument"
  ADD CONSTRAINT "ClientDocument_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientDocument"
  ADD CONSTRAINT "ClientDocument_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
