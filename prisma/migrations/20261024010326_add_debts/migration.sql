-- CreateEnum
CREATE TYPE "DebtKind" AS ENUM ('FIXED', 'RECURRING', 'INSTALLMENT');

-- CreateTable
CREATE TABLE "debt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DebtKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDay" INTEGER,
    "installments" INTEGER,
    "startMonth" TIMESTAMP(3) NOT NULL,
    "pattern" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debt_userId_idx" ON "debt"("userId");

-- AddForeignKey
ALTER TABLE "debt" ADD CONSTRAINT "debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
