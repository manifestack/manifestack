import { Client, Environment } from '@paypal/paypal-server-sdk';
import Stripe from 'stripe';
import twilio from 'twilio';

export const paypal = new Client({ clientCredentialsAuthCredentials: { oAuthClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!, oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET! }, environment: Environment.Production });
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const sms = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export function sendCode(to: string) {
	return sms.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!).verifications.create({ to, channel: 'sms' });
}
