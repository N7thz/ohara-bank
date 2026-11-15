import { add, type Dinero, dinero, toDecimal, toSnapshot, transformScale } from 'dinero.js'
import { BRL } from 'dinero.js/currencies'

// Contas com dinheiro em centavos inteiros (dinero.js): soma em float acumula erro de
// centavos. As APIs continuam respondendo em reais (number)

export type Money = Dinero<number, 'BRL'>

export {
	add,
	compare,
	greaterThan,
	greaterThanOrEqual,
	isNegative,
	isPositive,
	isZero,
	lessThan,
	maximum,
	minimum,
	multiply,
	subtract,
} from 'dinero.js'

/** Reais (number, Decimal do Prisma ou "123.45") → Money */
export function toMoney(value: number | string | { toString(): string }) {
	return dinero({ amount: Math.round(Number(value.toString()) * 100), currency: BRL })
}

export const zeroMoney = () => dinero({ amount: 0, currency: BRL })

/** Centavos inteiros */
const cents = (value: Money) => toSnapshot(transformScale(value, 2)).amount

export const sumMoney = (values: Money[]) =>
	values.reduce((total, value) => add(total, value), zeroMoney())

/** Money → reais, para responder na API */
export const toReais = (value: Money) => Number(toDecimal(value))

/** Divide arredondando no centavo (média por mês, por exemplo) */
export function divideMoney(value: Money, divisor: number) {
	return dinero({ amount: Math.round(cents(value) / divisor), currency: BRL })
}

/** Valor absoluto: saídas vêm negativas do extrato */
export function absMoney(value: Money) {
	return dinero({ amount: Math.abs(cents(value)), currency: BRL })
}
