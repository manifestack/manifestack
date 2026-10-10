import express from 'express';
import VultrNode from '@vultr/vultr-node';
import { S3Client } from '@aws-sdk/client-s3';

const vultr = VultrNode.initialize({ apiKey: process.env.VULTR_API_KEY });
const s3 = new S3Client({ endpoint: 'https://ewr1.vultrobjects.com', region: 'us-east-1' });

const app = express();
app.get('/health', async (_req, res) => res.json({ account: await vultr.account.getAccountInfo() }));
app.post('/summary', async (_req, res) => {
	const r = await fetch('https://api.vultrinference.com/v1/chat/completions', {
		method: 'POST',
		headers: { authorization: `Bearer ${process.env.VULTR_INFERENCE_API_KEY}` },
	});
	res.json(await r.json());
});
app.listen(3000);
