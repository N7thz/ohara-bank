import { defineConfig, env } from 'prisma/config'

export default defineConfig({
	// Pasta: o schema é dividido em um arquivo por domínio
	schema: 'prisma/schema',
	migrations: {
		path: 'prisma/migrations',
		seed: 'bun prisma/seed.ts',
	},
	datasource: {
		url: env('DIRECT_URL'),
	},
})
