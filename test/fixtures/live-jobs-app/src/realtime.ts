import Pusher from 'pusher';
import * as Ably from 'ably';

export const pusher = new Pusher({ appId: '1', key: process.env.PUSHER_KEY!, secret: process.env.PUSHER_SECRET!, cluster: process.env.PUSHER_CLUSTER! });
export const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

export async function notify(teamId: string, event: unknown) {
	await pusher.trigger(`team-${teamId}`, 'update', event);
	await ably.channels.get(`team:${teamId}`).publish('update', event);
}
