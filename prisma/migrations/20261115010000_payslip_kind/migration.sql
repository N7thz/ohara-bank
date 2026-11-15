-- CreateEnum
CREATE TYPE "PayslipKind" AS ENUM ('MONTHLY', 'THIRTEENTH', 'VACATION');

-- DropIndex
DROP INDEX "payslip_userId_employerCnpj_competence_key";

-- AlterTable
ALTER TABLE "payslip" ADD COLUMN     "kind" "PayslipKind" NOT NULL DEFAULT 'MONTHLY';

-- CreateIndex
CREATE UNIQUE INDEX "payslip_userId_employerCnpj_competence_kind_netAmount_key" ON "payslip"("userId", "employerCnpj", "competence", "kind", "netAmount");
