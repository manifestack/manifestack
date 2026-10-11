import pg from 'pg';
import { Connector } from '@google-cloud/cloud-sql-connector';
import { PubSub } from '@google-cloud/pubsub';
import { Storage } from '@google-cloud/storage';
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: process.env.SENTRY_DSN });

const connector = new Connector();
const pool = new pg.Pool({ ...(await connector.getOptions({ instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME! })), max: 5 });
const uploads = new Storage().bucket(process.env.UPLOADS_BUCKET!);
const orders = new PubSub().topic('orders');

export async function createOrder(): Promise<{ id: number; upload: string }> {
	const { rows } = await pool.query('insert into orders default values returning id');
	await orders.publishMessage({ json: { id: rows[0].id } });
	const [upload] = await uploads.file(`orders/${rows[0].id}.pdf`).getSignedUrl({ action: 'write', expires: Date.now() + 600_000 });
	return { id: rows[0].id, upload };
}
