-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'COMPANY');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "workspaceType" "WorkspaceType" NOT NULL DEFAULT 'PERSONAL';
