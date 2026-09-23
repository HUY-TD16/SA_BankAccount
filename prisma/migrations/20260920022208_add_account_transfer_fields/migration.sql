-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
