-- Executors rate the clients they worked for.
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NEW_CLIENT_RATING';

-- CreateTable
CREATE TABLE "ClientRating" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "listingId" TEXT,
    "listingTitle" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientRating_applicationId_key" ON "ClientRating"("applicationId");

-- CreateIndex
CREATE INDEX "ClientRating_clientId_createdAt_idx" ON "ClientRating"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientRating_listingId_idx" ON "ClientRating"("listingId");

-- AddForeignKey
ALTER TABLE "ClientRating" ADD CONSTRAINT "ClientRating_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRating" ADD CONSTRAINT "ClientRating_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRating" ADD CONSTRAINT "ClientRating_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRating" ADD CONSTRAINT "ClientRating_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
