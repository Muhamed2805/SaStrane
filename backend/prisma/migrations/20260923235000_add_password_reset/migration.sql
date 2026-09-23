-- AlterTable
ALTER TABLE "User"
ADD COLUMN "passwordResetCodeHash" TEXT,
ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetSentAt" TIMESTAMP(3),
ADD COLUMN "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0;
