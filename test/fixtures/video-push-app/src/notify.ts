import * as OneSignal from '@onesignal/node-onesignal';
import Mux from '@mux/mux-node';

const client = new OneSignal.DefaultApi(OneSignal.createConfiguration({ restApiKey: process.env.ONESIGNAL_REST_API_KEY }));
const mux = new Mux();

export async function announce(uploadId: string) {
	const asset = await mux.video.assets.create({ inputs: [{ url: uploadId }], playback_policies: ['public'], video_quality: 'basic' });
	const push = new OneSignal.Notification();
	push.app_id = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!;
	push.contents = { en: 'New video' };
	push.included_segments = ['Subscribed Users'];
	await client.createNotification(push);
	const digest = new OneSignal.Notification();
	digest.app_id = push.app_id;
	digest.target_channel = 'email';
	digest.email_subject = 'New video';
	await client.createNotification(digest);
	return asset.id;
}
