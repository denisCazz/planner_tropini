-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "assignedUserId" TEXT;

-- AlterTable
ALTER TABLE "RouteHistory" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "ClientNote" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_assignedUserId_idx" ON "Client"("assignedUserId");

-- CreateIndex
CREATE INDEX "RouteHistory_userId_idx" ON "RouteHistory"("userId");

-- CreateIndex
CREATE INDEX "ClientNote_clientId_idx" ON "ClientNote"("clientId");

-- CreateIndex
CREATE INDEX "ClientNote_organizationId_idx" ON "ClientNote"("organizationId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteHistory" ADD CONSTRAINT "RouteHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
