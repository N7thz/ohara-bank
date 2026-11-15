import nodemailer, { type Transporter } from 'nodemailer'

// Envio pelo Gmail com senha de app (myaccount.google.com/apppasswords): SMTP_USER é o
// endereço do Gmail e SMTP_PASS a senha de 16 letras. Sem as duas, nada é enviado

let transporter: Transporter | null = null

export function isEmailConfigured() {
	return !!process.env.SMTP_USER && !!process.env.SMTP_PASS
}

function getTransporter() {
	transporter ??= nodemailer.createTransport({
		host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
		port: Number(process.env.SMTP_PORT ?? 465),
		secure: (process.env.SMTP_PORT ?? '465') === '465',
		auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
	})
	return transporter
}

export interface EmailMessage {
	to: string
	subject: string
	html: string
	text: string
}

export async function sendEmail({ to, subject, html, text }: EmailMessage) {
	if (!isEmailConfigured())
		throw new Error('Envio de e-mail não configurado (SMTP_USER e SMTP_PASS)')

	await getTransporter().sendMail({
		from: { name: 'Ohara Bank', address: process.env.SMTP_USER as string },
		to,
		subject,
		html,
		text,
	})
}
