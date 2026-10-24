-- CreateEnum
CREATE TYPE "PayslipItemKind" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateTable
CREATE TABLE "payslip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "employerCnpj" TEXT NOT NULL,
    "competence" TIMESTAMP(3) NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "deductionsAmount" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "fgtsAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_item" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "kind" "PayslipItemKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "payslip_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payslip_userId_employerCnpj_competence_key" ON "payslip"("userId", "employerCnpj", "competence");

-- CreateIndex
CREATE INDEX "payslip_item_payslipId_idx" ON "payslip_item"("payslipId");

-- AddForeignKey
ALTER TABLE "payslip" ADD CONSTRAINT "payslip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_item" ADD CONSTRAINT "payslip_item_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
