import Stripe from 'stripe';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getFirestore } from 'firebase/firestore';
import * as Sentry from '@sentry/nextjs';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const openai = new OpenAI();
export const anthropic = new Anthropic();
export const db = getFirestore();
Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
