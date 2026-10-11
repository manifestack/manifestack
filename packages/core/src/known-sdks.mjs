// SDKs of common vendors that have no page map yet. Detection reports them as `unmapped` so the
// audit still covers them (the skill finds the pricing page itself) and the hook can flag them.
// npm prefix entries end with `/` and match every package in that scope or path. `pypi` and `go` follow the rules in
// manifests.mjs (PyPI names normalized, trailing `*` = prefix; Go module path prefixes).
export const UNMAPPED_SDKS = [
	{ name: 'Auth.js', role: 'auth', packages: ['next-auth', '@auth/'] },
	{ name: 'Better Auth', role: 'auth', packages: ['better-auth'] },
	{ name: 'Loops', role: 'email', packages: ['loops'] },
	{ name: 'Axiom', role: 'monitoring', packages: ['@axiomhq/'] },
	{ name: 'Better Stack', role: 'monitoring', packages: ['@logtail/'] },
	{ name: 'Liveblocks', role: 'realtime', packages: ['@liveblocks/'] },
	{ name: 'Mistral', role: 'ai', packages: ['@mistralai/mistralai', '@ai-sdk/mistral'], pypi: ['mistralai', 'langchain-mistralai'] },
	{ name: 'Groq', role: 'ai', packages: ['groq-sdk', '@ai-sdk/groq'], pypi: ['groq', 'langchain-groq'] },
	{ name: 'Cohere', role: 'ai', packages: ['cohere-ai'], pypi: ['cohere', 'langchain-cohere'] },
	{ name: 'Replicate', role: 'ai', packages: ['replicate'], pypi: ['replicate'], go: ['github.com/replicate/replicate-go'] },
	{ name: 'Together AI', role: 'ai', packages: ['together-ai'], pypi: ['together'] },
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
