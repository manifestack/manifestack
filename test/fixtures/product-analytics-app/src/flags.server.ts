import { init } from '@launchdarkly/node-server-sdk';

export const ld = init(process.env.LAUNCHDARKLY_SDK_KEY!);
