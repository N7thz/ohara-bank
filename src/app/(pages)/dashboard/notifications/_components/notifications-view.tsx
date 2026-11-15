'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
	BellIcon,
	CheckCheckIcon,
	MailCheckIcon,
	MailIcon,
	MailWarningIcon,
	RefreshCwIcon,
	SendIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { PageSection } from '@/components/page-section'
import { QueryError } from '@/components/query-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import type { EmailKind, EmailSettings, InboxNotification } from '@/hooks/notifications'
import {
	useInbox,
	useMarkNotificationsRead,
	useNotifications,
	useRunEmailJobs,
	useSaveEmailSettings,
	useSendTestEmail,
} from '@/hooks/notifications'

function errorMessage(error: unknown, fallback: string) {
	return (isAxiosError(error) && error.response?.data?.error) || fallback
}

const KIND_LABEL: Record<EmailKind, string> = {
	bills: 'Contas',
	weekly: 'Semanal',
	monthly: 'Mensal',
	budget: 'Orçamento',
	test: 'Teste',
}

const settingsSchema = z.object({
	billReminders: z.boolean(),
	billReminderDays: z
		.string()
		.trim()
		.refine((value) => /^\d+$/.test(value) && Number(value) <= 15, 'De 0 a 15 dias'),
	weeklySummary: z.boolean(),
	monthlySummary: z.boolean(),
	budgetAlerts: z.boolean(),
})

type SettingsFormData = z.infer<typeof settingsSchema>

const toFormValues = (settings?: EmailSettings): SettingsFormData => ({
	billReminders: settings?.billReminders ?? true,
	billReminderDays: String(settings?.billReminderDays ?? 3),
	weeklySummary: settings?.weeklySummary ?? true,
	monthlySummary: settings?.monthlySummary ?? true,
	budgetAlerts: settings?.budgetAlerts ?? true,
})

const OPTIONS: {
	name: Exclude<keyof SettingsFormData, 'billReminderDays'>
	title: string
	description: string
}[] = [
	{
		name: 'billReminders',
		title: 'Contas a vencer',
		description:
			'Contas fixas, recorrentes e parceladas ainda a pagar que vencem nos próximos dias, e as atrasadas.',
	},
	{
		name: 'weeklySummary',
		title: 'Resumo semanal',
		description:
			'Entradas, saídas e onde mais gastou na semana, assim que os extratos cobrirem a semana inteira.',
	},
	{
		name: 'monthlySummary',
		title: 'Resumo mensal',
		description: 'O fechamento do mês anterior, comparado ao mês antes dele.',
	},
	{
		name: 'budgetAlerts',
		title: 'Alerta de orçamento',
		description: 'Quando uma tag passa de 80% e de 100% do orçamento do mês.',
	},
]

function SettingsForm({ settings }: { settings: EmailSettings }) {
	const { mutate: save, isPending } = useSaveEmailSettings()
	const {
		control,
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors, isDirty },
	} = useForm<SettingsFormData>({
		resolver: zodResolver(settingsSchema),
		defaultValues: toFormValues(settings),
	})

	useEffect(() => reset(toFormValues(settings)), [settings, reset])

	const daysField = register('billReminderDays')
	const billReminders = watch('billReminders')

	function onSubmit(data: SettingsFormData) {
		save(
			{ ...data, billReminderDays: Number(data.billReminderDays) },
			{
				onSuccess: () => toast.success('Preferências salvas'),
				onError: (error) => toast.error(errorMessage(error, 'Erro ao salvar')),
			},
		)
	}

	return (
		<Card>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
					<ul className="flex flex-col divide-y">
						{OPTIONS.map((option) => (
							<li key={option.name} className="flex flex-col gap-3 py-4 first:pt-0">
								<div className="flex items-start gap-3">
									<div className="flex min-w-0 flex-1 flex-col gap-1">
										<label htmlFor={`email-${option.name}`} className="font-medium">
											{option.title}
										</label>
										<p className="text-sm text-muted-foreground">{option.description}</p>
									</div>
									<Controller
										control={control}
										name={option.name}
										render={({ field }) => (
											<Switch
												id={`email-${option.name}`}
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										)}
									/>
								</div>
								{option.name === 'billReminders' && billReminders && (
									<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
										<label htmlFor="email-days">Avisar com</label>
										<Input
											id="email-days"
											inputMode="numeric"
											className="w-16 text-center"
											aria-invalid={!!errors.billReminderDays}
											{...daysField}
											onChange={(event) => {
												event.target.value = event.target.value.replace(/\D/g, '').slice(0, 2)
												daysField.onChange(event)
											}}
										/>
										<span>dias de antecedência</span>
										{errors.billReminderDays && (
											<span className="text-xs text-destructive">
												{errors.billReminderDays.message}
											</span>
										)}
									</div>
								)}
							</li>
						))}
					</ul>
					<div className="flex justify-end pt-4">
						<Button type="submit" disabled={!isDirty || isPending}>
							Salvar
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	)
}

function SetupCard({ configured, recipient }: { configured: boolean; recipient: string }) {
	if (configured) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<MailCheckIcon className="size-4 text-positive" />
						Envio configurado
					</CardTitle>
					<CardDescription>
						Os e-mails vão para <span className="font-medium text-foreground">{recipient}</span>.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
					<p>
						O app verifica a cada 15 minutos, a partir das 8h, e logo depois de cada extrato
						importado. Só envia enquanto o app estiver aberto; o que ficou para trás sai na próxima
						vez.
					</p>
					<p>Cada aviso sai uma vez só.</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<MailWarningIcon className="size-4 text-destructive" />
					Falta configurar o envio
				</CardTitle>
				<CardDescription>
					Os e-mails saem pela sua conta do Gmail com uma senha de app.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-3 text-sm">
				<ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
					<li>Ative a verificação em duas etapas na conta Google.</li>
					<li>
						Gere uma senha de app em{' '}
						<a
							href="https://myaccount.google.com/apppasswords"
							target="_blank"
							rel="noreferrer"
							className="font-medium text-foreground underline underline-offset-4"
						>
							myaccount.google.com/apppasswords
						</a>
						.
					</li>
					<li>Adicione ao .env e reinicie o app:</li>
				</ol>
				<pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs">
					{'SMTP_USER=seu-email@gmail.com\nSMTP_PASS=abcdabcdabcdabcd'}
				</pre>
			</CardContent>
		</Card>
	)
}

function EmailLogList({
	logs,
}: {
	logs: NonNullable<ReturnType<typeof useNotifications>['data']>['logs']
}) {
	if (logs.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<MailIcon />
					</EmptyMedia>
					<EmptyTitle>Nenhum e-mail enviado ainda</EmptyTitle>
					<EmptyDescription>Os envios e as falhas aparecem aqui.</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<ul className="divide-y rounded-xl border bg-card">
			{logs.map((log) => (
				<li key={log.id} className="flex items-start gap-3 px-4 py-3 text-sm">
					<Badge variant={log.error ? 'destructive' : 'secondary'} className="mt-0.5 shrink-0">
						{KIND_LABEL[log.kind] ?? log.kind}
					</Badge>
					<div className="flex min-w-0 flex-1 flex-col">
						<span className="truncate font-medium" title={log.subject}>
							{log.subject}
						</span>
						{log.error && <span className="text-xs text-destructive">{log.error}</span>}
					</div>
					<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
						{format(log.sentAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
					</span>
				</li>
			))}
		</ul>
	)
}

/** Avisos do sino: os mesmos do menu, com a lista inteira */
function InboxList() {
	const router = useRouter()
	const { data, isLoading } = useInbox()
	const markRead = useMarkNotificationsRead()

	if (isLoading) return <Skeleton className="h-40" />
	const items = data?.items ?? []

	if (items.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<BellIcon />
					</EmptyMedia>
					<EmptyTitle>Nenhum aviso por enquanto</EmptyTitle>
					<EmptyDescription>
						Contas a vencer, resumos e alertas de orçamento aparecem aqui e no sino.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	function open(item: InboxNotification) {
		if (!item.readAt) markRead.mutate([item.id])
		if (item.href) router.push(item.href)
	}

	return (
		<ul className="divide-y rounded-xl border bg-card">
			{items.map((item) => (
				<li key={item.id}>
					<button
						type="button"
						onClick={() => open(item)}
						className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
					>
						<Badge variant={item.readAt ? 'outline' : 'secondary'} className="mt-0.5 shrink-0">
							{KIND_LABEL[item.kind] ?? item.kind}
						</Badge>
						<div className="flex min-w-0 flex-1 flex-col">
							<span
								className={item.readAt ? 'text-muted-foreground' : 'font-medium'}
								title={item.title}
							>
								{item.title}
							</span>
							{item.body && <span className="text-xs text-muted-foreground">{item.body}</span>}
						</div>
						<span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
							{format(item.createdAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
							{!item.readAt && (
								<>
									<span className="size-2 rounded-full bg-primary" aria-hidden />
									<span className="sr-only">Não lido</span>
								</>
							)}
						</span>
					</button>
				</li>
			))}
		</ul>
	)
}

export function NotificationsView() {
	const { data: inbox } = useInbox()
	const markAllRead = useMarkNotificationsRead()
	const { data, isLoading, isError, refetch, isRefetching } = useNotifications()
	const { mutate: sendTest, isPending: isSendingTest } = useSendTestEmail()
	const { mutate: runNow, isPending: isRunning } = useRunEmailJobs()

	function handleTest() {
		sendTest(undefined, {
			onSuccess: ({ to }) => toast.success(`E-mail de teste enviado para ${to}`),
			onError: (error) => toast.error(errorMessage(error, 'Erro ao enviar o teste')),
		})
	}

	function handleRun() {
		runNow(undefined, {
			onSuccess: (results) => {
				const failed = results.filter((result) => result.error)
				const sent = results.length - failed.length
				if (results.length === 0) toast.info('Nenhum aviso pendente')
				else if (failed.length > 0) toast.error(`${failed.length} e-mail(s) falharam; veja abaixo`)
				else toast.success(`${sent} ${sent === 1 ? 'e-mail enviado' : 'e-mails enviados'}`)
			},
			onError: (error) => toast.error(errorMessage(error, 'Erro ao verificar')),
		})
	}

	return (
		<div className="stagger page-stack">
			<PageHeader
				title="Notificações"
				description="Contas a vencer, resumos e alertas de orçamento, no sino do app e por e-mail."
				actions={
					data?.configured && (
						<>
							<Button variant="outline" onClick={handleTest} disabled={isSendingTest}>
								<SendIcon data-icon="inline-start" />
								Enviar teste
							</Button>
							<Button variant="outline" onClick={handleRun} disabled={isRunning}>
								<RefreshCwIcon data-icon="inline-start" />
								Verificar agora
							</Button>
						</>
					)
				}
			>
				{isError && (
					<QueryError
						message="Não foi possível carregar as notificações."
						onRetry={() => refetch()}
						retrying={isRefetching}
					/>
				)}
			</PageHeader>

			{isLoading && <Skeleton className="h-96" />}

			<PageSection
				title="No app"
				description="Os 30 avisos mais recentes; os mesmos do sino no topo."
				actions={
					(inbox?.unread ?? 0) > 0 && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => markAllRead.mutate(undefined)}
							disabled={markAllRead.isPending}
						>
							<CheckCheckIcon data-icon="inline-start" />
							Marcar todas como lidas
						</Button>
					)
				}
			>
				<InboxList />
			</PageSection>

			{data && (
				<>
					<PageSection title="Preferências" description="Valem para o sino e para os e-mails.">
						<div className="grid items-start gap-6 md:grid-cols-[3fr_2fr]">
							<SettingsForm settings={data.settings} />
							<SetupCard configured={data.configured} recipient={data.recipient} />
						</div>
					</PageSection>

					<PageSection title="E-mails enviados" description="Os 20 mais recentes.">
						<EmailLogList logs={data.logs} />
					</PageSection>
				</>
			)}
		</div>
	)
}
