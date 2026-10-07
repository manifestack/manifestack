// SDKs of common vendors that have no page map yet. Detection reports them as `unmapped` so the
// audit still covers them (the skill finds the pricing page itself) and the hook can flag them.
// Prefix entries end with `/` and match every package in that scope or path.
export const UNMAPPED_SDKS = [
	{ name: 'Stripe', role: 'payments', packages: ['stripe', '@stripe/'] },
	{ name: 'Paddle', role: 'payments', packages: ['@paddle/'] },
	{ name: 'Lemon Squeezy', role: 'payments', packages: ['@lemonsqueezy/'] },
	{ name: 'Polar', role: 'payments', packages: ['@polar-sh/'] },
	{ name: 'Auth0', role: 'auth', packages: ['@auth0/', 'auth0'] },
	{ name: 'WorkOS', role: 'auth', packages: ['@workos-inc/'] },
	{ name: 'Firebase', role: 'database', packages: ['firebase', 'firebase-admin'] },
	{ name: 'PlanetScale', role: 'database', packages: ['@planetscale/'] },
	{ name: 'Turso', role: 'database', packages: ['@libsql/', '@tursodatabase/'] },
	{ name: 'MongoDB Atlas', role: 'database', packages: ['mongodb', 'mongoose'] },
	{ name: 'Upstash', role: 'database', packages: ['@upstash/'] },
	{ name: 'Convex', role: 'database', packages: ['convex'] },
	{ name: 'Prisma Postgres', role: 'database', packages: ['@prisma/ppg', '@prisma/extension-accelerate'] },
	{ name: 'AWS', role: 'other', packages: ['@aws-sdk/', 'aws-sdk', 'aws-cdk-lib'] },
	{ name: 'Google Cloud', role: 'other', packages: ['@google-cloud/'] },
	{ name: 'Azure', role: 'other', packages: ['@azure/'] },
	{ name: 'Cloudflare', role: 'hosting', packages: ['wrangler', '@cloudflare/'] },
	{ name: 'Netlify', role: 'hosting', packages: ['@netlify/', 'netlify-cli'] },
	{ name: 'Fly.io', role: 'hosting', packages: ['@fly/'] },
	{ name: 'SendGrid', role: 'email', packages: ['@sendgrid/'] },
	{ name: 'Postmark', role: 'email', packages: ['postmark'] },
	{ name: 'Mailgun', role: 'email', packages: ['mailgun.js', 'mailgun-js'] },
	{ name: 'Loops', role: 'email', packages: ['loops'] },
	{ name: 'Twilio', role: 'other', packages: ['twilio'] },
	{ name: 'Sentry', role: 'monitoring', packages: ['@sentry/'] },
	{ name: 'Datadog', role: 'monitoring', packages: ['@datadog/', 'dd-trace'] },
	{ name: 'PostHog', role: 'monitoring', packages: ['posthog-js', 'posthog-node'] },
	{ name: 'Axiom', role: 'monitoring', packages: ['@axiomhq/'] },
	{ name: 'Better Stack', role: 'monitoring', packages: ['@logtail/'] },
	{ name: 'UploadThing', role: 'storage', packages: ['uploadthing', '@uploadthing/'] },
	{ name: 'Cloudinary', role: 'storage', packages: ['cloudinary', 'next-cloudinary'] },
	{ name: 'Algolia', role: 'other', packages: ['algoliasearch', '@algolia/'] },
	{ name: 'Pusher', role: 'other', packages: ['pusher', 'pusher-js'] },
	{ name: 'Ably', role: 'other', packages: ['ably'] },
	{ name: 'Liveblocks', role: 'other', packages: ['@liveblocks/'] },
	{ name: 'Inngest', role: 'other', packages: ['inngest'] },
	{ name: 'Trigger.dev', role: 'other', packages: ['@trigger.dev/'] },
	{ name: 'OpenAI', role: 'other', packages: ['openai', '@ai-sdk/openai'] },
	{ name: 'Anthropic', role: 'other', packages: ['@anthropic-ai/sdk', '@ai-sdk/anthropic'] },
	{ name: 'Pinecone', role: 'database', packages: ['@pinecone-database/'] },
];

// Frameworks and infrastructure tooling: inputs for Overbuilt findings, not vendors.
export const FRAMEWORK_PACKAGES = {
	next: 'Next.js',
	nuxt: 'Nuxt',
	'@remix-run/node': 'Remix',
	'@react-router/dev': 'React Router',
	astro: 'Astro',
	'@sveltejs/kit': 'SvelteKit',
	gatsby: 'Gatsby',
	'@angular/core': 'Angular',
	vite: 'Vite',
	express: 'Express',
	fastify: 'Fastify',
	hono: 'Hono',
	'@nestjs/core': 'NestJS',
	'@tanstack/react-start': 'TanStack Start',
};

export function packageMatches(pkg, patterns) {
	return patterns.some((p) => (p.endsWith('/') ? pkg.startsWith(p) : pkg === p));
}
