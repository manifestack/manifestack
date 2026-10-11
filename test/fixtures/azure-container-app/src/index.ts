import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';
import { ServiceBusClient } from '@azure/service-bus';
import { BlobServiceClient } from '@azure/storage-blob';
import { AzureOpenAI } from 'openai';
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: process.env.SENTRY_DSN });

const credential = new DefaultAzureCredential();
const orders = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT!, aadCredentials: credential }).database('app').container('orders');
const queue = new ServiceBusClient(process.env.SERVICEBUS_NAMESPACE!, credential).createSender('orders');
const uploads = new BlobServiceClient(`https://${process.env.STORAGE_ACCOUNT}.blob.core.windows.net`, credential).getContainerClient('uploads');
const ai = new AzureOpenAI({ azureADTokenProvider: getBearerTokenProvider(credential, 'https://cognitiveservices.azure.com/.default'), apiVersion: '2025-04-01-preview' });

export async function createOrder(text: string): Promise<string> {
	const summary = await ai.chat.completions.create({ model: 'gpt-4.1-mini', messages: [{ role: 'user', content: `Summarize: ${text}` }] });
	const { resource } = await orders.items.create({ text, summary: summary.choices[0].message.content });
	await queue.sendMessages({ body: { id: resource!.id } });
	await uploads.getBlockBlobClient(`${resource!.id}.txt`).upload(text, text.length);
	return resource!.id;
}
