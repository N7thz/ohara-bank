import { prisma } from '@/lib/prisma'
import type { ParsedPayslip } from './index'

/** Grava o holerite; se a competência já foi importada, mantém o que existe */
export async function savePayslip(userId: string, payslip: ParsedPayslip) {
	const { items, ...data } = payslip

	const existing = await prisma.payslip.findUnique({
		where: {
			userId_employerCnpj_competence: {
				userId,
				employerCnpj: data.employerCnpj,
				competence: data.competence,
			},
		},
	})
	if (existing) return { payslip: existing, created: false }

	const created = await prisma.payslip.create({
		data: { ...data, userId, items: { create: items } },
	})
	return { payslip: created, created: true }
}
