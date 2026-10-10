import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'live-jobs-app' });
export const syncTeam = inngest.createFunction({ id: 'sync-team' }, { event: 'team/updated' }, async ({ event, step }) => {
	await step.run('sync', () => ({ id: event.data.id }));
});
