import {
	Body,
	Button,
	Column,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	pixelBasedPreset,
	Row,
	Section,
	Tailwind,
	Text,
} from 'react-email'
import { formatCurrency } from '@/lib/format'
import { absMoney, isPositive, isZero, subtract, toMoney, toReais } from '@/lib/money'
import { cn } from '@/lib/utils'

// Peças comuns dos e-mails. O Tailwind daqui vira estilo inline no render, que é o que os
// clientes de e-mail entendem; cores fixas porque e-mail não lê as variáveis do tema

export const appUrl = (path = '') =>
	`${(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')}${path}`

const tailwindConfig = {
	presets: [pixelBasedPreset],
	theme: {
		extend: {
			colors: { brand: '#1a5ce6', good: '#15803d', bad: '#dc2626', muted: '#6b7280' },
		},
	},
}

interface EmailLayoutProps {
	title: string
	/** Linha que aparece ao lado do assunto na caixa de entrada */
	preview: string
	children: React.ReactNode
}

export function EmailLayout({ title, preview, children }: EmailLayoutProps) {
	return (
		<Html lang="pt-BR">
			<Head />
			{/* Também vira o <title>: alguns clientes leem a prévia de lá */}
			<Preview>{preview}</Preview>
			<Tailwind config={tailwindConfig}>
				<Body lang="pt-BR" className="m-0 bg-gray-100 px-3 py-6 font-sans">
					<Container className="max-w-[560px] rounded-2xl bg-white p-7">
						<Text className="m-0 text-xs font-semibold uppercase tracking-widest text-brand">
							Ohara Bank
						</Text>
						<Heading className="mt-1.5 mb-4 text-2xl leading-tight text-gray-900">{title}</Heading>
						{children}
					</Container>
					<Text className="mt-4 mb-0 text-center text-xs text-muted">
						Escolha quais e-mails receber em{' '}
						<Link href={appUrl('/dashboard/notifications')} className="text-muted underline">
							Notificações
						</Link>
						.
					</Text>
				</Body>
			</Tailwind>
		</Html>
	)
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<Heading as="h2" className="mt-7 mb-2 text-base text-gray-900">
			{children}
		</Heading>
	)
}

export function Muted({ children }: { children: React.ReactNode }) {
	return <Text className="my-3 text-sm leading-relaxed text-muted">{children}</Text>
}

export function Money({ value, tone }: { value: number; tone?: 'good' | 'bad' }) {
	return (
		<span
			className={cn(
				'whitespace-nowrap',
				tone === 'good' && 'text-good',
				tone === 'bad' && 'text-bad',
			)}
		>
			{formatCurrency(value)}
		</span>
	)
}

/** "▲ R$ 120,00", verde quando a mudança é boa */
export function Delta({
	value,
	previous,
	upIsGood,
}: {
	value: number
	previous: number | undefined
	upIsGood: boolean
}) {
	if (previous === undefined) return null
	const diff = subtract(toMoney(value), toMoney(previous))
	if (isZero(diff)) return null
	const up = isPositive(diff)
	return (
		<Text className={cn('m-0 text-xs', up === upIsGood ? 'text-good' : 'text-bad')}>
			{up ? '▲' : '▼'} {formatCurrency(toReais(absMoney(diff)))}
		</Text>
	)
}

/** Números grandes lado a lado: entradas, saídas, saldo */
export function Metrics({
	items,
}: {
	items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[]
}) {
	return (
		<Section>
			<Row>
				{items.map((item) => (
					<Column key={item.label} className="pr-4 align-top">
						<Text className="m-0 text-xs uppercase tracking-wide text-muted">{item.label}</Text>
						<Text className="m-0 text-[22px] font-bold text-gray-900">{item.value}</Text>
						{item.hint}
					</Column>
				))}
			</Row>
		</Section>
	)
}

/** Linhas "nome ........ valor", com uma nota opcional embaixo do nome */
export function ItemList({
	items,
}: {
	items: { key: string; label: string; note?: React.ReactNode; value: React.ReactNode }[]
}) {
	return (
		<Section>
			{items.map((item) => (
				<Row key={item.key} className="border-0 border-b border-solid border-gray-200">
					<Column className="py-2">
						<Text className="m-0 text-sm text-gray-900">{item.label}</Text>
						{item.note && <Text className="m-0 text-xs text-muted">{item.note}</Text>}
					</Column>
					<Column align="right" className="py-2 pl-4">
						<Text className="m-0 whitespace-nowrap text-sm text-gray-900">{item.value}</Text>
					</Column>
				</Row>
			))}
		</Section>
	)
}

export function CtaButton({ path, children }: { path: string; children: React.ReactNode }) {
	return (
		<Section className="mt-6">
			<Button
				href={appUrl(path)}
				className="rounded-xl bg-brand px-[18px] py-2.5 text-sm font-semibold text-white"
			>
				{children}
			</Button>
		</Section>
	)
}
