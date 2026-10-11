import { AnalyticsBrowser } from '@segment/analytics-next';
import mixpanel from 'mixpanel-browser';
import * as amplitude from '@amplitude/analytics-browser';
import { Experiment } from '@amplitude/experiment-js-client';
import posthog from 'posthog-js';

export const segment = AnalyticsBrowser.load({ writeKey: process.env.NEXT_PUBLIC_SEGMENT_WRITE_KEY! });
mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN!);
amplitude.init(process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY!);
export const experiment = Experiment.initialize('client-deployment-key');

export function newCheckout() {
	return posthog.isFeatureEnabled('new-checkout');
}
