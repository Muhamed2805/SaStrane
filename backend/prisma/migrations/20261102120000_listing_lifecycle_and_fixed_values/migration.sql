-- Categories and locations were free text, and prices were text such as
-- "50 KM". This converts the existing rows instead of dropping the columns.

-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('LAWN_MOWING', 'CAR_WASH', 'MOVING', 'IT_HELP', 'CLEANING', 'ASSEMBLY', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingLocation" AS ENUM ('SARAJEVO', 'ILIDZA', 'STUP', 'VOGOSCA', 'MOSTAR', 'BANJA_LUKA', 'TUZLA', 'ZENICA');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
-- A category the app never offered becomes OTHER. A location it never
-- offered has no equivalent: it maps to NULL, and the migration fails.
-- A price keeps its first number in whole KM. "Po dogovoru" becomes NULL.
ALTER TABLE "Listing"
ADD COLUMN "status" "ListingStatus" NOT NULL DEFAULT 'OPEN',
ALTER COLUMN "category" TYPE "ListingCategory" USING (
  CASE "category"
    WHEN 'Košenje trave' THEN 'LAWN_MOWING'
    WHEN 'Pranje auta' THEN 'CAR_WASH'
    WHEN 'Selidbe' THEN 'MOVING'
    WHEN 'IT pomoć' THEN 'IT_HELP'
    WHEN 'Čišćenje' THEN 'CLEANING'
    WHEN 'Montaža' THEN 'ASSEMBLY'
    WHEN 'Dostava' THEN 'DELIVERY'
    ELSE 'OTHER'
  END
)::"ListingCategory",
ALTER COLUMN "location" TYPE "ListingLocation" USING (
  CASE "location"
    WHEN 'Sarajevo' THEN 'SARAJEVO'
    WHEN 'Ilidža' THEN 'ILIDZA'
    WHEN 'Stup' THEN 'STUP'
    WHEN 'Vogošća' THEN 'VOGOSCA'
    WHEN 'Mostar' THEN 'MOSTAR'
    WHEN 'Banja Luka' THEN 'BANJA_LUKA'
    WHEN 'Tuzla' THEN 'TUZLA'
    WHEN 'Zenica' THEN 'ZENICA'
  END
)::"ListingLocation",
ALTER COLUMN "budget" TYPE INTEGER USING (substring("budget" from '[0-9]+'))::INTEGER;

-- AlterTable
ALTER TABLE "Application"
ALTER COLUMN "proposedPrice" TYPE INTEGER USING (substring("proposedPrice" from '[0-9]+'))::INTEGER;

-- CreateIndex
CREATE INDEX "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Listing_clientId_createdAt_idx" ON "Listing"("clientId", "createdAt");
