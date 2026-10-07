import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export function sendDigest(to: string, html: string) {
	return resend.emails.send({ from: 'digest@relaylog.example', to, subject: 'Your digest', html });
}
