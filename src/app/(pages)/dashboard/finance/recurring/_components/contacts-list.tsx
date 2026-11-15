'use client'

import { ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { RecurringContact } from '@/hooks/finance/recurring'
import { formatCurrency, formatDate } from '@/lib/format'
import { monthLabel } from './month-bars'

// Quantos aparecem antes do "ver todos"
const VISIBLE = 8

/** Legenda das duas séries; a cor nunca aparece sozinha */
export function ContactsLegend() {
	return (
		<div className="flex gap-4 text-xs text-muted-foreground">
			<span className="flex items-center gap-1.5">
				<span className="size-2.5 rounded-sm bg-positive" />
				Recebido
			</span>
			<span className="flex items-center gap-1.5">
				<span className="size-2.5 rounded-sm bg-negative" />
				Enviado
			</span>
		</div>
	)
}

/**
 * Doze meses espelhados: recebido sobe, enviado desce, a partir da mesma linha. Mesma
 * escala para os dois lados, para comparar a altura de um com a do outro
 */
function MirrorBars({ contact }: { contact: RecurringContact }) {
	const max = Math.max(...contact.monthly.flatMap((month) => [month.sent, month.received]), 1)

	return (
		<div className="flex h-12 items-stretch gap-0.5">
			{contact.monthly.map((month) => {
				const empty = month.sent === 0 && month.received === 0
				const text = empty
					? 'nada'
					: [
							month.received > 0 && `recebido ${formatCurrency(month.received)}`,
							month.sent > 0 && `enviado ${formatCurrency(month.sent)}`,
						]
							.filter(Boolean)
							.join(', ')
				return (
					<div
						key={month.month}
						className="group/bar relative flex w-2.5 flex-col"
						role="img"
						aria-label={`${monthLabel(month.month)}: ${text}`}
					>
						<div className="flex flex-1 items-end border-b border-border">
							<div
								className="h-full w-full origin-bottom rounded-t-[3px] bg-positive transition-transform duration-500 ease-out"
								style={{ transform: `scaleY(${month.received / max})` }}
							/>
						</div>
						<div className="flex flex-1 items-start">
							<div
								className="h-full w-full origin-top rounded-b-[3px] bg-negative transition-transform duration-500 ease-out"
								style={{ transform: `scaleY(${month.sent / max})` }}
							/>
						</div>
						<div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground opacity-0 shadow-md ring-1 ring-foreground/10 transition-opacity group-hover/bar:opacity-100">
							<span className="text-muted-foreground">{monthLabel(month.month)}</span>{' '}
							<span className="font-medium tabular-nums">{text}</span>
						</div>
					</div>
				)
			})}
		</div>
	)
}

export function ContactsList({ contacts }: { contacts: RecurringContact[] }) {
	const [showAll, setShowAll] = useState(false)
	const visible = showAll ? contacts : contacts.slice(0, VISIBLE)

	return (
		<Card>
			<CardContent className="flex flex-col">
				<ul className="flex flex-col">
					{visible.map((contact) => {
						const balance = contact.received - contact.sent
						return (
							<li key={contact.key}>
								<Link
									href={`/dashboard/finance/transactions?${new URLSearchParams({ q: contact.query })}`}
									className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_auto_9rem]"
								>
									<div className="flex min-w-0 flex-col">
										<span className="truncate font-medium" title={contact.name}>
											{contact.name}
										</span>
										<span className="text-xs text-muted-foreground">
											{contact.months} {contact.months === 1 ? 'mês' : 'meses'} · última em{' '}
											{formatDate(contact.lastDate)}
										</span>
									</div>
									<div className="order-last col-span-2 sm:order-none sm:col-span-1">
										<MirrorBars contact={contact} />
									</div>
									<div className="flex items-center justify-end gap-1 text-right">
										<div className="flex flex-col text-xs tabular-nums">
											{contact.receivedCount > 0 && (
												<span>
													<span className="text-muted-foreground">recebeu </span>
													{formatCurrency(contact.received)}
												</span>
											)}
											{contact.sentCount > 0 && (
												<span>
													<span className="text-muted-foreground">enviou </span>
													{formatCurrency(contact.sent)}
												</span>
											)}
											{contact.receivedCount > 0 && contact.sentCount > 0 && (
												<span className="text-muted-foreground">
													saldo {balance >= 0 ? '+' : '−'}
													{formatCurrency(Math.abs(balance))}
												</span>
											)}
										</div>
										<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
									</div>
								</Link>
							</li>
						)
					})}
				</ul>
				{contacts.length > VISIBLE && (
					<Button
						variant="ghost"
						size="sm"
						className="self-start"
						onClick={() => setShowAll((value) => !value)}
					>
						{showAll ? 'Mostrar menos' : `Ver todos os ${contacts.length}`}
					</Button>
				)}
			</CardContent>
		</Card>
	)
}
