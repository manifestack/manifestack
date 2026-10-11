import { initializeFaro } from '@grafana/faro-web-sdk';

initializeFaro({ url: import.meta.env.VITE_FARO_URL, app: { name: 'observability-app' } });
