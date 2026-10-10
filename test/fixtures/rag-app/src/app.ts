import { Hono } from 'hono';
import { createClient } from '@libsql/client';
import { Pinecone } from '@pinecone-database/pinecone';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import Mailgun from 'mailgun.js';

const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
const index = new Pinecone().index('docs');
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const mail = new Mailgun(FormData).client({ username: 'api', key: process.env.MAILGUN_API_KEY!, url: 'https://api.eu.mailgun.net' });

const app = new Hono();
app.post('/ask', async (c) => {
	const { question, vector } = await c.req.json();
	const hits = await index.query({ vector, topK: 5, includeMetadata: true });
	const { text } = await generateText({ model: openrouter('anthropic/claude-sonnet-5.5'), prompt: `${question}\n${JSON.stringify(hits.matches)}` });
	await db.execute({ sql: 'insert into answers (q, a) values (?, ?)', args: [question, text] });
	await mail.messages.create('mg.example.com', { from: 'bot@example.com', to: 'team@example.com', subject: 'New answer', text });
	return c.json({ text });
});
export default app;
