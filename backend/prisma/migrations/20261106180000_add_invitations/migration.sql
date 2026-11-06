-- Clients invite users who do jobs to apply to their open jobs.
-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invitation_executorId_createdAt_idx" ON "Invitation"("executorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_listingId_executorId_key" ON "Invitation"("listingId", "executorId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
