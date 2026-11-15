-- CreateEnum
CREATE TYPE "DebtOverrideStatus" AS ENUM ('PAID', 'PENDING', 'SKIPPED');

-- CreateTable
CREATE TABLE "debt_status_override" (
    "debtId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "status" "DebtOverrideStatus" NOT NULL,

    CONSTRAINT "debt_status_override_pkey" PRIMARY KEY ("debtId","month")
);

-- AddForeignKey
ALTER TABLE "debt_status_override" ADD CONSTRAINT "debt_status_override_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
