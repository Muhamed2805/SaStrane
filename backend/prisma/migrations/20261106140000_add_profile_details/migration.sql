-- A profile photo, a short introduction and the kinds of jobs a user does.
ALTER TABLE "User" ADD COLUMN "avatarId" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "skills" "ListingCategory"[] DEFAULT ARRAY[]::"ListingCategory"[];
