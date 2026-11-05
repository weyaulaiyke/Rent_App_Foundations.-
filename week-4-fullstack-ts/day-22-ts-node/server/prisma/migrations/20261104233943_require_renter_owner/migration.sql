/*
  Warnings:

  - Made the column `userId` on table `Renter` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Renter" DROP CONSTRAINT "Renter_userId_fkey";

-- AlterTable
ALTER TABLE "Renter" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Renter" ADD CONSTRAINT "Renter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
