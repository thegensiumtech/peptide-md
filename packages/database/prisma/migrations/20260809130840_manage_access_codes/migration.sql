-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'MANAGE_ACCESS_CODE';

-- CreateTable
CREATE TABLE "manage_access_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manage_access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manage_access_codes_email_expiresAt_idx" ON "manage_access_codes"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "manage_access_codes_expiresAt_idx" ON "manage_access_codes"("expiresAt");
