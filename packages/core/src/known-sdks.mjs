// SDKs of common vendors that have no page map yet. Detection reports them as `unmapped` so the
// audit still covers them (the skill finds the pricing page itself) and the hook can flag them.
// npm prefix entries end with `/` and match every package in that scope or path. `pypi` and `go` follow the rules in
// manifests.mjs (PyPI names normalized, trailing `*` = prefix; Go module path prefixes).
export const UNMAPPED_SDKS = [
	{ name: 'Turso', role: 'database', packages: ['@libsql/', '@tursodatabase/'] },
	{ name: 'Prisma Postgres', role: 'database', packages: ['@prisma/ppg', '@prisma/extension-accelerate'] },
	{ name: 'AWS', role: 'other', packages: ['@aws-sdk/', 'aws-sdk', 'aws-cdk-lib'], pypi: ['boto3', 'botocore', 'aws-cdk-lib'], go: ['github.com/aws/aws-sdk-go-v2', 'github.com/aws/aws-sdk-go'] },
	{ name: 'Google Cloud', role: 'other', packages: ['@google-cloud/'], pypi: ['google-cloud-*'], go: ['cloud.google.com/go'] },
	{ name: 'Azure', role: 'other', packages: ['@azure/'], pypi: ['azure-*'], go: ['github.com/Azure/azure-sdk-for-go'] },
	{ name: 'Auth.js', role: 'auth', packages: ['next-auth', '@auth/'] },
	{ name: 'Better Auth', role: 'auth', packages: ['better-auth'] },
	{ name: 'OpenRouter', role: 'ai', packages: ['@openrouter/ai-sdk-provider', '@openrouter/sdk'] },
	{ name: 'Mailgun', role: 'email', packages: ['mailgun.js', 'mailgun-js'] },
	{ name: 'Loops', role: 'email', packages: ['loops'] },
	{ name: 'Twilio', role: 'other', packages: ['twilio'], pypi: ['twilio'], go: ['github.com/twilio/twilio-go'] },
	{ name: 'Axiom', role: 'monitoring', packages: ['@axiomhq/'] },
	{ name: 'Better Stack', role: 'monitoring', packages: ['@logtail/'] },
	{ name: 'Algolia', role: 'other', packages: ['algoliasearch', '@algolia/'] },
	{ name: 'Pusher', role: 'other', packages: ['pusher', 'pusher-js'] },
	{ name: 'Ably', role: 'other', packages: ['ably'] },
	{ name: 'Liveblocks', role: 'other', packages: ['@liveblocks/'] },
	{ name: 'Inngest', role: 'other', packages: ['inngest'] },
	{ name: 'Trigger.dev', role: 'other', packages: ['@trigger.dev/'] },
	{ name: 'Mistral', role: 'ai', packages: ['@mistralai/mistralai', '@ai-sdk/mistral'], pypi: ['mistralai', 'langchain-mistralai'] },
	{ name: 'Groq', role: 'ai', packages: ['groq-sdk', '@ai-sdk/groq'], pypi: ['groq', 'langchain-groq'] },
	{ name: 'Cohere', role: 'ai', packages: ['cohere-ai'], pypi: ['cohere', 'langchain-cohere'] },
	{ name: 'Replicate', role: 'ai', packages: ['replicate'], pypi: ['replicate'], go: ['github.com/replicate/replicate-go'] },
	{ name: 'Together AI', role: 'ai', packages: ['together-ai'], pypi: ['together'] },
	{ name: 'Pinecone', role: 'database', packages: ['@pinecone-database/'], pypi: ['pinecone', 'pinecone-client'], go: ['github.com/pinecone-io/go-pinecone'] },
];

// Frameworks: inputs for Overbuilt findings, not vendors. Keys are matched like vendor patterns of that ecosystem.
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
export const FRAMEWORK_PYPI = { django: 'Django', fastapi: 'FastAPI', flask: 'Flask', litestar: 'Litestar', starlette: 'Starlette' };
export const FRAMEWORK_GO = { 'github.com/gin-gonic/gin': 'Gin', 'github.com/labstack/echo': 'Echo', 'github.com/gofiber/fiber': 'Fiber', 'github.com/go-chi/chi': 'Chi' };

export function packageMatches(pkg, patterns) {
	return patterns.some((p) => (p.endsWith('/') ? pkg.startsWith(p) : pkg === p));
}
