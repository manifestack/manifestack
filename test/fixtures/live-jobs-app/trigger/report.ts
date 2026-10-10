import { task } from '@trigger.dev/sdk';

export const weeklyReport = task({ id: 'weekly-report', run: async (payload: { teamId: string }) => ({ teamId: payload.teamId }) });
