-- Ratings of executors by the clients who accepted them. See the Rating model.
-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "listingId" TEXT,
    "listingTitle" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_applicationId_key" ON "Rating"("applicationId");

-- CreateIndex
CREATE INDEX "Rating_executorId_createdAt_idx" ON "Rating"("executorId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_listingId_idx" ON "Rating"("listingId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Prisma does not model CHECK constraints, so this one lives only here.
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_score_check" CHECK ("score" BETWEEN 1 AND 5);
