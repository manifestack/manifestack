import 'newrelic';
import express from 'express';
import { Client } from '@elastic/elasticsearch';

const es = new Client({ cloud: { id: process.env.ELASTIC_CLOUD_ID! }, auth: { apiKey: process.env.ELASTIC_API_KEY! } });
const app = express();
app.get('/search', async (req, res) => res.json(await es.search({ index: 'products', q: String(req.query.q) })));
app.listen(3000);
