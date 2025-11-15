import { smtpConfig } from './config.smtp.ts';

export async function sendResetEmail(email, token) {
  console.log(`📬 Simulating email to ${email} with reset link: https://creditcare/reset/${token}`);
  return { message: "Reset email sent (simulated)" };
}