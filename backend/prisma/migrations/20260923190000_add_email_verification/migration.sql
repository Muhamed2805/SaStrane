-- Existing accounts predate email verification and remain active.
ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationCodeHash" TEXT,
ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "emailVerifiedAt" IS NULL;
