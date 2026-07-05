-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "icona" TEXT;

-- AlterTable
ALTER TABLE "Settings" RENAME CONSTRAINT "Settings_new_pkey" TO "Settings_pkey";

-- RenameIndex
ALTER INDEX "Settings_new_organizationId_key" RENAME TO "Settings_organizationId_key";
