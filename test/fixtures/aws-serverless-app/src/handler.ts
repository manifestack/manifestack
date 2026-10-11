import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import * as Sentry from '@sentry/aws-serverless';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const ses = new SESv2Client({});

export const handler: APIGatewayProxyHandlerV2 = Sentry.wrapHandler(async (event) => {
	const id = crypto.randomUUID();
	await db.send(new PutCommand({ TableName: process.env.TABLE, Item: { id, body: event.body } }));
	await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET, Key: `${id}.json`, Body: event.body ?? '' }));
	await ses.send(new SendEmailCommand({ FromEmailAddress: 'app@example.com', Destination: { ToAddresses: ['team@example.com'] }, Content: { Simple: { Subject: { Data: 'New item' }, Body: { Text: { Data: id } } } } }));
	return { statusCode: 201, body: id };
});
