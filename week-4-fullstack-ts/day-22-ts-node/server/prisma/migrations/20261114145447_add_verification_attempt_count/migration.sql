-- AlterTable
ALTER TABLE "EmailVerificationToken" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0;
