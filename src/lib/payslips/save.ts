import { prisma } from '@/lib/prisma'
import { Prisma } from '../../../prisma/generated/client'
import type { ParsedPayslip } from './index'

/**
 * Grava o holerite. Mesmo empregador, mês, tipo e líquido = o mesmo PDF reimportado: mantém o
 * que existe. Outro tipo (13º, férias) ou outro valor no mesmo mês é guardado
 */
export async function savePayslip(userId: string, payslip: ParsedPayslip) {
	const { items, ...data } = payslip

	const where = {
		userId_employerCnpj_competence_kind_netAmount: {
			userId,
			employerCnpj: data.employerCnpj,
			competence: data.competence,
			kind: data.kind,
			netAmount: data.netAmount,
		},
	}
	const existing = await prisma.payslip.findUnique({ where })
	if (existing) return { payslip: existing, created: false }

	try {
		const created = await prisma.payslip.create({
			data: { ...data, userId, items: { create: items } },
		})
		return { payslip: created, created: true }
	} catch (error) {
		// Dois envios ao mesmo tempo: o outro gravou primeiro
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const payslip = await prisma.payslip.findUnique({ where })
			if (payslip) return { payslip, created: false }
		}
		throw error
	}
}
