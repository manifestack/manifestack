import { createClient } from 'next-sanity';
import { strapi } from '@strapi/client';
import { liteClient } from 'algoliasearch/lite';

export const sanity = createClient({ projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!, dataset: 'production', apiVersion: '2026-10-01', useCdn: true });
export const cms = strapi({ baseURL: `${process.env.NEXT_PUBLIC_STRAPI_URL}/api` });
export const search = liteClient(process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!, process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!);
