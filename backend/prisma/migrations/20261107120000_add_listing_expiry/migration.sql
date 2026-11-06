-- Open jobs close by themselves after 30 days unless the client extends them.
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_EXPIRED';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3);

-- Open jobs get 30 days from posting, and at least a week from now.
UPDATE "Listing"
SET "expiresAt" = GREATEST("createdAt" + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '7 days')
WHERE "status" = 'OPEN';

-- CreateIndex
CREATE INDEX "Listing_status_expiresAt_idx" ON "Listing"("status", "expiresAt");
